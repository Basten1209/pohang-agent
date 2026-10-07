import type { LanguageModelV4 } from '@ai-sdk/provider'
import type { InferUITools, UIMessage, UIMessageChunk } from 'ai'
import {
  ToolLoopAgent,
  addToolInputExamplesMiddleware,
  convertToModelMessages,
  createUIMessageStream,
  isStepCount,
  toUIMessageStream,
  wrapLanguageModel,
} from 'ai'
import { createHash } from 'node:crypto'
import type { Evidence } from '#/core/evidence'
import { isReadOnly, mentionsSymptom } from '#/core/intents'
import type { TripConfig } from '#/core/schema'
import type { Stage } from '#/core/stage'
import { stageOf } from '#/core/stage'
import type { TripView } from '#/core/view'
import { tripView } from '#/core/view'
import type { Db } from '../db/client'
import type { TripRecord } from '../trips'
import { commit, openTrip, rememberPreview, saveConversation } from '../trips'
import {
  answerToEvents,
  mergeIncoming,
  pendingAnswers,
  settleOpenCards,
} from './ingest'
import {
  baseInstructions,
  commitTools,
  entryLine,
  snapshot,
  stageInstructions,
  stageTools,
} from './prompts'
import { scriptedModel, withFallback } from './scripted-model'
import type { AgentTools, AskTool, ToolName, TurnContext } from './tools'
import { askTools, makeTools } from './tools'

/**
 * One conversational turn, end to end:
 *
 *   merge incoming message → settle skipped cards → apply card answers
 *   → safety gate → ToolLoopAgent (stage-gated tools, forced tools, approvals)
 *   → append the card the stage needs → persist conversation
 *
 * The same harness runs with OpenAI or with the rule-based model; only the
 * model differs.
 */

export type { TripView }
export { tripView }

export type AgentMode = 'OPENAI' | 'DEMO' | 'FALLBACK'
export type AgentMetadata = { mode: AgentMode; stage: Stage; revision: number }
export type AgentData = { trip: TripView }
export type AgentUIMessage = UIMessage<
  AgentMetadata,
  AgentData,
  InferUITools<AgentTools>
>

export type HarnessDeps = {
  config: TripConfig
  db: Db
  model: LanguageModelV4 | null
  observe: () => Promise<Evidence[]>
}

/** Signs approvals so a client cannot fabricate one (stable across instances). */
const approvalSecret = () =>
  createHash('sha256')
    .update(
      `run2-approvals:${process.env.AGENT_APPROVAL_SECRET ?? process.env.OPENAI_API_KEY ?? 'demo'}`,
    )
    .digest('hex')

const emptyPrefill = {
  prefill: { arrivalAt: null, trainTime: null, interests: null },
}

/** The first message of every trip: a greeting and the basics card. */
export const openingMessages = (): AgentUIMessage[] => [
  {
    id: `m_${crypto.randomUUID()}`,
    role: 'assistant',
    metadata: { mode: 'DEMO', stage: 'ONBOARDING', revision: 0 },
    parts: [
      {
        type: 'text',
        text: '안녕하세요! 완주 후 구룡포에 들렀다 열차 시간 전에 돌아오는 일정을 같이 짤게요. 먼저 포항 일정을 알려주세요.',
      },
      {
        type: 'tool-ask_trip_basics',
        toolCallId: `h_${crypto.randomUUID()}`,
        state: 'input-available',
        input: emptyPrefill,
      },
    ],
  },
]

/** The card each stage keeps open, appended by the harness if the agent did not. */
const standingCard: Partial<Record<Stage, AskTool>> = {
  ONBOARDING: 'ask_trip_basics',
  CHECK_IN: 'ask_condition',
  JOURNEY: 'await_progress',
}

const lastUserText = (messages: AgentUIMessage[]) =>
  [...messages]
    .reverse()
    .find((m) => m.role === 'user')
    ?.parts.flatMap((p) => (p.type === 'text' ? [p.text] : []))
    .join(' ')
    .trim() ?? ''

const calledInTurn = (
  steps: ReadonlyArray<{ toolCalls: ReadonlyArray<{ toolName: string }> }>,
  name: ToolName,
): boolean => steps.some((s) => s.toolCalls.some((c) => c.toolName === name))

type StepLike = {
  toolCalls: ReadonlyArray<{ toolName: string }>
  toolResults: ReadonlyArray<{ toolName: string; output: unknown }>
}

/** The previous step produced a change preview that has not been proposed yet. */
const previewAwaitingProposal = (steps: ReadonlyArray<StepLike>) =>
  (steps.at(-1)?.toolResults ?? []).some(
    (r) =>
      r.toolName === 'plan_course' &&
      (r.output as { isChange?: boolean } | undefined)?.isChange === true,
  ) && !calledInTurn(steps, 'apply_plan_change')

/** Which tool, if any, the harness forces at this step. */
const forcedTool = (
  stage: Stage,
  enteredThisTurn: boolean,
  stepNumber: number,
  steps: ReadonlyArray<StepLike>,
  canCommit: boolean,
): ToolName | null => {
  const once = (name: ToolName) => (calledInTurn(steps, name) ? null : name)
  // A previewed change is always put to the user as an approval card.
  if (canCommit && previewAwaitingProposal(steps)) return 'apply_plan_change'
  if (stage === 'ONBOARDING') return stepNumber === 0 ? 'ask_trip_basics' : null
  if (stage === 'CHECK_IN') return once('ask_condition')
  if (stage === 'SAFETY') return once('show_safety_help')
  if (stage === 'DONE') return once('summarize_trip')
  if (stage === 'PLANNING' && enteredThisTurn) return once('plan_course')
  return null
}

export const runTurn = async (
  deps: HarnessDeps,
  input: { tripId: string; message: AgentUIMessage },
): Promise<ReadableStream<UIMessageChunk>> => {
  const { config, db } = deps
  let record: TripRecord = await openTrip(
    db,
    config,
    input.tripId,
    openingMessages,
  )
  const messages = settleOpenCards(
    mergeIncoming(record.messages as AgentUIMessage[], input.message),
  ) as AgentUIMessage[]
  const stageAtStart = stageOf(record.state)
  const pending = pendingAnswers(messages, record.meta.ingested)

  // An assistant message that answers nothing new needs no model call.
  if (
    input.message.role === 'assistant' &&
    !pending.length &&
    JSON.stringify(messages) === JSON.stringify(record.messages)
  )
    return createUIMessageStream<AgentUIMessage>({
      originalMessages: messages,
      execute: ({ writer }) => {
        writer.write({
          type: 'data-trip',
          data: tripView(config, record.state),
          transient: true,
        })
      },
    })

  // Card answers are applied deterministically, before any model call.
  for (const answer of pending) {
    record = await commit(
      db,
      record,
      answerToEvents(config, record.state, answer),
      {
        source: 'card',
        tool: answer.tool,
        toolCallId: answer.toolCallId,
      },
    )
    record = {
      ...record,
      meta: {
        ...record.meta,
        ingested: [...record.meta.ingested, answer.toolCallId],
      },
    }
  }
  // Persist the merged conversation now, so an answer is never applied twice.
  await saveConversation(db, { id: record.id, messages, meta: record.meta })

  // Safety gate: a symptom stops the trip without asking any model.
  const text = lastUserText(messages)
  if (mentionsSymptom(text) && record.state.plan.condition !== 'UNWELL')
    record = await commit(
      db,
      record,
      [{ type: 'plan.patched', patch: { condition: 'UNWELL' } }],
      { source: 'safety-gate' },
    )

  let current = record
  const ctx: TurnContext = {
    config,
    trip: () => current,
    commit: async (events, source) => {
      current = await commit(db, current, events, { source })
      return current
    },
    remember: (preview) => {
      current = { ...current, meta: rememberPreview(current.meta, preview) }
    },
    observe: deps.observe,
    newId: () => `pv_${crypto.randomUUID().slice(0, 8)}`,
  }
  const tools = makeTools(ctx)

  const stageAfterIngest = stageOf(current.state)
  let mode: AgentMode = deps.model ? 'OPENAI' : 'DEMO'
  const model: LanguageModelV4 =
    !deps.model || stageAfterIngest === 'SAFETY'
      ? scriptedModel()
      : withFallback(
          wrapLanguageModel({
            model: deps.model,
            middleware: addToolInputExamplesMiddleware(),
          }) as LanguageModelV4,
          scriptedModel(),
          (served) => {
            mode = served
          },
        )
  if (deps.model && stageAfterIngest === 'SAFETY') mode = 'DEMO'

  const readOnly = isReadOnly(text)
  const demoCommand = text.startsWith('/시연')
  const activeFor = (stage: Stage): ToolName[] => [
    ...stageTools[stage].filter((t) => !(readOnly && commitTools.includes(t))),
    ...(demoCommand ? (['set_demo_observation'] as ToolName[]) : []),
  ]

  const agent = new ToolLoopAgent({
    model,
    tools,
    instructions: baseInstructions,
    stopWhen: isStepCount(config.agent.maxSteps + 2),
    maxOutputTokens: config.agent.maxOutputTokens,
    maxRetries: 0,
    experimental_toolApprovalSecret: approvalSecret(),
    toolApproval: {
      // Model-proposed plan changes are always confirmed by the user.
      apply_plan_change: 'user-approval',
      // Starting the journey is automatic when the user just said so.
      start_journey: () =>
        /이 코스로|갈게|출발할게|좋아요/.test(text)
          ? 'approved'
          : 'user-approval',
    },
    providerOptions: { openai: { store: false, parallelToolCalls: false } },
    prepareStep: ({ stepNumber, steps }) => {
      const stage = stageOf(current.state)
      const active = activeFor(stage)
      const forced = forcedTool(
        stage,
        stage !== stageAtStart,
        stepNumber,
        steps,
        active.includes('apply_plan_change'),
      )
      return {
        activeTools: active,
        toolChoice: forced ? { type: 'tool', toolName: forced } : 'auto',
        instructions: [
          baseInstructions,
          stageInstructions[stage],
          snapshot(config, current.state, stage),
        ].join('\n\n'),
      }
    },
  })

  const meta = (): AgentMetadata => ({
    mode,
    stage: stageOf(current.state),
    revision: current.state.plan.revision,
  })

  return createUIMessageStream<AgentUIMessage>({
    originalMessages: messages,
    execute: async ({ writer }) => {
      writer.write({ type: 'start', messageMetadata: meta() })
      const entry =
        stageAfterIngest !== stageAtStart
          ? entryLine[stageAfterIngest]
          : undefined
      if (entry) {
        writer.write({ type: 'text-start', id: 'entry' })
        writer.write({ type: 'text-delta', id: 'entry', delta: entry })
        writer.write({ type: 'text-end', id: 'entry' })
      }

      const asked = new Set<string>()
      let awaitingApproval = false
      const result = await agent.stream({
        messages: await convertToModelMessages(messages, { tools }),
      })
      const ui = toUIMessageStream({
        stream: result.stream,
        tools,
        sendStart: false,
        sendFinish: false,
        onError: () => '응답 중 문제가 생겼어요. 다시 말씀해 주세요.',
      }) as ReadableStream<UIMessageChunk>
      for await (const chunk of ui) {
        if (chunk.type === 'tool-input-available') asked.add(chunk.toolName)
        if (chunk.type === 'tool-approval-request' && !chunk.isAutomatic)
          awaitingApproval = true
        writer.write(chunk as never)
      }

      // Keep the card the stage needs open, unless the agent already asked something.
      const stage = stageOf(current.state)
      const card = standingCard[stage]
      if (card && !askTools.some((t) => asked.has(t)) && !awaitingApproval)
        writer.write({
          type: 'tool-input-available',
          toolCallId: `h_${crypto.randomUUID()}`,
          toolName: card,
          input: card === 'ask_trip_basics' ? emptyPrefill : {},
        })

      writer.write({
        type: 'data-trip',
        data: tripView(config, current.state),
        transient: true,
      })
      writer.write({ type: 'finish', messageMetadata: meta() })
    },
    onEnd: async ({ messages: final }) => {
      await saveConversation(db, {
        id: current.id,
        messages: final,
        meta: current.meta,
      })
    },
    onError: () => '응답을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  })
}
