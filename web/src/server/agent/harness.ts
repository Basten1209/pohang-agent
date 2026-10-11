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
import { asksInfo, isReadOnly, mentionsSymptom } from '#/core/intents'
import type { SlotId, TripConfig } from '#/core/schema'
import type { ChoicePrompt } from '#/core/slots'
import { choiceValue, fillSlots, pendingSlot, promptFor } from '#/core/slots'
import type { Stage } from '#/core/stage'
import { stageOf } from '#/core/stage'
import type { TripView } from '#/core/view'
import { tripView } from '#/core/view'
import type { Db } from '../db/client'
import type { TripRecord } from '../trips'
import { syncLive } from '../live'
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
 *   → apply a reply chip → safety gate
 *   → (chip answer that needs no reasoning) the app answers by itself
 *   → otherwise ToolLoopAgent (stage-gated tools, forced tools, approvals)
 *   → append the next question with its chips, or the card the stage needs
 *   → persist conversation
 *
 * The same harness runs with OpenAI or with the rule-based model; only the
 * model differs.
 */

export type { TripView }
export { tripView }

export type AgentMode = 'OPENAI' | 'DEMO' | 'FALLBACK'
/** A reply chip tapped by the user, sent with the chip's text. */
export type ChipAnswer = {
  slot: SlotId
  value: string | number | boolean | null | string[]
}
/** Assistant messages carry mode/stage/revision; user messages may carry a chip answer. */
export type AgentMetadata = {
  mode?: AgentMode
  stage?: Stage
  revision?: number
  choice?: ChipAnswer
}
export type PlanProgress = {
  phase: 'OBSERVE' | 'PLAN' | 'EXPLAIN'
  nickname: string
  checks?: { label: string; ok: boolean }[]
}
export type AgentData = {
  trip: TripView
  choices: ChoicePrompt
  progress: PlanProgress
}
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

const textParts = (...texts: (string | undefined)[]) =>
  texts
    .filter((t): t is string => !!t)
    .map((text) => ({ type: 'text' as const, text }))

/** The first message of every trip: a greeting (the profile form asks the rest). */
export const openingFor = (_config: TripConfig) => (): AgentUIMessage[] => [
  {
    id: `m_${crypto.randomUUID()}`,
    role: 'assistant',
    metadata: { mode: 'DEMO', stage: 'ONBOARDING', revision: 0 },
    parts: [
      // The profile form collects the trip details; the chat starts open-ended.
      ...textParts(
        '안녕하세요! 대회 코스·준비물·맛집·버스처럼 궁금한 건 언제든 물어보세요. 완주하면 그때 컨디션에 맞춰 코스를 다시 계산해 드려요.',
      ),
    ],
  },
]

/** The card each stage keeps open, appended by the harness if the agent did not. */
const standingCard: Partial<Record<Stage, AskTool>> = {
  JOURNEY: 'await_progress',
}

/** Stages where a chip answer is handled by the app alone, without a model. */
const answeredByApp: Stage[] = ['ONBOARDING', 'CHECK_IN', 'PRE_RACE']

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
  extract: boolean,
): ToolName | null => {
  const once = (name: ToolName) => (calledInTurn(steps, name) ? null : name)
  // A previewed change is always put to the user as an approval card.
  if (canCommit && previewAwaitingProposal(steps)) return 'apply_plan_change'
  // Free text while collecting details: always try to read details from it.
  if (
    (stage === 'ONBOARDING' || stage === 'CHECK_IN') &&
    stepNumber === 0 &&
    extract
  )
    return 'update_trip_details'
  if (stage === 'SAFETY') return once('show_safety_help')
  if (stage === 'DONE') return once('summarize_trip')
  if (stage === 'PLANNING' && enteredThisTurn) return once('plan_course')
  return null
}

type Writer = {
  write: (chunk: UIMessageChunk<AgentMetadata, AgentData>) => void
}

const say = (writer: Writer, text: string) => {
  const id = `t_${crypto.randomUUID()}`
  writer.write({ type: 'text-start', id })
  writer.write({ type: 'text-delta', id, delta: text })
  writer.write({ type: 'text-end', id })
}

const writeQuestion = (writer: Writer, prompt: ChoicePrompt | null) => {
  if (!prompt) return
  say(writer, prompt.question)
  writer.write({
    type: 'data-choices',
    id: `c_${crypto.randomUUID()}`,
    data: prompt,
  })
}

/** Drop tool parts of tools that no longer exist (older conversations). */
const withKnownTools = (messages: AgentUIMessage[], tools: AgentTools) =>
  messages.map((m) => ({
    ...m,
    parts: m.parts.filter(
      (p) => !p.type.startsWith('tool-') || p.type.slice(5) in tools,
    ),
  }))

export const runTurn = async (
  deps: HarnessDeps,
  input: { tripId: string; message: AgentUIMessage },
): Promise<ReadableStream<UIMessageChunk>> => {
  const { config, db } = deps
  let record: TripRecord = await openTrip(
    db,
    config,
    input.tripId,
    openingFor(config),
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

  // A reply chip carries its value: apply it as given, no interpretation.
  const chip =
    input.message.role === 'user'
      ? messages.at(-1)?.metadata?.choice
      : undefined
  let chipReply: string | undefined
  let chipApplied = false
  if (chip && chip.slot === pendingSlot(config, record.state)) {
    const prompt = promptFor(config, record.state, chip.slot)
    const parsed = choiceValue(chip.slot, chip.value)
    if (parsed.ok) {
      record = await commit(
        db,
        record,
        fillSlots(config, record.state, parsed.details, [chip.slot]),
        { source: 'chip', slot: chip.slot },
      )
      chipApplied = true
      chipReply = prompt?.choices.find((c) => c.value === chip.value)?.reply
    }
  }

  // Safety gate: a symptom stops the trip without asking any model.
  const text = lastUserText(messages)
  if (mentionsSymptom(text) && record.state.plan.condition !== 'UNWELL')
    record = await commit(
      db,
      record,
      [{ type: 'plan.patched', patch: { condition: 'UNWELL' } }],
      { source: 'safety-gate' },
    )

  const stageNow = stageOf(record.state)
  if (chipApplied && answeredByApp.includes(stageNow)) {
    const done = record
    return createUIMessageStream<AgentUIMessage>({
      originalMessages: messages,
      execute: ({ writer }) => {
        // No mode: the app answered by itself; the header keeps the last model's.
        const meta = { stage: stageNow, revision: done.state.plan.revision }
        writer.write({ type: 'start', messageMetadata: meta })
        const lines = [
          chipReply,
          stageNow !== stageAtStart ? entryLine[stageNow] : undefined,
        ]
        for (const line of lines.filter(Boolean)) say(writer, line!)
        writeQuestion(writer, promptFor(config, done.state))
        writer.write({
          type: 'data-trip',
          data: tripView(config, done.state),
          transient: true,
        })
        writer.write({ type: 'finish', messageMetadata: meta })
      },
      onEnd: async ({ messages: final }) => {
        await saveConversation(db, {
          id: done.id,
          messages: final,
          meta: done.meta,
        })
      },
    })
  }

  let current = record
  let progress: TurnContext['progress']
  let checks: { label: string; ok: boolean }[] = []
  const ctx: TurnContext = {
    config,
    progress: (phase) => progress?.(phase),
    trip: () => current,
    commit: async (events, source) => {
      current = await commit(db, current, events, { source })
      return current
    },
    remember: (preview) => {
      current = { ...current, meta: rememberPreview(current.meta, preview) }
    },
    observe: async () => {
      progress?.('OBSERVE')
      const evidence = await deps.observe()
      checks = evidence.map((e) => ({
        label: e.label,
        ok: e.status === 'LIVE' && e.freshness === 'FRESH',
      }))
      progress?.('PLAN')
      return evidence
    },
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
    temperature: config.agent.temperature ?? undefined,
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
        !chipApplied && text.length > 0 && !asksInfo(text),
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
      progress = (phase) =>
        writer.write({
          type: 'data-progress',
          transient: true,
          data: {
            phase,
            nickname: current.state.plan.nickname || '러너',
            checks,
          },
        })
      if (stageNow === 'PLANNING' || stageNow === 'JOURNEY') {
        progress('OBSERVE')
        const synced = await syncLive(db, config, current, deps.observe)
        current = synced.record
        checks =
          synced.evidence?.map((e) => ({
            label: e.label,
            ok: e.status === 'LIVE' && e.freshness === 'FRESH',
          })) ??
          Object.entries(current.state.observations.sources).map(
            ([name, s]) => ({
              label:
                config.sources.find((source) => source.reading === name)
                  ?.label ?? name,
              ok: s.freshness === 'FRESH',
            }),
          )
        await saveConversation(db, {
          id: current.id,
          messages,
          meta: current.meta,
        })
        progress('PLAN')
      }

      const entry =
        stageAfterIngest !== stageAtStart
          ? entryLine[stageAfterIngest]
          : undefined
      if (entry) say(writer, entry)

      const asked = new Set<string>()
      let awaitingApproval = false
      const result = await agent.stream({
        messages: await convertToModelMessages(
          withKnownTools(messages, tools),
          {
            tools,
          },
        ),
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
        if (chunk.type === 'text-start') progress?.('EXPLAIN')
        if (chunk.type === 'tool-approval-request' && !chunk.isAutomatic)
          awaitingApproval = true
        writer.write(chunk as never)
      }

      // Ask the next question, or keep the card the stage needs open —
      // unless the agent already asked something or awaits an approval.
      const stage = stageOf(current.state)
      const card = standingCard[stage]
      const free = !askTools.some((t) => asked.has(t)) && !awaitingApproval
      if (free) writeQuestion(writer, promptFor(config, current.state))
      if (card && free)
        writer.write({
          type: 'tool-input-available',
          toolCallId: `h_${crypto.randomUUID()}`,
          toolName: card,
          input: {},
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
