import type { UIMessage } from 'ai'
import { planner } from '#/core/planner'
import { progressOptions } from '#/core/stage'
import type { TripConfig } from '#/core/schema'
import type { TripEvent, TripState } from '#/core/trip'
import { advance, restMore, skipStop, startReturn } from '#/core/trip'
import type { AskTool } from './tools'
import {
  askTools,
  conditionAnswerSchema,
  progressAnswerSchema,
  tripBasicsSchema,
} from './tools'

/**
 * Card answers → trip events, deterministically.
 *
 * When the user fills a card, the answer arrives as the output of an Ask
 * tool call. The harness applies it before the model runs, so the model
 * never has to transcribe form values (and cannot alter them).
 */

type Part = UIMessage['parts'][number] & {
  toolCallId?: string
  state?: string
  output?: unknown
  approval?: { id: string; approved?: boolean; reason?: string }
}

export type Answer = { toolCallId: string; tool: AskTool; output: unknown }

const askName = (type: string): AskTool | null => {
  const name = type.startsWith('tool-') ? type.slice(5) : ''
  return (askTools as readonly string[]).includes(name)
    ? (name as AskTool)
    : null
}

/** Answers present in the conversation that have not been applied yet. */
export const pendingAnswers = (
  messages: ReadonlyArray<UIMessage>,
  ingested: ReadonlyArray<string>,
): Answer[] =>
  messages.flatMap((m) =>
    m.role !== 'assistant'
      ? []
      : (m.parts as Part[]).flatMap((p) => {
          const tool = askName(p.type)
          return tool &&
            p.state === 'output-available' &&
            p.toolCallId &&
            !ingested.includes(p.toolCallId)
            ? [{ toolCallId: p.toolCallId, tool, output: p.output }]
            : []
        }),
  )

/** Pure: one answer on the current state → the events it implies. */
export const answerToEvents = (
  config: TripConfig,
  state: TripState,
  answer: Answer,
): TripEvent[] => {
  if (answer.tool === 'ask_trip_basics') {
    const basics = tripBasicsSchema.safeParse(answer.output)
    if (!basics.success) return []
    const active = config.places.filter((p) => p.active).map((p) => p.id)
    return [
      {
        type: 'plan.patched',
        patch: {
          arrivalAt: basics.data.arrivalAt,
          trainTime: basics.data.trainTime,
          interests: basics.data.interests,
          origin: basics.data.origin,
          currentPlace: basics.data.origin,
          excluded: active.filter((id) => !basics.data.interests.includes(id)),
        },
      },
      { type: 'trip.created' },
    ]
  }
  if (answer.tool === 'ask_condition') {
    const a = conditionAnswerSchema.safeParse(answer.output)
    if (!a.success) return []
    return [
      { type: 'day.advanced', phase: 3 },
      {
        type: 'plan.patched',
        patch: {
          condition: a.data.condition,
          walkingLimit: a.data.walkingLimit,
          readyTime: a.data.readyTime,
          currentTime: a.data.readyTime,
          baggageCollected: a.data.baggageCollected,
        },
      },
    ]
  }
  if (answer.tool === 'await_progress') {
    const a = progressAnswerSchema.safeParse(answer.output)
    if (!a.success) return []
    const it = planner(config)(state.plan, state.observations)
    // Only what the next-action card offers right now is accepted.
    if (!progressOptions(state, it).includes(a.data.event)) return []
    const command = {
      ARRIVED: () => advance(config, state, it),
      STOP_DONE: () => advance(config, state, it),
      AT_STATION: () => advance(config, state, it),
      SKIP: () => skipStop(state, it),
      REST: () => restMore(config, state),
      START_RETURN: () => startReturn(state),
    }[a.data.event]()
    // Screen navigation belongs to the classic UI; the chat ignores it.
    return command.events.filter((e) => e.type !== 'screen.changed')
  }
  return []
}

/**
 * When the user types instead of answering open cards, settle those cards so
 * the conversation stays a valid sequence of tool calls and results.
 */
export const settleOpenCards = (messages: UIMessage[]): UIMessage[] => {
  if (messages.at(-1)?.role !== 'user') return messages
  return messages.map((m) =>
    m.role !== 'assistant'
      ? m
      : {
          ...m,
          parts: (m.parts as Part[]).map((p) => {
            if (!p.type.startsWith('tool-')) return p
            if (p.state === 'input-available' || p.state === 'input-streaming')
              return {
                ...p,
                state: 'output-available',
                output: { skipped: true },
              }
            if (p.state === 'approval-requested' && p.approval)
              return {
                ...p,
                state: 'output-denied',
                approval: {
                  ...p.approval,
                  approved: false,
                  reason: '사용자가 다른 요청을 보냈어요.',
                },
              }
            return p
          }) as UIMessage['parts'],
        },
  )
}

const userText = (message: UIMessage, maxChars: number) =>
  message.parts
    .flatMap((p) => (p.type === 'text' ? [p.text] : []))
    .join('\n')
    .trim()
    .slice(0, maxChars)

/**
 * Merge what the client sent into the stored conversation.
 *
 * The client may only (a) add a user message made of text, or (b) answer
 * the open cards and approvals of the latest assistant message. Everything
 * else in an incoming assistant message is ignored, so a client cannot
 * rewrite tool results or history.
 */
export const mergeIncoming = (
  stored: UIMessage[],
  incoming: UIMessage,
  maxChars = 1000,
): UIMessage[] => {
  if (incoming.role === 'user') {
    const text = userText(incoming, maxChars)
    if (!text || stored.some((m) => m.id === incoming.id)) return stored
    return [
      ...stored,
      { id: incoming.id, role: 'user', parts: [{ type: 'text', text }] },
    ]
  }
  const last = stored.at(-1)
  if (!last || last.role !== 'assistant' || last.id !== incoming.id)
    return stored
  const answers = new Map(
    (incoming.parts as Part[]).flatMap((p) =>
      p.toolCallId ? [[p.toolCallId, p] as const] : [],
    ),
  )
  const parts = (last.parts as Part[]).map((p) => {
    const answer = p.toolCallId ? answers.get(p.toolCallId) : undefined
    if (!answer) return p
    if (
      askName(p.type) &&
      p.state === 'input-available' &&
      answer.state === 'output-available'
    )
      return { ...p, state: 'output-available', output: answer.output }
    if (
      p.state === 'approval-requested' &&
      answer.state === 'approval-responded' &&
      p.approval &&
      answer.approval?.id === p.approval.id
    )
      return {
        ...p,
        state: 'approval-responded',
        approval: {
          ...answer.approval,
          approved: answer.approval.approved === true,
        },
      }
    return p
  })
  return [
    ...stored.slice(0, -1),
    { ...last, parts: parts as UIMessage['parts'] },
  ]
}
