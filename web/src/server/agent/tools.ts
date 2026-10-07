import { tool } from 'ai'
import { z } from 'zod'
import type { Changes } from '#/core/intents'
import { planContext, preview } from '#/core/preview'
import type { Observations, Plan, TripConfig } from '#/core/schema'
import { timeSchema } from '#/core/schema'
import type { Evidence } from '#/core/evidence'

/**
 * The agent's capabilities, in two layers:
 *
 * 1. `makeOps` — plain functions closed over one request's context. These
 *    are what actually run, whether a model asked for them or the
 *    deterministic interpreter did.
 * 2. `makeTools` — the same operations described for the model (schemas,
 *    descriptions) via the AI SDK.
 *
 * Nothing here commits state: `preview_itinerary` returns a draft that the
 * user applies explicitly. Every call counts against a per-turn budget.
 */

export type ToolContext = {
  config: TripConfig
  plan: Plan
  observations: Observations
  readOnly: boolean
  observe: () => Promise<Evidence[]>
}

export const changesSchema = (placeIds: [string, ...string[]]) =>
  z
    .object({
      trainTime: timeSchema
        .nullable()
        .describe('귀가 열차 출발 시각, 24시간 HH:mm. 언급이 없으면 null'),
      walkingLimit: z
        .union([z.literal(15), z.literal(30)])
        .nullable()
        .describe('걷기 상한(분). 언급이 없으면 null'),
      extraRestMin: z
        .number()
        .int()
        .min(0)
        .max(60)
        .nullable()
        .describe('추가로 쉬고 싶은 시간(분). 언급이 없으면 null'),
      excludePlaces: z
        .array(z.enum(placeIds))
        .nullable()
        .describe('사용자가 빼 달라고 한 장소 id. 언급이 없으면 null'),
    })
    .strict()

export const makeOps = (ctx: ToolContext) => {
  const budget = { left: ctx.config.agent.maxToolCalls }
  const budgeted =
    <A extends unknown[], R>(fn: (...args: A) => Promise<R> | R) =>
    async (...args: A): Promise<R> => {
      if (budget.left-- <= 0) throw new Error('도구 실행 한도를 넘었어요.')
      return fn(...args)
    }
  return {
    get_plan_context: budgeted(() =>
      planContext(ctx.config, ctx.plan, ctx.observations),
    ),
    refresh_trip_context: budgeted(async () => ({
      evidence: (await ctx.observe()).map((e) => ({
        source: e.sourceId,
        status: e.status,
        value: e.value,
        unit: e.unit,
        observedAt: e.observedAt,
        freshness: e.freshness,
        message: e.message,
      })),
      decisionInputs: {
        provenance: ctx.observations.provenance,
        readings: ctx.observations.readings,
      },
      note: '일정 계산은 화면의 관측 입력을 사용한다. 실응답은 검증 전까지 별도 표시한다.',
    })),
    compare_transport: budgeted(() => ({
      leg: 'GURYONGPO→STATION',
      bus: {
        minutes: ctx.config.policy.legs.return.minutes,
        fare: null,
        provenance: 'SIMULATED',
      },
      taxi: { minutes: null, fare: null, provenance: 'NOT_CONNECTED' },
      selectionChanged: false,
      status: 'NEEDS_DATA' as const,
    })),
    preview_itinerary: budgeted((changes: Changes) => {
      if (ctx.readOnly) throw new Error('질문과 비교는 일정을 바꾸지 않아요.')
      return preview(ctx.config, ctx.plan, ctx.observations, changes)
    }),
  }
}
export type AgentOps = ReturnType<typeof makeOps>

export const makeTools = (ops: AgentOps, config: TripConfig) => {
  const placeIds = config.places.filter((p) => p.active).map((p) => p.id) as [
    string,
    ...string[],
  ]
  const empty = z.object({}).strict()
  return {
    get_plan_context: tool({
      description:
        '현재 여행의 일정, 결정, 제외된 장소와 이유를 조회한다. 질문에 답할 때 사용하며 일정을 바꾸지 않는다.',
      inputSchema: empty,
      execute: () => ops.get_plan_context(),
    }),
    refresh_trip_context: tool({
      description:
        'E-UM 디지털 트윈(교통 혼잡, 대기)의 최신 연결 상태를 조회한다. 실제 응답과 시연값을 구분해 돌려준다.',
      inputSchema: empty,
      execute: () => ops.refresh_trip_context(),
    }),
    compare_transport: tool({
      description:
        '구룡포에서 포항역으로 돌아가는 버스와 택시를 비교만 한다. 이동수단을 선택하거나 바꾸지 않는다.',
      inputSchema: empty,
      execute: () => ops.compare_transport(),
    }),
    preview_itinerary: tool({
      description:
        '사용자가 명확히 요청한 조건 변경(귀가 시각, 걷기 상한, 추가 휴식, 장소 제외)으로 일정 초안을 다시 계산한다. 직접 언급하지 않은 필드는 null. "4시"처럼 오전·오후가 모호하면 호출하지 말고 되묻는다. 저장하지 않는다.',
      inputSchema: changesSchema(placeIds),
      execute: (changes) => ops.preview_itinerary(changes as Changes),
    }),
  }
}

export type AgentTools = ReturnType<typeof makeTools>
export type ToolName = keyof AgentTools
