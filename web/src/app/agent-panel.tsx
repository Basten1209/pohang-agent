import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Check, RotateCcw, Sparkles, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '#/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
  MessageResponse,
} from '#/components/ai-elements/message'
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from '#/components/ai-elements/prompt-input'
import { Shimmer } from '#/components/ai-elements/shimmer'
import { Suggestion, Suggestions } from '#/components/ai-elements/suggestion'
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '#/components/ai-elements/tool'
import { Alert, AlertDescription } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import type { Preview } from '#/core/preview'
import { clock } from '#/core/time'
import { applyPreview } from '#/core/trip'
import type { AgentMetadata, AgentUIMessage } from '#/server/agent/agent'
import { useApp } from './context'

const toolTitles: Record<string, string> = {
  get_plan_context: '현재 일정과 이유 조회',
  refresh_trip_context: '디지털 트윈 연결 확인',
  compare_transport: '역 복귀 이동수단 비교',
  preview_itinerary: '변경 일정 미리보기',
}

const modeLabel = (meta?: AgentMetadata) =>
  !meta
    ? null
    : meta.mode === 'OPENAI'
      ? `OpenAI · ${meta.model ?? ''} · 도구 실행`
      : meta.mode === 'DEMO'
        ? '시연 응답 · 정해진 요청 해석'
        : 'AI 연결 실패 · 정형 응답'

/** The plan-change preview the agent produced, with an explicit apply step. */
const PreviewCard = ({ preview }: { preview: Preview }) => {
  const { state, run, config } = useApp()
  const stale = preview.revision !== state.plan.revision
  const it = preview.itinerary
  const names = it.stops
    .map((s) => config.places.find((p) => p.id === s.id)?.attrs.short ?? s.id)
    .join(' → ')
  return (
    <Card className="gap-2 border-harbor/40 bg-harbor/5 py-3">
      <CardContent className="space-y-2 px-3">
        <Badge variant="outline" className="border-harbor/50 text-harbor">
          변경 미리보기 · 아직 적용 전
        </Badge>
        <p className="text-sm font-bold text-primary">
          {names || '관광 없이 귀가'}
        </p>
        <p className="text-xs text-muted-foreground">
          계획상 역 도착{' '}
          <strong className="text-primary">
            {it.planningArrival !== null
              ? clock(it.planningArrival)
              : '확인 필요'}
          </strong>{' '}
          · 목표 {clock(it.stationTarget)}
        </p>
        <Button
          size="sm"
          className="w-full"
          disabled={stale}
          onClick={() => run(applyPreview(state, preview))}
        >
          {stale ? '조건이 바뀌어 다시 요청이 필요해요' : '이 변경 적용하기'}{' '}
          <Check />
        </Button>
      </CardContent>
    </Card>
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
          return noticed ? null : (
            <MessageResponse key={key}>{part.text}</MessageResponse>
          )
        if (part.type === 'data-notice')
          return (
            <Alert
              key={key}
              variant={part.data.kind === 'medical' ? 'destructive' : 'default'}
            >
              <TriangleAlert />
              <AlertDescription>{part.data.message}</AlertDescription>
            </Alert>
          )
        if (isToolPart(part)) {
          const name = part.type.slice(5)
          return (
            <div key={key} className="space-y-2">
              {part.type === 'tool-preview_itinerary' &&
                part.state === 'output-available' && (
                  <PreviewCard preview={part.output as Preview} />
                )}
              <Tool className="mb-0 bg-card">
                <ToolHeader
                  type={part.type}
                  state={part.state}
                  title={toolTitles[name] ?? name}
                />
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
 * the current plan and observations; the reply's previews are applied only
 * through `applyPreview`, which rejects stale revisions.
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
  const { messages, sendMessage, status, setMessages, stop } =
    useChat<AgentUIMessage>({
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
        const compared = message.parts.some(
          (p) =>
            p.type === 'tool-compare_transport' &&
            p.state === 'output-available',
        )
        if (compared) open('taxi')
      },
    })
  const busy = status === 'submitted' || status === 'streaming'
  const ask = (text: string) => {
    if (!text.trim() || busy) return
    sendMessage({ text: text.trim() })
    setInput('')
  }
  const last = messages.at(-1)

  return (
    <Card className="gap-3 py-4">
      <CardContent className="space-y-3 px-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lime text-lime-foreground">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-primary">
              여행도, 내 페이스대로
            </p>
            <p className="text-xs text-muted-foreground">
              기차 시간이 바뀌었나요? 지금 계획에서 바로 조정해 드릴게요.
            </p>
          </div>
          {messages.length > 0 && (
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label="대화 지우기"
              onClick={() => setMessages([])}
            >
              <RotateCcw className="size-4" />
            </Button>
          )}
        </div>

        {messages.length > 0 && (
          <Conversation className="max-h-[420px] rounded-xl border bg-secondary/40">
            <ConversationContent className="gap-4 p-3">
              {messages.map((m) => (
                <Message from={m.role} key={m.id}>
                  <MessageContent className="text-sm">
                    {m.role === 'assistant' && modeLabel(m.metadata) && (
                      <Badge
                        variant="secondary"
                        className="mb-1 text-[10px] font-medium"
                      >
                        {modeLabel(m.metadata)}
                      </Badge>
                    )}
                    <Parts message={m} />
                  </MessageContent>
                </Message>
              ))}
              {busy && last?.role === 'user' && (
                <Shimmer className="text-sm">
                  현재 조건을 확인하고 있어요…
                </Shimmer>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        )}

        <Suggestions>
          {config.agent.suggestions.map((s) => (
            <Suggestion key={s} suggestion={s} onClick={ask} disabled={busy} />
          ))}
        </Suggestions>

        <PromptInput onSubmit={({ text }) => ask(text)} className="rounded-xl">
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              placeholder="이 여행에 대해 물어보세요"
              maxLength={1000}
              className="min-h-11 text-base sm:text-sm"
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
      </CardContent>
    </Card>
  )
}
