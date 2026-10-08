import type { UIMessage } from 'ai'
import { z } from 'zod'
import { slotIdSchema } from '#/core/schema'
import { planner } from '#/core/planner'
import { progressOptions } from '#/core/stage'
import type { TripConfig } from '#/core/schema'
import type { TripEvent, TripState } from '#/core/trip'
import { advance, restMore, skipStop, startReturn } from '#/core/trip'
import type { AskTool } from './tools'
import { askTools, progressAnswerSchema } from './tools'

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
  if (answer.tool === 'await_progress') {
    const a = progressAnswerSchema.safeParse(answer.output)
    if (!a.success) return []
    const it = planner(config)(state.plan, state.observations)
    // Only what the next-action card offers right now is accepted.
    if (!progressOptions(state, it).includes(a.data.event)) return []
    const command = {
      ARRIVED: () => advance(state, it),
      STOP_DONE: () => advance(state, it),
      AT_STATION: () => advance(state, it),
      SKIP: () => skipStop(state, it),
      REST: () => restMore(config, state),
      START_RETURN: () => startReturn(state, it),
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

const chipValueSchema = z.union([
  z.string().max(40),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string().max(40)).max(10),
])
const chipSchema = z.object({ slot: slotIdSchema, value: chipValueSchema })

/** A reply chip's answer, if the message carries a well-formed one. */
const chipAnswer = (metadata: unknown) => {
  const parsed = z.object({ choice: chipSchema }).safeParse(metadata)
  return parsed.success ? parsed.data.choice : undefined
}

/**
 * Merge what the client sent into the stored conversation.
 *
 * The client may only (a) add a user message made of text (optionally with
 * the value of the reply chip it came from), or (b) answer
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
    const choice = chipAnswer(incoming.metadata)
    return [
      ...stored,
      {
        id: incoming.id,
        role: 'user',
        parts: [{ type: 'text', text }],
        ...(choice && { metadata: { choice } }),
      },
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
