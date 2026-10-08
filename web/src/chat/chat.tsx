import { useChat } from '@ai-sdk/react'
import { Link } from '@tanstack/react-router'
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai'
import { Activity, Ellipsis, Info, MessageCircle } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cacheView, newTripId } from '#/app/trip-client'
import type { TripConfig } from '#/core/schema'
import type { Stage } from '#/core/stage'
import { suggestionsFor } from '#/core/stage'
import { courseById, departLabel, hubOf } from '#/core/route'
import { clock } from '#/core/time'
import type { TripView } from '#/core/view'
import type { AgentMode, AgentUIMessage } from '#/server/agent/harness'
import { askTools } from '#/server/agent/ask-tools'
import { RaceLive } from '#/race/live'
import { RaceOverview } from '#/race/overview'
import { Choices, ToolCard } from './cards'
import type { AgentPart, ToolPart } from './context'
import { ChatProvider } from './context'

/**
 * The chat is the app. Every step of the day — making the trip, checking in
 * after the race, choosing and changing the course, travelling — is a turn
 * with the agent; forms appear as cards inside the conversation.
 *
 * The server owns the trip and the conversation. The client sends only its
 * newest message (`prepareSendMessagesRequest`), and continues automatically
 * after a card answer or an approval (`sendAutomaticallyWhen`).
 */

const stageLabel: Record<Stage, string> = {
  ONBOARDING: '일정 만들기',
  PRE_RACE: '대회 전',
  CHECK_IN: '완주 후',
  PLANNING: '코스 고르기',
  JOURNEY: '이동 중',
  SAFETY: '안전 우선',
  DONE: '도착',
}

const modeLabel: Record<AgentMode, string> = {
  OPENAI: 'AI',
  DEMO: '규칙 모델',
  FALLBACK: '규칙 모델(대체)',
}

type Tab = 'chat' | 'overview' | 'race'

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

const Header = ({
  config,
  view,
  mode,
  send,
  busy,
  tab,
}: {
  config: TripConfig
  view: TripView
  mode: AgentMode | undefined
  send: (text: string) => void
  busy: boolean
  tab: Tab
}) => {
  const { plan } = view.state
  const it = view.itinerary
  return (
    <header className="sticky top-0 z-30 border-b bg-background pt-safe">
      <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4">
        <span className="font-semibold">RUN2포항</span>
        <Badge variant="secondary">{stageLabel[view.stage]}</Badge>
        {mode && <Badge variant="outline">{modeLabel[mode]}</Badge>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="ml-auto"
              aria-label="메뉴"
            >
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={busy}>
                  시연 조건
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuLabel>
                    채팅으로 /시연 명령을 보내요
                  </DropdownMenuLabel>
                  {config.scenarios.map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      onSelect={() => send(`/시연 ${s.title}`)}
                    >
                      {s.title}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem asChild>
                <Link to="/classic">화면으로 보기</Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                newTripId()
                window.location.reload()
              }}
            >
              새 여정 시작
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mx-auto max-w-2xl px-4 pb-2">
        <TabsList className="w-full">
          <TabsTrigger value="chat">
            <MessageCircle />
            채팅
          </TabsTrigger>
          <TabsTrigger value="overview">
            <Info />
            대회 개요
          </TabsTrigger>
          <TabsTrigger value="race">
            <Activity />
            레이스
          </TabsTrigger>
        </TabsList>
      </div>
      {tab === 'chat' && view.state.created && (
        <p className="mx-auto max-w-2xl px-4 pb-2 text-xs text-muted-foreground tabular-nums">
          {departLabel(config, plan)}
          {courseById(config, it.course) &&
            it.stops.length > 0 &&
            ` · ${courseById(config, it.course)!.area}`}
          {it.planningArrival !== null &&
            ` · ${hubOf(config, plan).name} ${clock(it.planningArrival)} 도착 (계획)`}
          {plan.completed.length > 0 && ` · ${plan.completed.length}곳 다녀옴`}
        </p>
      )}
    </header>
  )
}

export const Chat = ({
  config,
  tripId,
  initial,
}: {
  config: TripConfig
  tripId: string
  initial: { trip: TripView; messages: AgentUIMessage[] }
}) => {
  const [view, setView] = useState(initial.trip)
  const [input, setInput] = useState('')
  const [tab, setTab] = useState<Tab>('chat')
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
  const {
    messages,
    sendMessage,
    addToolOutput,
    addToolApprovalResponse,
    status,
    stop,
    error,
  } = useChat<AgentUIMessage>({
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

  const busy = status === 'submitted' || status === 'streaming'
  const send = (text: string) => {
    if (!text.trim() || busy) return
    sendMessage({ text: text.trim() })
    setInput('')
  }
  const last = messages.at(-1)
  const mode = [...messages].reverse().find((m) => m.metadata?.mode)
    ?.metadata?.mode
  // The open question of the latest message, if the app asked one.
  const open =
    last?.role === 'assistant'
      ? last.parts.find((p) => p.type === 'data-choices')?.data
      : undefined

  return (
    <ChatProvider
      value={{
        config,
        view,
        send,
        answer: (tool, toolCallId, output) =>
          addToolOutput({
            tool: tool as never,
            toolCallId,
            output: output as never,
          }),
        approve: (id, approved) => addToolApprovalResponse({ id, approved }),
        choose: (slot, value, say) => {
          if (busy) return
          sendMessage({ text: say, metadata: { choice: { slot, value } } })
          setInput('')
        },
      }}
    >
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        className="h-dvh gap-0"
      >
        <Header
          config={config}
          view={view}
          mode={mode}
          send={send}
          busy={busy}
          tab={tab}
        />
        {/* Kept mounted so a streaming reply and the scroll position survive a tab switch. */}
        <TabsContent
          value="chat"
          forceMount
          className="flex min-h-0 flex-col data-[state=inactive]:hidden"
        >
          <Conversation className="min-h-0 flex-1">
            <ConversationContent className="mx-auto w-full max-w-2xl">
              {messages.map((m) => (
                <Message from={m.role} key={m.id}>
                  <MessageContent className="w-full max-w-full">
                    {m.parts.map((p, i) => {
                      const key = `${m.id}-${i}`
                      if (p.type === 'text')
                        return (
                          <MessageResponse key={key}>{p.text}</MessageResponse>
                        )
                      if (p.type === 'data-choices')
                        return (
                          <Choices
                            key={key}
                            prompt={p.data}
                            interactive={m === last && !busy}
                          />
                        )
                      if (isTool(p))
                        return (
                          <ToolCard
                            key={key}
                            part={p}
                            interactive={
                              m === last && m.role === 'assistant' && !busy
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
              {!open && suggestionsFor[view.stage].length > 0 && (
                <div className="grid min-w-0 grid-cols-1">
                  <Suggestions>
                    {suggestionsFor[view.stage].map((s) => (
                      <Suggestion
                        key={s}
                        suggestion={s}
                        onClick={send}
                        disabled={busy}
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
                    placeholder={open?.hint ?? '무엇이든 말해 주세요'}
                    maxLength={1000}
                  />
                </PromptInputBody>
                <PromptInputFooter className="justify-end">
                  <PromptInputSubmit
                    status={status}
                    onStop={stop}
                    disabled={!busy && !input.trim()}
                  />
                </PromptInputFooter>
              </PromptInput>
            </div>
          </div>
        </TabsContent>
        <TabsContent
          value="overview"
          className="min-h-0 overflow-y-auto pb-safe"
        >
          <RaceOverview event={config.event} />
        </TabsContent>
        <TabsContent
          value="race"
          forceMount
          className="min-h-0 overflow-y-auto pb-safe data-[state=inactive]:hidden"
        >
          <RaceLive />
        </TabsContent>
      </Tabs>
    </ChatProvider>
  )
}
