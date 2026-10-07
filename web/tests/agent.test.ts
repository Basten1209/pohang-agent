import { readUIMessageStream, simulateReadableStream } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it, vi } from 'vitest'
import { seedConfig } from '#/core/defaults'
import type { Preview } from '#/core/preview'
import type { Plan } from '#/core/schema'
import type { AgentDeps, AgentUIMessage } from '#/server/agent/agent'
import { respond } from '#/server/agent/agent'

const plan: Plan = {
  ...seedConfig.defaults.plan,
  condition: 'TIRED',
  revision: 7,
}
const observations = seedConfig.defaults.observations
const user = (text: string): AgentUIMessage[] => [
  { id: 'u1', role: 'user', parts: [{ type: 'text', text }] },
]

const usage = {
  inputTokens: {
    total: 1,
    noCache: 1,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
}
const finish = (unified: 'stop' | 'tool-calls') => ({
  type: 'finish' as const,
  finishReason: { unified, raw: undefined },
  usage,
})
const streamOf = (chunks: unknown[]) => ({
  stream: simulateReadableStream({ chunks: chunks as never[] }),
})
const toolCall = (toolName: string, input: unknown) =>
  streamOf([
    {
      type: 'tool-call',
      toolCallId: 'call_1',
      toolName,
      input: JSON.stringify(input),
    },
    finish('tool-calls'),
  ])
const text = (value: string) =>
  streamOf([
    { type: 'text-start', id: 't1' },
    { type: 'text-delta', id: 't1', delta: value },
    { type: 'text-end', id: 't1' },
    finish('stop'),
  ])

const deps = (model: AgentDeps['model']): AgentDeps => ({
  model,
  observe: vi.fn(async () => []),
})

/** Run one turn and return the final assembled assistant message. */
const turn = async (message: string, d: AgentDeps, p: Plan = plan) => {
  let last: AgentUIMessage | undefined
  const stream = respond(
    { config: seedConfig, plan: p, observations, messages: user(message) },
    d,
  )
  for await (const m of readUIMessageStream<AgentUIMessage>({ stream }))
    last = m
  return last!
}
const toolParts = (m: AgentUIMessage) =>
  m.parts.filter((p) => p.type.startsWith('tool-'))
const previewOf = (m: AgentUIMessage) => {
  const part = m.parts.find((p) => p.type === 'tool-preview_itinerary')
  return part && 'output' in part ? (part.output as Preview) : undefined
}

describe('게이트: 모델 호출 전에 끝나는 경우', () => {
  it('D06: 증상 언급은 모델·외부 조회 없이 의료 우선', async () => {
    const model = new MockLanguageModelV4({ doStream: text('무시') })
    const d = deps(model)
    const m = await turn('좀 어지러워요', d)
    expect(model.doStreamCalls).toHaveLength(0)
    expect(d.observe).not.toHaveBeenCalled()
    expect(
      m.parts.some(
        (p) => p.type === 'data-notice' && p.data.kind === 'medical',
      ),
    ).toBe(true)
  })
  it('컨디션 미응답이면 먼저 확인을 요청', async () => {
    const model = new MockLanguageModelV4({ doStream: text('무시') })
    const m = await turn('16시 기차로 바꿨어', deps(model), {
      ...plan,
      condition: 'UNANSWERED',
    })
    expect(model.doStreamCalls).toHaveLength(0)
    expect(toolParts(m)).toHaveLength(0)
  })
})

describe('모델 경로 (Mock LanguageModelV4)', () => {
  it('D02: 도구 호출 결과는 미리보기일 뿐이고 계획은 그대로', async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        toolCall('preview_itinerary', {
          trainTime: '16:00',
          walkingLimit: null,
          extraRestMin: null,
          excludePlaces: null,
        }),
        text('미리보기를 만들었어요.'),
      ],
    })
    const before = structuredClone(plan)
    const m = await turn('16시 기차로 바꿨어', deps(model))
    expect(m.metadata?.mode).toBe('OPENAI')
    const preview = previewOf(m)!
    expect(preview.revision).toBe(7)
    expect(preview.changes).toEqual({ trainTime: '16:00' })
    expect(preview.itinerary.stationEta).toBe(915)
    expect(plan).toEqual(before)
    // The model sees the tool output under the same call id on its second step.
    const second = JSON.stringify(model.doStreamCalls[1].prompt)
    expect(second).toContain('call_1')
  })
  it('질문·비교에는 변경 도구 자체를 제공하지 않음', async () => {
    const model = new MockLanguageModelV4({
      doStream: text('버스 120분이에요.'),
    })
    await turn('역까지 택시 타면?', deps(model))
    const offered = (model.doStreamCalls[0].tools ?? []).map((t) =>
      'name' in t ? t.name : '',
    )
    expect(offered).not.toContain('preview_itinerary')
    expect(offered).toContain('compare_transport')
  })
  it('스키마에 어긋난 인수(25시, 추가 필드)는 적용되지 않음', async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        toolCall('preview_itinerary', {
          trainTime: '25:00',
          walkingLimit: null,
          extraRestMin: null,
          excludePlaces: null,
          fare: 1,
        }),
        text('다시 알려주세요.'),
      ],
    })
    const m = await turn('25시로 변경', deps(model))
    expect(previewOf(m)).toBeUndefined()
  })
  it('모델 장애 시 정형 해석으로 전환하고 성공을 주장하지 않음', async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => {
        throw new Error('timeout')
      },
    })
    const m = await turn('16시 기차로 바꿨어', deps(model))
    expect(m.metadata?.mode).toBe('FALLBACK')
    expect(previewOf(m)?.itinerary.decision).toBe('SHORTEN')
  })
})

describe('결정적 해석 (키 없음)', () => {
  it('D08: 택시 비교는 계획을 바꾸지 않음', async () => {
    const m = await turn('역까지 택시 타면?', deps(null))
    expect(m.metadata?.mode).toBe('DEMO')
    expect(toolParts(m).map((p) => p.type)).toEqual(['tool-compare_transport'])
    expect(previewOf(m)).toBeUndefined()
  })
  it('모호한 4시는 되묻고 도구를 실행하지 않음', async () => {
    const m = await turn('4시 기차로 바꿨어', deps(null))
    expect(toolParts(m)).toHaveLength(0)
  })
  it('자연어 변경은 미리보기만 반환', async () => {
    const m = await turn('16시 기차로 바꿨어. 카페는 빼줘', deps(null))
    const preview = previewOf(m)!
    expect(preview.changes).toEqual({ trainTime: '16:00', excluded: ['cafe'] })
    expect(preview.itinerary.stops.map((s) => s.id)).toEqual(['food', 'street'])
  })
})
