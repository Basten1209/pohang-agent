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
import { openingFor, runTurn } from '#/server/agent/harness'
import { scriptedModel } from '#/server/agent/scripted-model'
import { openTrip } from '#/server/trips'

/**
 * The whole conversation, end to end, through the real harness and a real
 * (in-memory) Postgres, with the rule-based model. The test plays the client:
 * it only ever sends a user message (typed, or a reply chip with its value)
 * or the latest assistant message with a card answer / approval, and reads
 * everything else back from the server.
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

const load = () => openTrip(db, seedConfig, tripId, openingFor(seedConfig))

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

/** Tap a reply chip: its sentence as the user's message, plus its value. */
const choose = (slot: string, value: unknown, text: string) =>
  send({
    id: `u_${crypto.randomUUID()}`,
    role: 'user',
    parts: [{ type: 'text', text }],
    metadata: { choice: { slot, value } },
  } as UIMessage)

const openQuestion = async () =>
  ((await lastAssistant()).parts as Part[]).find(
    (p) => p.type === 'data-choices',
  )?.data as { slot: string; choices: { value: unknown }[] } | undefined

const finishMode = (chunks: { type: string; [k: string]: unknown }[]) =>
  (
    chunks.find((c) => c.type === 'finish')?.messageMetadata as {
      mode?: string
    }
  )?.mode

const onboard = async () => {
  await load()
  await choose('departMode', 'TRAIN', '기차 타고 가요')
  await choose('departTime', '18:30', '18시 30분 기차예요')
  await choose('course', 'guryongpo', '구룡포 가 보고 싶어요')
  await choose('interests', ['food', 'cafe'], '점심, 카페 할래요')
  await choose('origin', 'RACE', '대회장에서 바로 갈게요')
}

const finishRace = async () => {
  await onboard()
  await say('완주했어요')
}

const checkIn = async () => {
  await choose('readyTime', '10:40', '지금 바로 출발할 수 있어요')
  return choose('condition', 'OK', '괜찮아요')
}

describe('대화로 여정 만들기', () => {
  it('새 여정은 인사와 첫 질문(귀가 방법), 답 버튼으로 시작', async () => {
    const { messages, state } = await load()
    expect(stageOf(state)).toBe('ONBOARDING')
    const [first] = messages as UIMessage[]
    expect(toolParts(first)).toEqual([])
    expect(await openQuestion()).toMatchObject({ slot: 'departMode' })
  })

  it('버튼 답은 모델 없이 저장되고 다음 질문이 이어짐', async () => {
    const broken: LanguageModelV4 = {
      ...scriptedModel(),
      doStream: async () => {
        throw new Error('must not be called')
      },
    }
    deps = { ...deps, model: broken }
    await load()
    const turn = await choose('departMode', 'BUS', '버스 타고 가요')
    // Answered by the app itself: no model, so no model mode either.
    expect(finishMode(turn)).toBeUndefined()
    expect(await openQuestion()).toMatchObject({ slot: 'departTime' })
    await choose('departTime', '18:30', '18:30 버스예요')
    expect(await openQuestion()).toMatchObject({ slot: 'course' })
    await choose('course', 'auto', '시간에 맞게 추천해 주세요')
    expect(await openQuestion()).toMatchObject({ slot: 'interests' })
    await choose('interests', ['food', 'cafe'], '점심, 카페 할래요')
    expect(await openQuestion()).toMatchObject({ slot: 'origin' })
    await choose('origin', 'HOTEL', '숙소에 들렀다 갈게요')

    const { state } = await load()
    expect(state.created).toBe(true)
    expect(state.plan).toMatchObject({
      departMode: 'BUS',
      departTime: '18:30',
      course: 'auto',
      interests: ['food', 'cafe'],
      excluded: [],
      origin: 'HOTEL',
      currentPlace: 'HOTEL',
    })
    expect(stageOf(state)).toBe('PRE_RACE')
    expect(await openQuestion()).toBeUndefined()
  })

  it('한 문장에 여러 정보를 말하면 한 번에 저장', async () => {
    await load()
    await say(
      '18시 30분 기차고 호미곶 가서 점심이랑 카페 가고 싶어요. 숙소 들렀다 갈게요',
    )
    const { state } = await load()
    expect(state.created).toBe(true)
    expect(state.plan).toMatchObject({
      departMode: 'TRAIN',
      departTime: '18:30',
      course: 'homigot',
      interests: ['food', 'cafe'],
      origin: 'HOTEL',
    })
  })

  it('일부만 말하면 남은 질문을 이어서 물음', async () => {
    await load()
    await say('저녁 6시 반 기차예요')
    expect((await load()).state.plan).toMatchObject({
      departMode: 'TRAIN',
      departTime: '18:30',
    })
    expect(await openQuestion()).toMatchObject({ slot: 'course' })
  })

  it('"카페도"는 이미 고른 것에 더함', async () => {
    await load()
    await say('18시 30분 기차고 점심 먹고 싶어요')
    await say('카페도 가고 싶어요')
    expect((await load()).state.plan.interests).toEqual(['food', 'cafe'])
  })

  it('오전/오후가 모호하면 저장하지 않고 같은 질문을 다시', async () => {
    await load()
    await say('4시 기차예요')
    const { state } = await load()
    expect(state.answered).not.toContain('departTime')
    expect(await openQuestion()).toMatchObject({ slot: 'departTime' })
  })

  it('"아직 몰라요"는 기본값으로 넘어가며 그렇게 말해 줌', async () => {
    await load()
    await choose('departMode', 'TRAIN', '기차 타고 가요')
    const turn = await choose('departTime', null, '아직 몰라요')
    const said = turn
      .flatMap((c) => (c.type === 'text-delta' ? [c.delta] : []))
      .join('')
    expect(said).toContain('18:30')
    expect((await load()).state.answered).toContain('departTime')
  })

  it('지금 묻는 질문이 아닌 버튼은 값 대신 문장으로 이해', async () => {
    await load()
    // Value says HOTEL, the sentence says the race venue: the sentence wins.
    const turn = await choose('origin', 'HOTEL', '대회장에서 바로 갈게요')
    expect(
      turn.some(
        (c) =>
          c.type === 'tool-input-available' &&
          c.toolName === 'update_trip_details',
      ),
    ).toBe(true)
    expect((await load()).state.plan.origin).toBe('RACE')
    expect((await load()).state.answered).toEqual(['origin'])
  })

  it('완주 후에도 말로: 준비 시각과 컨디션을 한 문장에서', async () => {
    await finishRace()
    expect(await stage()).toBe('CHECK_IN')
    expect(await openQuestion()).toMatchObject({ slot: 'readyTime' })
    const turn = await say('30분 쉬고 갈게요. 조금 지쳤어요')
    const { state } = await load()
    expect(state.plan).toMatchObject({ readyTime: '11:10', condition: 'TIRED' })
    expect(stageOf(state)).toBe('PLANNING')
    expect(
      turn.some(
        (c) =>
          c.type === 'tool-input-available' && c.toolName === 'plan_course',
      ),
    ).toBe(true)
  })

  it('"몸이 안 좋아요" 버튼은 안전 안내로', async () => {
    await finishRace()
    await choose('readyTime', '10:40', '지금 바로 출발할 수 있어요')
    await choose('condition', 'UNWELL', '몸이 안 좋아요')
    expect(await stage()).toBe('SAFETY')
    expect(
      toolParts(await lastAssistant()).some(
        (p) => p.type === 'tool-show_safety_help',
      ),
    ).toBe(true)
  })
})

describe('정보 질문은 프롬프트가 아니라 도구로 답함', () => {
  const calledTool = (
    chunks: { type: string; [k: string]: unknown }[],
    name: string,
  ) =>
    chunks.find((c) => c.type === 'tool-input-available' && c.toolName === name)
  const said = (chunks: { type: string; [k: string]: unknown }[]) =>
    chunks.flatMap((c) => (c.type === 'text-delta' ? [c.delta] : [])).join('')

  it('대회 전 "코스가 어떻게 돼?"는 대회 코스를 조회', async () => {
    await onboard()
    const turn = await say('코스가 어떻게 돼?')
    expect(calledTool(turn, 'get_race_info')).toMatchObject({
      input: { topic: 'course' },
    })
    expect(said(turn)).toContain('반환')
  })

  it('온보딩 중 질문도 저장하지 않고 답한 뒤 질문을 이어감', async () => {
    await load()
    const turn = await say('대회 준비물 뭐예요?')
    expect(calledTool(turn, 'get_race_info')).toBeTruthy()
    expect(said(turn)).toContain('배번표')
    expect(await openQuestion()).toMatchObject({ slot: 'departMode' })
  })

  it('온보딩 중 버스를 물어도 길찾기 링크로 답함', async () => {
    await load()
    const turn = await say('영일대에서 구룡포 가는 버스 뭐 타요?')
    expect(calledTool(turn, 'get_directions')).toBeTruthy()
    expect(said(turn)).toContain('map.kakao.com')
  })

  it('일반 관광 질문은 안내 자료를 검색', async () => {
    await onboard()
    const turn = await say('구룡포는 뭘로 유명해요?')
    expect(calledTool(turn, 'search_guide')).toBeTruthy()
    expect(said(turn)).toContain('과메기')
  })

  it('다른 코스를 물으면 전체 코스를 계산해 비교', async () => {
    await finishRace()
    await checkIn()
    const turn = await say('다른 코스도 보여줘')
    expect(calledTool(turn, 'compare_courses')).toBeTruthy()
    expect(said(turn)).toContain('호미곶')
  })

  it('버스를 물으면 길찾기 링크를 주고 버스 번호를 지어내지 않음', async () => {
    await finishRace()
    await checkIn()
    await say('이 코스로 갈게요')
    const turn = await say('구룡포 가는 버스 뭐 타요?')
    expect(calledTool(turn, 'get_directions')).toBeTruthy()
    expect(said(turn)).toContain('map.kakao.com')
    expect(said(turn)).not.toMatch(/\d+번/)
  })
})

describe('E-UM 실측이 코스 계산에 들어감', () => {
  const live = {
    sourceId: 'INT_S07_005',
    label: 'E-UM 시간대별 교통 혼잡율',
    reading: 'congestion',
    status: 'LIVE' as const,
    observedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    fetchedAt: new Date().toISOString(),
    freshness: 'FRESH' as const,
    value: 82,
    unit: '%',
    values: {},
    message: '',
  }

  it('완주 후 코스를 만들 때 실측 혼잡을 반영하고 출처를 남김', async () => {
    deps = { ...deps, observe: async () => [live] }
    await finishRace()
    await checkIn()
    const { state } = await load()
    expect(state.observations.readings.congestion).toBe(82)
    expect(state.observations.sources.congestion?.provenance).toBe('LIVE')
    const it = planner(seedConfig)(state.plan, state.observations)
    expect(it.trafficReserve).toBe(20)
  })

  it('"지금도 괜찮아?"는 실측을 다시 반영하고 도착·여유로 답함', async () => {
    await finishRace()
    await checkIn()
    deps = { ...deps, observe: async () => [live] }
    const turn = await say('지금도 시간 괜찮아?')
    expect(
      turn.some(
        (c) =>
          c.type === 'tool-input-available' &&
          c.toolName === 'check_live_conditions',
      ),
    ).toBe(true)
    expect(
      (await load()).state.observations.sources.congestion?.provenance,
    ).toBe('LIVE')
  })
})

describe('채팅 하네스 (규칙 모델 + PGlite)', () => {
  it('전체 흐름: 완주 → 컨디션 → 코스 → 변경 승인 → 출발 → 도착', async () => {
    await finishRace()
    expect(await stage()).toBe('CHECK_IN')

    expect(await openQuestion()).toMatchObject({ slot: 'readyTime' })
    const planned = await checkIn()
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
    expect((await load()).state.plan.departTime).toBe('18:30')
    expect((await load()).state.plan.revision).toBe(revision)

    await approve(true)
    expect((await load()).state.plan.departTime).toBe('16:00')

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
    await checkIn()
    await say('16시 기차로 바뀌었어요')
    await approve(false)
    expect((await load()).state.plan.departTime).toBe('18:30')
  })

  it('승인 대기 중 다른 말을 하면 변경은 거절 처리', async () => {
    await finishRace()
    await checkIn()
    await say('16시 기차로 바뀌었어요')
    await say('왜 이 코스야?')
    const { state, messages } = await load()
    expect(state.plan.departTime).toBe('18:30')
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
    await checkIn()
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
    await checkIn()
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
    await checkIn()
  }

  it('단계별로 쓸 수 있는 도구만 모델에 보임', async () => {
    await toPlanning()
    const { model, calls } = recorder(false)
    deps = { ...deps, model }
    await say('역까지 택시 타면?')
    expect(calls[0].tools).not.toContain('record_race_progress')
    expect(calls[0].tools).not.toContain('update_trip_details')
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
    expect((await load()).state.plan.departTime).toBe('18:30')
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
