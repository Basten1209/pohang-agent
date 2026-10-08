import { tool } from 'ai'
import { z } from 'zod'
import type { Evidence } from '#/core/evidence'
import type { Changes } from '#/core/intents'
import { canTravel, planner } from '#/core/planner'
import { planContext, preview } from '#/core/preview'
import type { TripConfig } from '#/core/schema'
import { timeSchema } from '#/core/schema'
import { clock } from '#/core/time'
import type { TripEvent } from '#/core/trip'
import { accept, runScenario } from '#/core/trip'
import {
  describeDetails,
  detailsSchema,
  fillSlots,
  noDetails,
  promptFor,
} from '#/core/slots'
import type { StoredPreview, TripRecord } from '../trips'

/**
 * The agent's tools, in three kinds:
 *
 *   Ask    — no `execute`. The model asks; the UI renders a card; the user's
 *            answer comes back as the tool output (`addToolOutput`) and the
 *            harness applies it (see ingest.ts). The loop stops here.
 *   Read   — compute or look up; never change the trip.
 *   Commit — change the trip. Model-proposed changes need user approval
 *            (`toolApproval` in harness.ts); explicit user statements do not.
 *
 * Descriptions follow one pattern: what it does · when to use · when not ·
 * input rules. Tools are closures over one turn's context, so the trip id and
 * the database never pass through the model.
 */

export type TurnContext = {
  config: TripConfig
  trip: () => TripRecord
  commit: (events: TripEvent[], source: string) => Promise<TripRecord>
  remember: (preview: StoredPreview) => void
  observe: () => Promise<Evidence[]>
  newId: () => string
}

// ── Answer schemas for Ask tools (what the cards send back) ─────────────

export const progressEventSchema = z.enum([
  'ARRIVED',
  'STOP_DONE',
  'SKIP',
  'REST',
  'START_RETURN',
  'AT_STATION',
])
export const progressAnswerSchema = z.object({ event: progressEventSchema })
export type ProgressAnswer = z.infer<typeof progressAnswerSchema>

export const quickReplyAnswerSchema = z.object({
  id: z.string(),
  label: z.string(),
})

/** A card skipped because the user typed instead of answering it. */
export const skippedSchema = z.object({ skipped: z.literal(true) })

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
        .describe('빼 달라고 한 장소 id. 언급이 없으면 null'),
    })
    .strict()

const noChanges: Changes = {
  trainTime: null,
  walkingLimit: null,
  extraRestMin: null,
  excludePlaces: null,
}
const isEmpty = (c: Changes) => Object.values(c).every((v) => v === null)

export const makeTools = (ctx: TurnContext) => {
  const { config } = ctx
  const placeIds = config.places.filter((p) => p.active).map((p) => p.id) as [
    string,
    ...string[],
  ]
  const placeName = (id: string) =>
    config.places.find((p) => p.id === id)?.attrs.short ?? id
  const now = () => {
    const { state } = ctx.trip()
    return { state, it: planner(config)(state.plan, state.observations) }
  }

  return {
    // ── Ask ───────────────────────────────────────────────────────────
    ask_quick_reply: tool({
      description:
        '짧은 선택지 버튼으로 되묻는다. "4시"처럼 오전/오후가 모호하거나 장소가 불분명할 때 쓴다. 자유 대답이 필요한 질문이나 이미 확실한 내용에는 쓰지 않는다. 선택지는 2–4개, 라벨은 12자 이내.',
      inputSchema: z
        .object({
          question: z.string().max(80),
          options: z
            .array(
              z.object({ id: z.string(), label: z.string().max(20) }).strict(),
            )
            .min(2)
            .max(4),
        })
        .strict(),
      inputExamples: [
        {
          input: {
            question: '몇 시 기차인가요?',
            options: [
              { id: '04:00', label: '오전 4시' },
              { id: '16:00', label: '오후 4시' },
            ],
          },
        },
      ],
      outputSchema: z.union([quickReplyAnswerSchema, skippedSchema]),
    }),
    await_progress: tool({
      description:
        '이동 중 다음 행동 카드(길찾기, 도착·완료·건너뛰기·휴식 버튼)를 띄우고 사용자의 진행 보고를 기다린다. 여정이 시작된 뒤 답을 마칠 때 쓴다. 출발 전에는 쓰지 않는다. 입력은 없다.',
      inputSchema: z.object({}).strict(),
      outputSchema: z.union([progressAnswerSchema, skippedSchema]),
    }),

    // ── Read ──────────────────────────────────────────────────────────
    plan_course: tool({
      description:
        '현재 조건 또는 요청된 변경으로 구룡포 코스를 계산해 미리보기를 만든다. 코스를 처음 보여줄 때, 사용자가 열차 시각·걷기·휴식·장소 제외를 바꾸고 싶다고 할 때 쓴다. 이유를 묻는 질문에는 explain_plan을 쓴다. 저장하지 않으며, 사용자가 말하지 않은 필드는 null이다.',
      inputSchema: z
        .object({ changes: changesSchema(placeIds).nullable() })
        .strict(),
      inputExamples: [
        { input: { changes: null } },
        {
          input: {
            changes: {
              trainTime: '16:00',
              walkingLimit: null,
              extraRestMin: null,
              excludePlaces: ['cafe'],
            },
          },
        },
      ],
      execute: async ({ changes }) => {
        const { state } = ctx.trip()
        const request = (changes as Changes | null) ?? noChanges
        const p = preview(config, state.plan, state.observations, request)
        const id = ctx.newId()
        ctx.remember({ id, revision: p.revision, changes: p.changes })
        return {
          previewId: id,
          isChange: !isEmpty(request),
          revision: p.revision,
          changes: p.changes,
          itinerary: p.itinerary,
        }
      },
      toModelOutput: ({ output }) => ({
        type: 'json',
        value: {
          previewId: output.previewId,
          isChange: output.isChange,
          decision: output.itinerary.decision,
          stops: output.itinerary.stops.map((s) => placeName(s.id)),
          planningArrival:
            output.itinerary.planningArrival === null
              ? null
              : clock(output.itinerary.planningArrival),
          stationTarget: clock(output.itinerary.stationTarget),
          slackMin: output.itinerary.slack,
          reasons: output.itinerary.reasons,
        },
      }),
    }),
    explain_plan: tool({
      description:
        '현재 코스가 왜 이렇게 정해졌는지(시간 계산, 제외된 장소와 이유)를 조회한다. "왜", "이유" 같은 질문에 쓴다. 계획을 바꾸지 않는다. topic으로 설명할 내용을 고른다.',
      inputSchema: z
        .object({ topic: z.enum(['why_course', 'excluded', 'timing']) })
        .strict(),
      execute: async ({ topic }) => {
        const { state, it } = now()
        return {
          topic,
          ...planContext(config, state.plan, state.observations),
          breakdown: {
            readyTime: state.plan.readyTime,
            outboundMin: it.outbound,
            localMin: it.localMin,
            returnMin: it.returnMin,
            trafficReserveMin: it.trafficReserve,
          },
        }
      },
    }),
    check_live_conditions: tool({
      description:
        'E-UM 디지털 트윈(교통 혼잡, 대기)의 실제 연결 상태와 값을 조회한다. "지금도 괜찮아?", "최신 상황" 같은 질문에 쓴다. 계획을 바꾸지 않으며, 일정 계산은 화면의 관측 입력 기준임을 함께 말한다. 입력은 없다.',
      inputSchema: z.object({}).strict(),
      execute: async () => ({
        evidence: (await ctx.observe()).map((e) => ({
          source: e.sourceId,
          label: e.label,
          status: e.status,
          value: e.value,
          unit: e.unit,
          observedAt: e.observedAt,
          freshness: e.freshness,
        })),
        decisionInputs: ctx.trip().state.observations,
      }),
    }),
    compare_transport: tool({
      description:
        '구룡포에서 포항역으로 돌아가는 버스와 택시를 비교만 한다. "택시"를 묻는 질문에 쓴다. 이동수단을 선택하거나 바꾸지 않는다. 입력은 없다.',
      inputSchema: z.object({}).strict(),
      execute: async () => ({
        bus: {
          minutes: config.policy.legs.return.minutes,
          fare: null,
          provenance: 'SIMULATED' as const,
        },
        taxi: {
          minutes: null,
          fare: null,
          provenance: 'NOT_CONNECTED' as const,
        },
        selectionChanged: false,
      }),
    }),
    summarize_trip: tool({
      description:
        '역에 도착해 여정을 마쳤을 때 다녀온 곳과 도착 시각을 정리한다. 여정이 끝났을 때만 쓴다. 입력은 없다.',
      inputSchema: z.object({}).strict(),
      execute: async () => {
        const { state } = ctx.trip()
        return {
          visited: state.plan.completed.map(placeName),
          arrivedAt: state.plan.currentTime,
          trainTime: state.plan.trainTime,
        }
      },
    }),
    show_safety_help: tool({
      description:
        '몸이 불편하다고 할 때 관광을 멈추고 도움 요청 방법을 보여준다. 증상이 언급되면 다른 일보다 먼저 쓴다. 건강을 진단하지 않는다. 입력은 없다.',
      inputSchema: z.object({}).strict(),
      execute: async () => ({
        message:
          '여행 계획을 멈췄어요. 현장 의료부스나 운영요원에게 도움을 요청해 주세요.',
        emergency: '119',
      }),
    }),

    // ── Commit ────────────────────────────────────────────────────────
    update_trip_details: tool({
      description:
        '사용자가 대화에서 말한 여정 정보(열차 시각, 하고 싶은 일, 출발 장소, 도착 일시, 출발 준비 시각, 컨디션, 걷기, 짐)를 저장한다. 사용자가 이런 사실을 말할 때마다 쓴다. 코스가 정해진 뒤의 변경은 plan_course로 하고, 질문에는 쓰지 않는다. 사용자가 분명히 말한 값만 넣고 나머지는 null — 추측하지 않는다. interests는 저장 후의 전체 목록이다: "카페도"처럼 추가하면 여정 요약의 기존 목록에 더해서 넣는다.',
      inputSchema: detailsSchema,
      inputExamples: [
        {
          input: {
            ...noDetails,
            trainTime: '18:30',
            interests: ['food', 'cafe'],
          },
        },
        { input: { ...noDetails, origin: 'HOTEL' } },
        { input: { ...noDetails, condition: 'TIRED', readyTime: '11:10' } },
      ],
      execute: async (details) => {
        const before = ctx.trip().state
        const next = await ctx.commit(
          fillSlots(config, before, details),
          'update_trip_details',
        )
        const prompt = promptFor(config, next.state)
        return {
          saved: describeDetails(config, details),
          tripCreated: !before.created && next.state.created,
          /** The question the app will ask next (the agent does not ask it). */
          nextQuestion: prompt?.question ?? null,
        }
      },
    }),
    record_race_progress: tool({
      description:
        '대회 전후 진행(포항 도착, 출발 준비, 완주)을 기록한다. 사용자가 그 일이 일어났다고 직접 말했을 때만 쓴다. 예정이나 질문에는 쓰지 않는다. milestone 하나를 고른다.',
      inputSchema: z
        .object({ milestone: z.enum(['ARRIVED_POHANG', 'READY', 'FINISHED']) })
        .strict(),
      execute: async ({ milestone }) => {
        const phase = { ARRIVED_POHANG: 1, READY: 2, FINISHED: 3 }[milestone]
        const next = await ctx.commit(
          [
            {
              type: 'day.advanced',
              phase: Math.max(phase, ctx.trip().state.phase),
            },
          ],
          'record_race_progress',
        )
        return { milestone, phase: next.state.phase }
      },
    }),
    apply_plan_change: tool({
      description:
        'plan_course로 만든 변경 미리보기를 여정에 반영한다. 사용자가 변경을 요청했고 plan_course 결과가 있을 때 쓴다. 사용자 승인 후에만 실행되며, 질문·비교에는 쓰지 않는다. previewId는 plan_course 결과의 값을 그대로 쓴다.',
      inputSchema: z.object({ previewId: z.string() }).strict(),
      execute: async ({ previewId }) => {
        const record = ctx.trip()
        const stored = record.meta.previews[previewId]
        if (!stored)
          return { applied: false, reason: 'UNKNOWN_PREVIEW' as const }
        if (stored.revision !== record.state.plan.revision)
          return { applied: false, reason: 'STALE' as const }
        const next = await ctx.commit(
          [{ type: 'plan.patched', patch: stored.changes }],
          'apply_plan_change',
        )
        const it = planner(config)(next.state.plan, next.state.observations)
        return {
          applied: true,
          reason: null,
          planningArrival:
            it.planningArrival === null ? null : clock(it.planningArrival),
        }
      },
    }),
    start_journey: tool({
      description:
        '현재 코스로 구룡포 여정을 시작한다. 사용자가 이 코스로 가겠다고 동의했을 때 쓴다. 코스가 불가능한 상태(귀가 우선, 확인 필요)면 쓰지 않는다. 사용자 승인 후 실행된다.',
      inputSchema: z.object({}).strict(),
      execute: async () => {
        const { state, it } = now()
        if (!canTravel(it)) return { started: false }
        await ctx.commit(accept(state, it).events, 'start_journey')
        return { started: true }
      },
    }),
    set_demo_observation: tool({
      description:
        '시연용 관측·조건 시나리오를 적용한다. 사용자가 "/시연"으로 시작하는 명령을 보냈을 때만 쓴다. 실제 관측이라고 말하지 않는다. scenario는 목록의 id 하나.',
      inputSchema: z
        .object({
          scenario: z
            .enum(config.scenarios.map((s) => s.id) as [string, ...string[]])
            .describe(
              `시나리오 id. ${config.scenarios.map((s) => `${s.id}=${s.title}`).join(', ')}`,
            ),
        })
        .strict(),
      execute: async ({ scenario }) => {
        const { state } = ctx.trip()
        const cmd = runScenario(config, state, scenario)
        await ctx.commit(cmd.events, 'set_demo_observation')
        return { scenario, applied: true }
      },
    }),
  }
}

export type AgentTools = ReturnType<typeof makeTools>
export type ToolName = keyof AgentTools

export { askTools } from './ask-tools'
import { askTools as askToolList } from './ask-tools'
export type { AskTool } from './ask-tools'

// Every ask tool must be a real tool (checked at compile time).
export const askToolNames: ReadonlyArray<ToolName> = askToolList
