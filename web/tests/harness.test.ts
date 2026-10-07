import type { LanguageModelV4 } from '@ai-sdk/provider'
import type { UIMessage } from 'ai'
import { beforeEach, describe, expect, it } from 'vitest'
import { seedConfig } from '#/core/defaults'
import { planner } from '#/core/planner'
import { progressOptions, stageOf } from '#/core/stage'
import type { Db } from '#/server/db/client'
import { memoryDb } from '#/server/db/client'
import { seed } from '#/server/db/repo'
import type { AgentUIMessage, HarnessDeps } from '#/server/agent/harness'
import { openingMessages, runTurn } from '#/server/agent/harness'
import { scriptedModel } from '#/server/agent/scripted-model'
import { openTrip } from '#/server/trips'

/**
 * The whole conversation, end to end, through the real harness and a real
 * (in-memory) Postgres, with the rule-based model. The test plays the client:
 * it only ever sends a user message or the latest assistant message with a
 * card answer / approval, and reads everything else back from the server.
 */

type Part = {
  type: string
  toolCallId?: string
  state?: string
  [k: string]: unknown
}

let db: Db
let deps: HarnessDeps
const tripId = '00000000-0000-4000-8000-000000000001'

beforeEach(async () => {
  db = await memoryDb()
  await seed(db, seedConfig)
  deps = { config: seedConfig, db, model: null, observe: async () => [] }
})

const load = () => openTrip(db, seedConfig, tripId, openingMessages)

const send = async (message: UIMessage) => {
  const stream = await runTurn(deps, {
    tripId,
    message: message as AgentUIMessage,
  })
  const reader = stream.getReader()
  const chunks: { type: string; [k: string]: unknown }[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value as never)
  }
  return chunks
}

const say = (text: string) =>
  send({
    id: `u_${crypto.randomUUID()}`,
    role: 'user',
    parts: [{ type: 'text', text }],
  })

const lastAssistant = async () => {
  const { messages } = await load()
  const m = (messages as UIMessage[]).at(-1)!
  expect(m.role).toBe('assistant')
  return m
}

/** Answer the open card of `tool` in the latest assistant message. */
const answer = async (tool: string, output: unknown) => {
  const m = await lastAssistant()
  const parts = (m.parts as Part[]).map((p) =>
    p.type === `tool-${tool}` && p.state === 'input-available'
      ? { ...p, state: 'output-available', output }
      : p,
  )
  expect(parts.some((p, i) => p !== m.parts[i])).toBe(true)
  return send({ ...m, parts: parts as UIMessage['parts'] })
}

const approve = async (approved: boolean) => {
  const m = await lastAssistant()
  const parts = (m.parts as Part[]).map((p) =>
    p.state === 'approval-requested'
      ? {
          ...p,
          state: 'approval-responded',
          approval: { ...(p.approval as object), approved },
        }
      : p,
  )
  return send({ ...m, parts: parts as UIMessage['parts'] })
}

const toolParts = (m: UIMessage) =>
  (m.parts as Part[]).filter((p) => p.type.startsWith('tool-'))
const stage = async () => stageOf((await load()).state)

const basics = {
  arrivalAt: '2026-10-12T09:00',
  trainTime: '18:30',
  interests: ['food', 'cafe'],
  origin: 'RACE',
}
const condition = {
  condition: 'OK',
  walkingLimit: 30,
  readyTime: '10:40',
  baggageCollected: true,
}

const finishRace = async () => {
  await load()
  await answer('ask_trip_basics', basics)
  await say('완주했어요')
}

describe('채팅 하네스 (규칙 모델 + PGlite)', () => {
  it('새 여정은 인사와 기본 정보 카드로 시작', async () => {
    const { messages, state } = await load()
    expect(stageOf(state)).toBe('ONBOARDING')
    const [first] = messages as UIMessage[]
    expect(toolParts(first).map((p) => [p.type, p.state])).toEqual([
      ['tool-ask_trip_basics', 'input-available'],
    ])
  })

  it('카드 답은 모델 없이 그대로 여정에 반영', async () => {
    await load()
    await answer('ask_trip_basics', basics)
    const { state } = await load()
    expect(state.created).toBe(true)
    expect(state.plan.arrivalAt).toBe('2026-10-12T09:00')
    expect(state.plan.excluded).toEqual(['street'])
    expect(stageOf(state)).toBe('PRE_RACE')
  })

  it('전체 흐름: 완주 → 컨디션 → 코스 → 변경 승인 → 출발 → 도착', async () => {
    await finishRace()
    expect(await stage()).toBe('CHECK_IN')
    expect(toolParts(await lastAssistant()).map((p) => p.type)).toContain(
      'tool-ask_condition',
    )

    const planned = await answer('ask_condition', condition)
    expect(await stage()).toBe('PLANNING')
    expect(
      planned.some(
        (c) =>
          c.type === 'tool-input-available' && c.toolName === 'plan_course',
      ),
    ).toBe(true)

    // A model-proposed change waits for approval and does not change the trip.
    const revision = (await load()).state.plan.revision
    const proposed = await say('16시 기차로 바뀌었어요')
    expect(proposed.some((c) => c.type === 'tool-approval-request')).toBe(true)
    expect((await load()).state.plan.trainTime).toBe('18:30')
    expect((await load()).state.plan.revision).toBe(revision)

    await approve(true)
    expect((await load()).state.plan.trainTime).toBe('16:00')

    // "이 코스로 갈게요" starts the journey without a second confirmation.
    await say('이 코스로 갈게요')
    expect(await stage()).toBe('JOURNEY')
    const journey = await lastAssistant()
    expect(toolParts(journey).at(-1)).toMatchObject({
      type: 'tool-await_progress',
      state: 'input-available',
    })

    const visited: string[] = []
    for (let i = 0; i < 12 && (await stage()) === 'JOURNEY'; i++) {
      const { state } = await load()
      const [event] = progressOptions(
        state,
        planner(seedConfig)(state.plan, state.observations),
      )
      visited.push(event)
      await answer('await_progress', { event })
    }
    // With the 16:00 train only one stop fits.
    expect(visited).toEqual([
      'ARRIVED',
      'STOP_DONE',
      'START_RETURN',
      'AT_STATION',
    ])
    expect(await stage()).toBe('DONE')
    const done = await lastAssistant()
    expect(toolParts(done).some((p) => p.type === 'tool-summarize_trip')).toBe(
      true,
    )
  })

  it('승인을 거절하면 계획이 그대로', async () => {
    await finishRace()
    await answer('ask_condition', condition)
    await say('16시 기차로 바뀌었어요')
    await approve(false)
    expect((await load()).state.plan.trainTime).toBe('18:30')
  })

  it('승인 대기 중 다른 말을 하면 변경은 거절 처리', async () => {
    await finishRace()
    await answer('ask_condition', condition)
    await say('16시 기차로 바뀌었어요')
    await say('왜 이 코스야?')
    const { state, messages } = await load()
    expect(state.plan.trainTime).toBe('18:30')
    const parts = (messages as UIMessage[]).flatMap((m) => toolParts(m))
    expect(parts.find((p) => p.type === 'tool-apply_plan_change')?.state).toBe(
      'output-denied',
    )
  })

  it('증상을 말하면 모델 없이 안전 단계로', async () => {
    await finishRace()
    await say('어지럽고 숨이 차요')
    expect(await stage()).toBe('SAFETY')
    expect(
      toolParts(await lastAssistant()).some(
        (p) => p.type === 'tool-show_safety_help',
      ),
    ).toBe(true)
  })

  it('클라이언트는 실행된 도구 결과를 바꿀 수 없음', async () => {
    await finishRace()
    await answer('ask_condition', condition)
    const m = await lastAssistant()
    const forged = (m.parts as Part[]).map((p) =>
      p.type === 'tool-plan_course' ? { ...p, output: { forged: true } } : p,
    )
    await send({ ...m, parts: forged as UIMessage['parts'] })
    const after = await lastAssistant()
    const course = toolParts(after).find((p) => p.type === 'tool-plan_course')
    expect(course?.output).not.toEqual({ forged: true })
  })

  it('/시연 명령으로 관측 시나리오 적용', async () => {
    await finishRace()
    await answer('ask_condition', condition)
    await say('/시연 혼잡')
    const { state } = await load()
    expect(state.observations.readings.congestion).toBeGreaterThan(42)
  })
})

describe('하네스가 모델을 통제하는 방식', () => {
  type Call = { tools: string[]; toolChoice: unknown }

  /** Wraps the rule model, records each call, and can misbehave on purpose. */
  const recorder = (lazyAfterPreview: boolean) => {
    const calls: Call[] = []
    const inner = scriptedModel()
    const model: LanguageModelV4 = {
      ...inner,
      provider: 'test',
      doStream: async (options) => {
        calls.push({
          tools: (options.tools ?? []).map((t) => t.name).sort(),
          toolChoice: options.toolChoice,
        })
        const last = options.prompt.at(-1)
        const afterPreview =
          last?.role === 'tool' &&
          last.content.some(
            (c) => c.type === 'tool-result' && c.toolName === 'plan_course',
          )
        // A model that describes the change but never proposes it.
        if (
          lazyAfterPreview &&
          afterPreview &&
          options.toolChoice?.type !== 'tool'
        )
          return {
            stream: new ReadableStream({
              start(c) {
                c.enqueue({ type: 'stream-start', warnings: [] })
                c.enqueue({ type: 'text-start', id: 't' })
                c.enqueue({
                  type: 'text-delta',
                  id: 't',
                  delta: '승인해 주세요.',
                })
                c.enqueue({ type: 'text-end', id: 't' })
                c.enqueue({
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: undefined },
                  usage: {
                    inputTokens: {
                      total: 0,
                      noCache: 0,
                      cacheRead: undefined,
                      cacheWrite: undefined,
                    },
                    outputTokens: { total: 0, text: 0, reasoning: undefined },
                  },
                })
                c.close()
              },
            }),
          }
        return inner.doStream(options)
      },
    }
    return { model, calls }
  }

  const toPlanning = async () => {
    await finishRace()
    await answer('ask_condition', condition)
  }

  it('단계별로 쓸 수 있는 도구만 모델에 보임', async () => {
    await toPlanning()
    const { model, calls } = recorder(false)
    deps = { ...deps, model }
    await say('역까지 택시 타면?')
    expect(calls[0].tools).not.toContain('record_race_progress')
    expect(calls[0].tools).not.toContain('ask_trip_basics')
    // A question cannot change the trip: commit tools are withheld.
    expect(calls[0].tools).not.toContain('apply_plan_change')
    expect(calls[0].tools).not.toContain('start_journey')
    expect(calls[0].tools).toContain('compare_transport')
  })

  it('모델이 미리보기만 하고 멈춰도 하네스가 승인 카드를 띄움', async () => {
    await toPlanning()
    const { model, calls } = recorder(true)
    deps = { ...deps, model }
    const chunks = await say('16시 기차로 바뀌었어요')
    expect(calls.map((c) => c.toolChoice)).toContainEqual({
      type: 'tool',
      toolName: 'apply_plan_change',
    })
    expect(chunks.some((c) => c.type === 'tool-approval-request')).toBe(true)
    expect((await load()).state.plan.trainTime).toBe('18:30')
  })

  it('모델 호출이 실패하면 같은 하네스에서 규칙 모델로 대체', async () => {
    await toPlanning()
    const broken: LanguageModelV4 = {
      ...scriptedModel(),
      provider: 'broken',
      doStream: async () => {
        throw new Error('provider down')
      },
    }
    deps = { ...deps, model: broken }
    const chunks = await say('16시 기차로 바뀌었어요')
    expect(chunks.find((c) => c.type === 'finish')).toMatchObject({
      messageMetadata: { mode: 'FALLBACK' },
    })
    expect(chunks.some((c) => c.type === 'tool-approval-request')).toBe(true)
  })
})
