import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { CircleAlert, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/components/ui/item'
import type { Preview } from '#/core/preview'
import { clock } from '#/core/time'
import { applyPreview } from '#/core/trip'
import type { AgentMetadata, AgentUIMessage } from '#/server/agent/agent'
import { useApp } from './context'

const toolTitles: Record<string, string> = {
  get_plan_context: '현재 일정 조회',
  refresh_trip_context: '디지털 트윈 연결 확인',
  compare_transport: '이동수단 비교',
  preview_itinerary: '변경 일정 계산',
}

const modeLabel = (meta?: AgentMetadata) =>
  !meta
    ? null
    : meta.mode === 'OPENAI'
      ? `OpenAI · ${meta.model ?? ''}`
      : meta.mode === 'DEMO'
        ? '시연 응답'
        : 'AI 연결 실패 · 정형 응답'

/** The plan-change preview the agent produced, applied only on explicit confirmation. */
const PreviewItem = ({ preview }: { preview: Preview }) => {
  const { state, run, config } = useApp()
  const stale = preview.revision !== state.plan.revision
  const it = preview.itinerary
  const names = it.stops
    .map((s) => config.places.find((p) => p.id === s.id)?.attrs.short ?? s.id)
    .join(' → ')
  return (
    <Item variant="outline" size="sm">
      <ItemContent>
        <ItemTitle>{names || '관광 없이 귀가'}</ItemTitle>
        <ItemDescription>
          미리보기 · 역 도착{' '}
          {it.planningArrival !== null ? clock(it.planningArrival) : '확인 필요'} (목표{' '}
          {clock(it.stationTarget)})
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button size="sm" disabled={stale} onClick={() => run(applyPreview(state, preview))}>
          {stale ? '만료됨' : '적용'}
        </Button>
      </ItemActions>
    </Item>
  )
}

type AgentPart = AgentUIMessage['parts'][number]
type AgentToolPart = Extract<AgentPart, { type: `tool-${string}` }>
const isToolPart = (part: AgentPart): part is AgentToolPart =>
  part.type.startsWith('tool-')

const Parts = ({ message }: { message: AgentUIMessage }) => {
  // A notice already says it; don't repeat the same sentence as text.
  const noticed = message.parts.some((p) => p.type === 'data-notice')
  return (
    <>
      {message.parts.map((part, i) => {
        const key = `${message.id}-${i}`
        if (part.type === 'text')
          return noticed ? null : <MessageResponse key={key}>{part.text}</MessageResponse>
        if (part.type === 'data-notice')
          return (
            <Alert key={key} variant={part.data.kind === 'medical' ? 'destructive' : 'default'}>
              <CircleAlert />
              <AlertDescription>{part.data.message}</AlertDescription>
            </Alert>
          )
        if (isToolPart(part)) {
          const name = part.type.slice(5)
          return (
            <div key={key} className="flex flex-col gap-2">
              {part.type === 'tool-preview_itinerary' && part.state === 'output-available' && (
                <PreviewItem preview={part.output as Preview} />
              )}
              <Tool>
                <ToolHeader type={part.type} state={part.state} title={toolTitles[name] ?? name} />
                <ToolContent>
                  <ToolInput input={part.input} />
                  <ToolOutput output={part.output} errorText={part.errorText} />
                </ToolContent>
              </Tool>
            </div>
          )
        }
        return null
      })}
    </>
  )
}

/**
 * The trip assistant: AI Elements on top of `useChat`. Every request carries
 * the current plan and observations; previews apply only through
 * `applyPreview`, which rejects stale revisions.
 */
export const AgentPanel = () => {
  const { latest, run, open, config } = useApp()
  const [input, setInput] = useState('')
  const transport = useMemo(
    () =>
      new DefaultChatTransport<AgentUIMessage>({
        api: '/api/chat',
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages: messages.slice(-6),
            plan: latest.current.plan,
            observations: latest.current.observations,
          },
        }),
      }),
    [latest],
  )
  const { messages, sendMessage, status, setMessages, stop } = useChat<AgentUIMessage>({
    transport,
    onData: (part) => {
      if (part.type === 'data-notice' && part.data.kind === 'medical')
        run({
          events: [
            { type: 'plan.patched', patch: { condition: 'UNWELL' } },
            { type: 'screen.changed', screen: 'finish' },
          ],
        })
    },
    onFinish: ({ message }) => {
      if (
        message.parts.some(
          (p) => p.type === 'tool-compare_transport' && p.state === 'output-available',
        )
      )
        open('taxi')
    },
  })
  const busy = status === 'submitted' || status === 'streaming'
  const ask = (text: string) => {
    if (!text.trim() || busy) return
    sendMessage({ text: text.trim() })
    setInput('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>여행 도우미</CardTitle>
        <CardDescription>열차 시각 변경, 걷기 조건, 코스 이유를 물어보세요.</CardDescription>
        {messages.length > 0 && (
          <CardAction>
            <Button size="icon" variant="ghost" aria-label="대화 지우기" onClick={() => setMessages([])}>
              <RotateCcw />
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {messages.length > 0 && (
          <Conversation className="max-h-[420px] rounded-lg border">
            <ConversationContent>
              {messages.map((m) => (
                <Message from={m.role} key={m.id}>
                  <MessageContent>
                    {m.role === 'assistant' && modeLabel(m.metadata) && (
                      <Badge variant="secondary">{modeLabel(m.metadata)}</Badge>
                    )}
                    <Parts message={m} />
                  </MessageContent>
                </Message>
              ))}
              {busy && messages.at(-1)?.role === 'user' && <Shimmer>확인하고 있어요…</Shimmer>}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        )}
        <Suggestions>
          {config.agent.suggestions.map((s) => (
            <Suggestion key={s} suggestion={s} onClick={ask} disabled={busy} />
          ))}
        </Suggestions>
        <PromptInput onSubmit={({ text }) => ask(text)}>
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              placeholder="이 여행에 대해 물어보세요"
              maxLength={1000}
            />
          </PromptInputBody>
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !input.trim()} />
          </PromptInputFooter>
        </PromptInput>
      </CardContent>
    </Card>
  )
}
