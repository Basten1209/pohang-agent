import { useChat } from '@ai-sdk/react'
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai'
import { useEffect, useMemo, useState } from 'react'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input'
import { Shimmer } from '@/components/ai-elements/shimmer'
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion'
import { cacheView } from '#/app/trip-client'
import type { TripConfig } from '#/core/schema'
import { suggestionsFor } from '#/core/stage'
import type { TripView } from '#/core/view'
import type { AgentMode, AgentUIMessage } from '#/server/agent/harness'
import { askTools } from '#/server/agent/ask-tools'
import { Choices, ToolCard } from './cards'
import type { AgentPart, ChatContext, ToolPart } from './context'
import { ChatProvider, useChatContext } from './context'

/**
 * The agent: one conversation per trip, held above the screens so the sheet
 * can close without losing it and every tab sees the trip it updates.
 *
 * The server owns the trip and the conversation. The client sends only its
 * newest message (`prepareSendMessagesRequest`), and continues automatically
 * after a card answer or an approval (`sendAutomaticallyWhen`).
 */

const isTool = (p: AgentPart): p is ToolPart => p.type.startsWith('tool-')

const lastStep = (m: AgentUIMessage) => {
  const i = m.parts.reduce((at, p, j) => (p.type === 'step-start' ? j : at), -1)
  return m.parts.slice(i + 1)
}

/** Continue only after the user answered a card or an approval — never in a loop. */
const shouldContinue = ({ messages }: { messages: AgentUIMessage[] }) => {
  const last = messages.at(-1)
  if (!last || last.role !== 'assistant') return false
  if (lastAssistantMessageIsCompleteWithApprovalResponses({ messages }))
    return true
  const answered = lastStep(last).some(
    (p) =>
      isTool(p) &&
      (askTools as readonly string[]).includes(p.type.slice(5)) &&
      p.state === 'output-available',
  )
  return answered && lastAssistantMessageIsCompleteWithToolCalls({ messages })
}

export type Agent = ReturnType<typeof useAgent>

export const useAgent = ({
  config,
  tripId,
  initial,
}: {
  config: TripConfig
  tripId: string
  initial: { trip: TripView; messages: AgentUIMessage[] }
}) => {
  const [view, setView] = useState(initial.trip)
  const transport = useMemo(
    () =>
      new DefaultChatTransport<AgentUIMessage>({
        api: '/api/chat',
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: { tripId: id, message: messages.at(-1) },
        }),
      }),
    [],
  )
  const chat = useChat<AgentUIMessage>({
    id: tripId,
    messages: initial.messages,
    transport,
    sendAutomaticallyWhen: shouldContinue,
    onData: (part) => {
      if (part.type === 'data-trip') {
        setView(part.data)
        cacheView(part.data)
      }
    },
  })
  useEffect(() => cacheView(initial.trip), [initial.trip])

  const busy = chat.status === 'submitted' || chat.status === 'streaming'
  const send = (text: string) => {
    if (!text.trim() || busy) return
    chat.sendMessage({ text: text.trim() })
  }
  const mode: AgentMode | undefined = [...chat.messages]
    .reverse()
    .find((m) => m.metadata?.mode)?.metadata?.mode

  const context = (showTools: boolean): ChatContext => ({
    config,
    view,
    send,
    showTools,
    answer: (tool, toolCallId, output) =>
      chat.addToolOutput({
        tool: tool as never,
        toolCallId,
        output: output as never,
      }),
    approve: (id, approved) => chat.addToolApprovalResponse({ id, approved }),
    choose: (slot, value, say) => {
      if (busy) return
      chat.sendMessage({ text: say, metadata: { choice: { slot, value } } })
    },
  })

  return {
    config,
    view,
    /** Replace the trip after a change made outside the chat (profile, refresh). */
    setView: (next: TripView) => {
      setView(next)
      cacheView(next)
    },
    chat,
    busy,
    send,
    mode,
    context,
  }
}

export const AgentProvider = ({
  agent,
  showTools,
  children,
}: {
  agent: Agent
  showTools: boolean
  children: React.ReactNode
}) => <ChatProvider value={agent.context(showTools)}>{children}</ChatProvider>

/**
 * The conversation and the composer. `suggestions` are the chips of the
 * screen the sheet was opened from; the stage's own chips follow.
 */
export const ChatPanel = ({
  agent,
  suggestions = [],
}: {
  agent: Agent
  suggestions?: string[]
}) => {
  const { view } = useChatContext()
  const { messages, status, stop, error } = agent.chat
  const [input, setInput] = useState('')
  const last = messages.at(-1)
  // The open question of the latest message, if the app asked one.
  const open =
    last?.role === 'assistant'
      ? last.parts.find((p) => p.type === 'data-choices')?.data
      : undefined
  const chips = [...new Set([...suggestions, ...suggestionsFor[view.stage]])]
  const send = (text: string) => {
    agent.send(text)
    setInput('')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-2xl">
          {messages.map((m) => (
            <Message from={m.role} key={m.id}>
              <MessageContent className="w-full max-w-full">
                {m.parts.map((p, i) => {
                  const key = `${m.id}-${i}`
                  if (p.type === 'text')
                    return <MessageResponse key={key}>{p.text}</MessageResponse>
                  if (p.type === 'data-choices')
                    return (
                      <Choices
                        key={key}
                        prompt={p.data}
                        interactive={m === last && !agent.busy}
                      />
                    )
                  if (isTool(p))
                    return (
                      <ToolCard
                        key={key}
                        part={p}
                        interactive={
                          m === last && m.role === 'assistant' && !agent.busy
                        }
                      />
                    )
                  return null
                })}
              </MessageContent>
            </Message>
          ))}
          {status === 'submitted' && <Shimmer>생각하고 있어요…</Shimmer>}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              연결이 끊겼어요. 다시 보내 주세요.
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="border-t bg-background pb-safe">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 p-3">
          {!open && chips.length > 0 && (
            <div className="grid min-w-0 grid-cols-1">
              <Suggestions>
                {chips.map((s) => (
                  <Suggestion
                    key={s}
                    suggestion={s}
                    onClick={send}
                    disabled={agent.busy}
                  />
                ))}
              </Suggestions>
            </div>
          )}
          <PromptInput onSubmit={({ text }) => send(text)}>
            <PromptInputBody>
              <PromptInputTextarea
                value={input}
                onChange={(e) => setInput(e.currentTarget.value)}
                placeholder={open?.hint ?? '무엇이든 물어보세요'}
                maxLength={1000}
              />
            </PromptInputBody>
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit
                status={status}
                onStop={stop}
                disabled={!agent.busy && !input.trim()}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  )
}
