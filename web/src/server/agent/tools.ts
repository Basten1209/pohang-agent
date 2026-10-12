import { tool } from 'ai'
import { visitPhotoOffer } from '#/core/visit-photo'
import { z } from 'zod'
import type { Evidence } from '#/core/evidence'
import type { Changes } from '#/core/intents'
import { explainPlan, interestNoun, josa } from '#/core/explain'
import { knowledgeOf, searchKnowledge } from '#/core/knowledge'
import { courseVenues } from '#/core/venues'
import { liveObservationEvents, readingLine } from '#/core/live'
import { defaultDwellOf, interestOfTourType } from '#/core/extra-places'
import {
  observationsKey,
  planningContext,
  preferencesKey,
} from '#/core/agent-plan'
import { directionsUrl } from '#/core/links'
import { canTravel, planEveryCourse, planner } from '#/core/planner'
import { planContext, preview, toPlanPatch } from '#/core/preview'
import {
  activeCourses,
  courseById,
  departLabel,
  hubOf,
  placesOf,
} from '#/core/route'
import type { TripConfig } from '#/core/schema'
import {
  AUTO_COURSE,
  interestSchema,
  timeSchema,
  itineraryProposalSchema,
} from '#/core/schema'
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
import type { TourType } from '../sources/datagokr'
import {
  arrivals,
  distanceM,
  routesAt,
  stopsNear,
  tourDetail,
  tourNearby,
  tourSearch,
  tourTypes,
  trains,
} from '../sources/datagokr'
import { roadOptions, transportLabel } from '#/core/mobility'
import { assessSignals } from '#/core/signals'
import { recommendTransport } from '#/core/transport'
import { forecastForDay } from '../sources/weather'
import { knownPointNames, resolvePoint } from '#/core/where'

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
  /** Check-in has already saved readiness/condition; the first plan must use them once. */
  canProposeChanges?: boolean
  isAI?: () => boolean
  canStoreInitialPlan?: boolean
  progress?: (phase: import('#/core/agent-progress').ProgressPhase) => void
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

export const changesSchema = (
  placeIds: [string, ...string[]],
  courseIds: [string, ...string[]],
) =>
  z
    .object({
      departTime: timeSchema
        .nullable()
        .describe(
          '바뀐 출발 시각(열차·버스·비행기·자가용) 또는 돌아올 시각, 24시간 HH:mm. 언급이 없으면 null',
        ),
      course: z
        .enum(courseIds)
        .nullable()
        .describe('바꾸고 싶은 코스 id(auto=추천). 언급이 없으면 null'),
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
      dropInterests: z
        .array(interestSchema)
        .nullable()
        .describe(
          '어느 코스에서든 빼 달라는 활동(cafe 카페, indoor 실내, walk 산책, view 전망, food 식사). 언급이 없으면 null',
        ),
    })
    .strict()

const noChanges: Changes = {
  departTime: null,
  course: null,
  walkingLimit: null,
  extraRestMin: null,
  excludePlaces: null,
  dropInterests: null,
}
const isEmpty = (c: Changes) => Object.values(c).every((v) => v === null)

export const makeTools = (ctx: TurnContext) => {
  let planningRevision: number | undefined
  // Refreshed after add_nearby_stop so the added spot plans in the same turn.
  let config = ctx.config
  const placeIds = config.places.filter((p) => p.active).map((p) => p.id) as [
    string,
    ...string[],
  ]
  const courseIds = [
    AUTO_COURSE,
    ...activeCourses(config).map((c) => c.id),
  ] as [string, ...string[]]
  const placeName = (id: string) => {
    const place = config.places.find((p) => p.id === id)
    return place ? `${place.attrs.short} (${place.attrs.subtitle})` : id
  }
  const docs = knowledgeOf(config)
  /** Catalogue places (and guide notes) of the area `near` points at, best first. */
  const nearbyDocs = (near: string) => {
    const { state } = ctx.trip()
    const it = planner(config)(state.plan, state.observations)
    const area =
      near === 'HERE' || near === 'COURSE'
        ? courseById(config, it.course)
        : config.courses.find((c) => near.includes(c.area) || c.id === near)
    if (!area) return searchKnowledge(docs, near, 4)
    const refs = new Set(placesOf(config, area.id).map((p) => p.id))
    return docs.filter(
      (d) =>
        (d.kind === 'place' && d.ref && refs.has(d.ref)) ||
        (d.kind === 'guide' && d.text.includes(area.area)),
    )
  }
  const kst = () => new Date(Date.now() + 9 * 3600_000).toISOString()
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
            question: '몇 시에 출발해요?',
            options: [
              { id: '04:00', label: '오전 4시' },
              { id: '16:00', label: '오후 4시' },
            ],
          },
        },
      ],
      outputSchema: z.union([quickReplyAnswerSchema, skippedSchema]),
      toModelOutput: ({ output }) => ({
        type: 'json',
        value:
          'skipped' in output
            ? {
                cardDismissed: true,
                tripChanged: false,
                meaning: '카드 대신 새 메시지를 입력함. 장소 건너뛰기가 아님.',
              }
            : output,
      }),
    }),
    await_progress: tool({
      description:
        '이동 중 다음 행동 카드(길찾기, 도착·완료·건너뛰기·휴식 버튼)를 띄우고 사용자의 진행 보고를 기다린다. 여정이 시작된 뒤 답을 마칠 때 쓴다. 출발 전에는 쓰지 않는다. 입력은 없다.',
      inputSchema: z.object({}).strict(),
      outputSchema: z.union([progressAnswerSchema, skippedSchema]),
      toModelOutput: ({ output }) => ({
        type: 'json',
        value:
          'skipped' in output
            ? {
                cardDismissed: true,
                tripChanged: false,
                meaning: '카드 대신 새 메시지를 입력함. 장소 건너뛰기가 아님.',
              }
            : output,
      }),
    }),

    // ── Read ──────────────────────────────────────────────────────────
    prepare_visit_photo: tool({
      description:
        '사용자가 관광 사진을 커뮤니티에 남기고 싶다고 할 때 채팅 안에 사진 공유 카드를 연다. 사용자의 원문을 request로 전달한다. 현재 관광 중인 장소와 방문 완료한 장소를 제공하며, 방문 기록이나 게시물을 만들지 않는다. 촬영 장소 추천이나 일정 변경에는 쓰지 않는다. 사진 선택과 공개는 사용자가 카드에서 직접 한다.',
      inputSchema: z.object({ request: z.string().max(1000) }).strict(),
      execute: ({ request }) =>
        visitPhotoOffer(config, ctx.trip().state, request),
    }),
    get_planning_context: tool({
      description:
        '일정을 제안하기 전에 반드시 조회한다. 최신 여정 revision, E-UM 관측의 출처·시각·범위, 장소 특성, 수단별 시연 이동시간을 반환한다. 추천은 직접 판단하고 plan_course.proposal로 제출한다. 일정은 바꾸지 않는다.',
      inputSchema: z.object({}).strict(),
      execute: async () => {
        const { state } = ctx.trip()
        planningRevision = state.plan.revision
        return planningContext(config, state.plan, state.observations)
      },
    }),
    plan_course: tool({
      description:
        'get_planning_context의 사실과 사용자 요청을 종합해 직접 선택한 proposal을 제출한다. 장소·순서·체류시간·이동수단·교통 여유·추천 근거를 선택한다. 서버는 시간·보행·경로만 검증한다. validationErrors가 있으면 수정해 다시 제출한다. changes는 사용자가 명시한 제약 변경만, 없으면 null. 최초 유효 제안은 저장하며 기존 일정 변경은 미리보기 후 승인으로 적용한다.',
      inputSchema: z
        .object({
          changes: changesSchema(placeIds, courseIds).nullable(),
          proposal: itineraryProposalSchema.nullable().optional(),
        })
        .strict(),
      inputExamples: [
        { input: { changes: null } },
        {
          input: {
            changes: {
              departTime: '16:00',
              course: null,
              walkingLimit: null,
              extraRestMin: null,
              excludePlaces: null,
              dropInterests: ['cafe'],
            },
          },
        },
      ],
      execute: async ({ changes, proposal }) => {
        ctx.progress?.('PLAN')
        const { state, it: current } = now()
        const request =
          ctx.canProposeChanges === false
            ? noChanges
            : ((changes as Changes | null) ?? noChanges)
        if (ctx.isAI?.()) {
          const fail = (errors: string[]) => ({
            previewId: null as string | null,
            isChange: false,
            noEffect: errors.join(' '),
            validationErrors: errors,
            revision: state.plan.revision,
            changes: {},
            itinerary: current,
            depart: departLabel(config, state.plan),
          })
          if (!proposal)
            return fail([
              'get_planning_context를 조회하고 직접 선택한 proposal을 제출해 주세요.',
            ])
          if (
            planningRevision !== state.plan.revision ||
            proposal.contextRevision !== state.plan.revision
          )
            return fail([
              '관측 또는 여정이 바뀌었어요. get_planning_context를 다시 조회해 주세요.',
            ])
          const patch = toPlanPatch(config, state.plan, request)
          if (request.dropInterests?.length) {
            patch.excluded = [
              ...new Set([
                ...(patch.excluded ?? state.plan.excluded),
                ...config.places
                  .filter((p) =>
                    request.dropInterests!.includes(p.attrs.interest),
                  )
                  .map((p) => p.id),
              ]),
            ]
          }
          const nextPlan = { ...state.plan, ...patch }
          if (
            state.plan.stage !== 'BEFORE' &&
            proposal.course !== current.course
          )
            return fail([
              '이동 중 다른 권역으로 가는 연결 경로 자료가 없어요. 현재 권역 안에서 다시 제안해 주세요.',
            ])
          if (
            proposal.stops.some(
              (s) =>
                nextPlan.excluded.includes(s.place) ||
                nextPlan.completed.includes(s.place),
            )
          )
            return fail([
              '이미 방문했거나 사용자가 제외한 장소는 제안에 넣을 수 없어요.',
            ])
          nextPlan.agentPlan = {
            proposal,
            observationsKey: observationsKey(state.observations),
            preferencesKey: preferencesKey(nextPlan),
            model: config.agent.model,
            createdAt: new Date().toISOString(),
          }
          const it = planner(config)(nextPlan, state.observations)
          if (!canTravel(it)) return fail(it.validationErrors ?? it.reasons)
          const savedChanges = { ...patch, agentPlan: nextPlan.agentPlan }
          const initial =
            !state.plan.agentPlan &&
            state.plan.stage === 'BEFORE' &&
            isEmpty(request) &&
            ctx.canStoreInitialPlan !== false
          if (initial) {
            const saved = await ctx.commit(
              [{ type: 'plan.patched', patch: savedChanges }],
              'agent-initial-plan',
            )
            return {
              previewId: null as string | null,
              isChange: false,
              noEffect: null as string | null,
              validationErrors: [] as string[],
              revision: saved.state.plan.revision,
              changes: savedChanges,
              itinerary: planner(config)(
                saved.state.plan,
                saved.state.observations,
              ),
              depart: departLabel(config, saved.state.plan),
            }
          }
          const id = ctx.newId()
          ctx.remember({
            id,
            revision: state.plan.revision,
            changes: savedChanges,
          })
          return {
            previewId: id as string | null,
            isChange: true,
            noEffect: null as string | null,
            validationErrors: [] as string[],
            revision: state.plan.revision,
            changes: savedChanges,
            itinerary: it,
            depart: departLabel(config, nextPlan),
          }
        }
        const p = preview(config, state.plan, state.observations, request)
        // "카페는 빼 줘" when there is no cafe: nothing to approve.
        const onlyRemovals =
          !isEmpty(request) &&
          request.departTime === null &&
          request.course === null &&
          request.walkingLimit === null &&
          request.extraRestMin === null
        const same =
          p.itinerary.stops.map((s) => s.id).join() ===
          current.stops.map((s) => s.id).join()
        if (onlyRemovals && same) {
          const names = [
            ...(request.dropInterests ?? []).map((i) => interestNoun[i]),
            ...(request.excludePlaces ?? []).map(placeName),
          ]
          return {
            previewId: null,
            isChange: false,
            noEffect: `${josa(names.join('·') || '그 장소', '은', '는')} 이미 일정에 없어요. 일정은 그대로예요.`,
            revision: p.revision,
            changes: {},
            itinerary: current,
            depart: departLabel(config, state.plan),
          }
        }
        const id = ctx.newId()
        ctx.remember({ id, revision: p.revision, changes: p.changes })
        return {
          previewId: id as string | null,
          isChange: !isEmpty(request),
          noEffect: null as string | null,
          revision: p.revision,
          changes: p.changes,
          itinerary: p.itinerary,
          depart: departLabel(config, { ...state.plan, ...p.changes }),
        }
      },
      toModelOutput: ({ output }) => ({
        type: 'json',
        value:
          'validationErrors' in output && output.validationErrors?.length
            ? {
                status: 'REJECTED',
                validationErrors: output.validationErrors,
                instruction:
                  '일정은 저장되지 않았다. 제안을 수정해서 plan_course로 다시 제출한다.',
              }
            : {
                validationErrors:
                  'validationErrors' in output ? output.validationErrors : [],
                previewId: output.previewId,
                isChange: output.isChange,
                noEffect: output.noEffect,
                depart: output.depart,
                course:
                  courseById(config, output.itinerary.course)?.title ?? null,
                hub: hubOf(config, ctx.trip().state.plan).name,
                decision: output.itinerary.decision,
                stops: output.itinerary.stops.map((s) => placeName(s.id)),
                officialCandidates: courseVenues(
                  config,
                  output.itinerary.course,
                ),
                candidateNote:
                  '관광 안내·지도 매장 정보로 확인한 실제 방문 후보. 포항 10미 표시는 음식에 대한 분류이며 가게 인증이 아니다. 일정에 자동 추가되지 않으며 detour=true는 별도 이동이 필요하다. 영업 여부와 이동 시간은 방문 전 확인한다.',
                legs: output.itinerary.legs.map((l) => ({
                  fromTo: l.label,
                  mode: transportLabel[l.mode],
                  minutes: l.totalMin,
                  bufferMin: l.bufferMin,
                  reason: l.reason,
                  provenance: 'DEMO_POLICY',
                })),
                planningArrival:
                  output.itinerary.planningArrival === null
                    ? null
                    : clock(output.itinerary.planningArrival),
                stationTarget: clock(output.itinerary.stationTarget),
                slackMin: output.itinerary.slack,
                slackBasis:
                  'stationTarget(거점 도착 목표) 대비 여유. 열차 출발까지의 시간이 아님.',
                reasons: output.itinerary.reasons,
              },
      }),
    }),
    explain_plan: tool({
      description:
        '현재 코스가 왜 이렇게 정해졌는지(남은 시간, 걷기, 제외된 장소와 이유, 관측 영향)를 조회한다. "왜", "이유" 같은 질문에 쓴다. 답은 summary를 바탕으로 한두 문장. 계획을 바꾸지 않는다.',
      inputSchema: z
        .object({ topic: z.enum(['why_course', 'excluded', 'timing']) })
        .strict(),
      execute: async ({ topic }) => {
        const { state, it } = now()
        return {
          topic,
          /** Quote this: the reasons, computed from the plan itself. */
          summary: explainPlan(config, state.plan, it, state.observations),
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
        'E-UM 디지털 트윈(교통 혼잡, 대기)을 지금 조회하고, 2시간 이내의 교통 혼잡 실측값은 일정 계산에 반영한 뒤 결과를 돌려준다. "지금도 괜찮아?", "시간 돼?", "최신 상황" 같은 질문에 쓴다. 답은 verdict의 도착 시각과 여유(분)로 결론부터 말하고, 관측값은 provenance(LIVE=실측, DEMO=시연 조건, SIMULATED=시연값)와 관측 시각을 함께 말한다. 각 관측의 eligible·단위·지역·최신성을 확인하고, needsReview이면 이전 제안의 타당성을 재검토한다. 입력은 없다.',
      inputSchema: z.object({}).strict(),
      execute: async () => {
        const evidence = await ctx.observe()
        const before = ctx.trip().state
        await ctx.commit(
          liveObservationEvents(config, before.observations, evidence),
          'check_live_conditions',
        )
        const { state, it } = now()
        const obs = state.observations
        const hub = hubOf(config, state.plan)
        return {
          verdict: {
            needsReview: it.needsReview ?? false,
            decision: it.decision,
            decisionScope:
              '관광 코스의 가능 여부. 귀가 일정이나 열차 예약을 취소하는 상태가 아님.',
            reasons: it.reasons,
            hub: hub.name,
            depart: departLabel(config, state.plan),
            arrival:
              it.planningArrival === null ? null : clock(it.planningArrival),
            slackMin: it.slack,
            stationTarget: clock(it.stationTarget),
            slackBasis:
              'stationTarget(거점 도착 목표) 대비 여유. 열차 출발까지의 시간이 아님.',
            trafficReserveMin: it.trafficReserve,
          },
          usedInPlan: {
            congestion: readingLine(obs, 'congestion', '교통 혼잡', '%'),
            provenance: obs.sources.congestion?.provenance ?? 'SIMULATED',
          },
          evidence: evidence.map((e) => ({
            source: e.sourceId,
            label: e.label,
            status: e.status,
            value: e.value,
            unit: e.unit,
            observedAt: e.observedAt,
            freshness: e.freshness,
            usedInPlan:
              obs.sources[e.reading]?.eligible === true &&
              obs.freshness === 'FRESH' &&
              it.calculationStatus !== 'NOT_RUN' &&
              (it.course === 'guryongpo' ||
                (e.reading === 'congestion' &&
                  it.legs.some((leg) => leg.trafficScope))),
          })),
        }
      },
    }),
    compare_transport: tool({
      description:
        '코스 권역에서 귀가 거점(역·터미널·공항·대회장)으로 돌아가는 대중교통과 택시를 비교만 한다. "택시"를 묻는 질문에 쓴다. 이동수단을 선택하거나 바꾸지 않는다. 입력은 없다.',
      inputSchema: z.object({}).strict(),
      execute: async () => {
        const { state, it } = now()
        const course = courseById(config, it.course)
        const hub = hubOf(config, state.plan)
        const options = course
          ? roadOptions(
              course,
              'RETURN',
              hub.id,
              state.plan.agentPlan?.proposal.trafficBufferMin ??
                assessSignals(config.policy, state.observations).reserveMin,
            )
          : []
        const transit = options.find((o) => o.mode === 'TRANSIT')
        const taxi = options.find((o) => o.mode === 'TAXI')
        return {
          from: course?.area ?? null,
          to: hub.name,
          transit: {
            minutes: transit?.totalMin ?? null,
            via: transit?.via ?? null,
            provenance: 'DEMO_POLICY' as const,
          },
          taxi: {
            minutes: taxi?.totalMin ?? null,
            fare: null,
            provenance: 'DEMO_POLICY' as const,
            note: '시연 추정시간이며 실제 경로·배차·요금은 지도·카카오T에서 확인하세요.',
          },
          segments: it.legs.map((l) => ({
            label: l.label,
            mode: transportLabel[l.mode],
            minutes: l.totalMin,
            rideMin: l.rideMin,
            waitMin: l.waitMin,
            walkMin: l.walkMin,
            bufferMin: l.bufferMin,
            reason: l.reason,
          })),
          recommendation: recommendTransport(
            state.plan,
            state.observations,
            it,
          ),
          selectionChanged: false,
        }
      },
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
          hub: hubOf(config, state.plan).name,
          depart: departLabel(config, state.plan),
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

    // ── Read: knowledge and live data ─────────────────────────────────
    get_race_info: tool({
      description:
        '대회 정보(일시·장소, 당일 일정, 대회 코스, 준비물, 현장 시설, 규정·안내, 자주 묻는 질문)를 조회한다. 대회·레이스·배번·급수대·물품보관 같은 질문에 쓴다. 관광 코스가 아니라 달리는 대회 코스는 topic=course. 계획을 바꾸지 않는다.',
      inputSchema: z
        .object({
          topic: z.enum([
            'overview',
            'schedule',
            'course',
            'kit',
            'facilities',
            'rules',
            'faq',
            'all',
          ]),
        })
        .strict(),
      execute: async ({ topic }) => {
        const e = config.event
        const parts = {
          overview: {
            name: e.name,
            date: e.dateLabel,
            gun: e.gun,
            category: e.category,
            venue: e.venue,
            address: e.address,
            cutoff: e.cutoff,
          },
          schedule: e.schedule,
          course: e.course,
          kit: e.kit,
          facilities: e.facilities,
          rules: { rules: e.rules, notes: e.notes },
          faq: e.faq,
        }
        return {
          topic,
          provenance: 'DEMO' as const,
          info: topic === 'all' ? parts : { [topic]: parts[topic] },
        }
      },
    }),
    search_guide: tool({
      description:
        '앱이 가진 포항 안내 자료(관광 코스, 장소 설명·팁, 귀가 방법, 포항 볼거리·먹거리·교통·축제, 대회 FAQ)를 키워드로 검색한다. "뭐가 유명해", "어디 가면 좋아", "버스는 어떻게 타", "과메기 철" 같은 일반 질문에 먼저 쓴다. 답은 결과에 있는 내용만 쓴다. query는 핵심 단어 2–5개.',
      inputSchema: z.object({ query: z.string().min(1).max(80) }).strict(),
      inputExamples: [
        { input: { query: '구룡포 유명 음식' } },
        { input: { query: '포항역 가는 버스 택시' } },
      ],
      execute: async ({ query }) => {
        const hits = searchKnowledge(docs, query, 4)
        return {
          query,
          results: hits.map((d) => ({
            title: d.title,
            text: d.text.slice(0, 500),
            kind: d.kind,
            source: d.source ?? null,
          })),
          note: hits.length
            ? '앱에 정리된 안내예요. 운영시간·요금은 바뀔 수 있어요.'
            : '앱 자료에 없어요. find_nearby(실시간 관광정보)나 다른 단어로 다시 찾아보세요.',
        }
      },
    }),
    compare_courses: tool({
      description:
        '지금 조건(출발 시각, 준비 시각, 컨디션, 하고 싶은 일)으로 구룡포·호미곶 코스를 계산해 비교한다. "다른 코스는?", "어디가 제일 여유 있어?", "호미곶도 갈 수 있어?" 같은 질문에 쓴다. 저장하지 않는다. 바꾸려면 plan_course(changes.course). 입력은 없다.',
      inputSchema: z.object({}).strict(),
      execute: async () => {
        const { state, it } = now()
        return {
          current: it.course,
          context: ctx.isAI?.()
            ? planningContext(config, state.plan, state.observations)
            : null,
          courses: (ctx.isAI?.()
            ? []
            : planEveryCourse(config, state.plan, state.observations)
          ).map((c) => {
            const course = courseById(config, c.course)
            return {
              id: c.course,
              title: course?.title ?? c.course,
              decision: c.decision,
              stops: c.stops.map((s) => placeName(s.id)),
              arrival:
                c.planningArrival === null ? null : clock(c.planningArrival),
              slackMin: c.slack,
              outboundMin: c.outbound,
              reason: c.reasons[0] ?? null,
            }
          }),
        }
      },
    }),
    find_nearby: tool({
      description:
        '한국관광공사 관광정보로 특정 위치 주변의 관광지·음식점·카페·숙박·행사를 실시간 조회한다. "근처 맛집", "구룡포 근처 볼거리", "영일대 근처 숙소" 같은 질문에 쓴다. near는 장소 이름이나 HERE(현재 위치)·COURSE(현재 코스 권역). keyword가 있으면 포항 안에서 이름으로 찾는다. 결과의 contentId로 get_place_detail을 부를 수 있다.',
      inputSchema: z
        .object({
          near: z
            .string()
            .describe(
              `위치. 예: ${knownPointNames(config).slice(0, 12).join(', ')}`,
            ),
          type: z
            .enum(Object.keys(tourTypes) as [TourType, ...TourType[]])
            .nullable()
            .describe(
              'sight 관광지 · culture 문화시설 · festival 행사 · leisure 레포츠 · stay 숙박 · shopping 쇼핑 · food 음식점(카페 포함). 모르면 null',
            ),
          keyword: z.string().max(30).nullable(),
          radiusM: z.number().int().min(200).max(20000).nullable(),
        })
        .strict(),
      execute: async ({ near, type, keyword, radiusM }) => {
        const { state } = ctx.trip()
        const it = planner(config)(state.plan, state.observations)
        const point = resolvePoint(config, state.plan, near, it.course)
        const area =
          near === 'COURSE' ||
          (near === 'HERE' && state.plan.currentPlace === 'COURSE')
            ? courseById(config, it.course)
            : activeCourses(config).find(
                (c) => near.includes(c.area) || c.id === near,
              )
        const officialCandidates = area
          ? courseVenues(config, area.id).filter(
              (v) =>
                (!type ||
                  (type === 'food'
                    ? v.kind !== 'sight'
                    : ['sight', 'culture'].includes(type)
                      ? v.kind === 'sight'
                      : false)) &&
                (!keyword ||
                  `${v.name} ${v.highlight} ${v.kind === 'cafe' ? '카페 커피' : ''}`.includes(
                    keyword,
                  )),
            )
          : []
        const candidateNote =
          '관광 안내·지도 매장 정보에서 찾은 방문 후보이며 실시간 영업 확인 결과는 아니에요. 별도 이동 후보는 현재 일정에 포함되지 않아요.'
        const live = keyword
          ? await tourSearch({ keyword, type: type ?? undefined, limit: 8 })
          : point
            ? await tourNearby({
                lat: point.lat,
                lng: point.lng,
                radiusM: radiusM ?? 2000,
                type: type ?? undefined,
                limit: 8,
              })
            : null
        if (!live)
          return {
            status: 'UNKNOWN_PLACE' as const,
            message: `"${near}" 위치를 찾지 못했어요. 장소 이름을 바꿔 다시 시도하세요.`,
          }
        if (live.status !== 'LIVE')
          return {
            status: live.status,
            message: live.message,
            officialCandidates,
            candidateNote,
            // The curated guide, kept to the area asked about.
            fallback: nearbyDocs(near)
              .slice(0, 4)
              .map((d) => ({
                title: d.title,
                text: d.text.slice(0, 200),
                source: d.source ?? null,
              })),
          }
        return {
          status: 'LIVE' as const,
          near: point?.name ?? near,
          source: '한국관광공사 TourAPI',
          officialCandidates,
          candidateNote,
          results: live.data.map((r) => ({
            contentId: r.id,
            typeId: r.typeId,
            type: r.type,
            title: r.title,
            address: r.address,
            tel: r.tel || null,
            distanceM:
              r.distanceM ??
              (point && r.lat !== null && r.lng !== null
                ? distanceM(point, { lat: r.lat, lng: r.lng })
                : null),
          })),
        }
      },
    }),
    add_nearby_stop: tool({
      description:
        'find_nearby로 찾은 주변 장소를 이 여행에서 고를 수 있는 장소로 등록한다(일정은 아직 그대로). 사용자가 "그곳도 코스에 넣어 줘"처럼 코스 밖 장소 추가를 원할 때 쓴다. contentId만 넘기면 이름·좌표는 한국관광공사 관광정보에서 다시 확인한다. 등록 뒤 get_planning_context → plan_course proposal의 stops에 돌려받은 placeId를 넣고, 변경은 apply_plan_change 승인으로 확정한다.',
      inputSchema: z
        .object({
          contentId: z
            .string()
            .regex(/^\d{1,12}$/)
            .describe('find_nearby 결과의 contentId'),
          interest: interestSchema
            .nullable()
            .describe('food·cafe·view·walk·indoor 중 성격. 모르면 null'),
          dwell: z
            .number()
            .int()
            .min(10)
            .max(120)
            .nullable()
            .describe('머무를 분. 모르면 null'),
        })
        .strict(),
      execute: async ({ contentId, interest, dwell }) => {
        const { state, it } = now()
        const course = courseById(config, it.course)
        if (!course)
          return {
            added: false,
            message: '먼저 코스가 정해져야 주변 장소를 더할 수 있어요.',
          }
        const live = await tourDetail(contentId)
        if (live.status !== 'LIVE')
          return { added: false, message: live.message }
        const found = live.data
        if (found.lat === null || found.lng === null)
          return {
            added: false,
            message: '관광정보에 위치가 없어 일정에 넣을 수 없어요.',
          }
        const geo = { lat: found.lat, lng: found.lng }
        const far = distanceM(geo, course.geo)
        if (far > 5000)
          return {
            added: false,
            message: `${course.area}에서 ${Math.round(far / 100) / 10}km 떨어져 있어 이 코스에 넣기 어려워요.`,
          }
        const kind = interest ?? interestOfTourType(found.typeId)
        const extra = {
          id: `tour-${contentId}`,
          contentId,
          title: found.title.slice(0, 80),
          address: found.address.slice(0, 200),
          image: found.image.slice(0, 500),
          interest: kind,
          course: course.id,
          geo,
          dwell: dwell ?? defaultDwellOf[kind],
        }
        const others = (state.plan.extraPlaces ?? []).filter(
          (e) => e.id !== extra.id,
        )
        if (others.length >= 8)
          return {
            added: false,
            message:
              '이 여행에 더한 주변 장소가 이미 많아요. 하나를 빼고 다시 시도해 주세요.',
          }
        await ctx.commit(
          [
            {
              type: 'plan.patched',
              patch: { extraPlaces: [...others, extra] },
            },
          ],
          'agent',
        )
        config = ctx.config
        return {
          added: true,
          placeId: extra.id,
          title: extra.title,
          interest: kind,
          dwell: extra.dwell,
          course: course.id,
          next: 'get_planning_context를 다시 조회한 뒤 plan_course proposal의 stops에 placeId를 넣어 제출하고, apply_plan_change로 확정한다.',
        }
      },
    }),
    get_place_detail: tool({
      description:
        '한국관광공사 관광정보에서 한 곳의 상세(개요, 이용시간, 쉬는 날, 주차, 대표 메뉴, 홈페이지)를 조회한다. find_nearby 결과의 contentId·typeId로 쓴다. 영업시간·휴무를 묻는 질문에 쓴다.',
      inputSchema: z
        .object({ contentId: z.string(), typeId: z.string().nullable() })
        .strict(),
      execute: async ({ contentId, typeId }) => {
        const live = await tourDetail(contentId, typeId ?? undefined)
        return live.status === 'LIVE'
          ? {
              status: 'LIVE' as const,
              source: '한국관광공사 TourAPI',
              place: live.data,
            }
          : { status: live.status, message: live.message }
      },
    }),
    get_directions: tool({
      description:
        '두 곳 사이 이동 방법을 안내한다: 카카오맵 대중교통·자동차·도보 길찾기 링크, 직선거리, 앱 코스의 시연 이동시간(있을 때), 출발지 근처 버스정류장과 실시간 도착. "버스 뭐 타요", "어떻게 가요", "얼마나 걸려요"에 쓴다. from은 생략하면 현재 위치(HERE).',
      inputSchema: z
        .object({
          from: z
            .string()
            .nullable()
            .describe('출발지 이름. 모르면 null(현재 위치)'),
          to: z
            .string()
            .describe(
              `도착지. 예: ${knownPointNames(config).slice(2, 14).join(', ')}`,
            ),
        })
        .strict(),
      execute: async ({ from, to }) => {
        const { state, it } = now()
        const courseId = it.course
        const a = resolvePoint(config, state.plan, from ?? 'HERE', courseId)
        const b = resolvePoint(config, state.plan, to, courseId)
        if (!a || !b)
          return {
            status: 'UNKNOWN_PLACE' as const,
            message: `위치를 찾지 못했어요: ${!a ? (from ?? '현재 위치') : to}`,
          }
        const stops = await stopsNear({ lat: a.lat, lng: a.lng, limit: 2 })
        const nearest =
          stops.status === 'LIVE'
            ? await Promise.all(
                stops.data.map(async (st) => {
                  const arr = await arrivals(st.cityCode, st.id)
                  return {
                    stop: st.name,
                    distanceM: st.distanceM,
                    arrivals:
                      arr.status === 'LIVE'
                        ? arr.data.slice(0, 5).map((x) => ({
                            route: x.route,
                            inMin: x.minutes,
                            stopsAway: x.stopsAway,
                          }))
                        : [],
                  }
                }),
              )
            : null
        const matchingLeg = it.legs.find(
          (l) => l.label === `${a.name} → ${b.name}`,
        )
        return {
          from: a.name,
          to: b.name,
          straightKm: Math.round(distanceM(a, b) / 100) / 10,
          links: {
            transit: directionsUrl(a, b, 'traffic'),
            car: directionsUrl(a, b, 'car'),
            walk: directionsUrl(a, b, 'walk'),
          },
          appEstimate: matchingLeg
            ? {
                minutes: matchingLeg.totalMin,
                via: transportLabel[matchingLeg.mode],
                provenance: 'DEMO_POLICY',
                rideMin: matchingLeg.rideMin,
                waitMin: matchingLeg.waitMin,
                walkMin: matchingLeg.walkMin,
                bufferMin: matchingLeg.bufferMin,
              }
            : null,
          busStops: nearest,
          busStatus:
            stops.status === 'LIVE'
              ? 'LIVE'
              : `${stops.status}: ${stops.message}`,
          note: '정확한 노선·환승은 transit 링크(카카오맵)에서 확인하세요. 버스 번호를 지어내지 마세요.',
        }
      },
    }),
    get_bus_arrivals: tool({
      description:
        '국토교통부 TAGO로 한 위치 근처 버스정류장, 지나는 노선, 실시간 도착 예정을 조회한다. "버스 언제 와요", "여기 무슨 버스 다녀요"에 쓴다. near는 장소 이름 또는 HERE.',
      inputSchema: z.object({ near: z.string() }).strict(),
      execute: async ({ near }) => {
        const { state, it } = now()
        const p = resolvePoint(config, state.plan, near, it.course)
        if (!p)
          return {
            status: 'UNKNOWN_PLACE' as const,
            message: `"${near}" 위치를 찾지 못했어요.`,
          }
        const stops = await stopsNear({ lat: p.lat, lng: p.lng, limit: 3 })
        if (stops.status !== 'LIVE')
          return { status: stops.status, message: stops.message }
        const detail = await Promise.all(
          stops.data.map(async (st) => {
            const [arr, routes] = await Promise.all([
              arrivals(st.cityCode, st.id),
              routesAt(st.cityCode, st.id),
            ])
            return {
              stop: st.name,
              stopNo: st.no,
              distanceM: st.distanceM,
              arrivals:
                arr.status === 'LIVE'
                  ? arr.data.slice(0, 6).map((x) => ({
                      route: x.route,
                      inMin: x.minutes,
                      stopsAway: x.stopsAway,
                    }))
                  : null,
              routes:
                routes.status === 'LIVE'
                  ? routes.data.slice(0, 12).map((r) => ({
                      no: r.no,
                      from: r.from,
                      to: r.to,
                    }))
                  : null,
            }
          }),
        )
        return {
          status: 'LIVE' as const,
          source: '국토교통부 TAGO',
          near: p.name,
          asOf: kst().slice(11, 16),
          stops: detail,
        }
      },
    }),
    get_train_times: tool({
      description:
        '국토교통부 TAGO로 열차 시간표(KTX 등 코레일 열차)를 조회한다. "서울 가는 기차 몇 시 있어?", "막차"에 쓴다. 기본은 포항 출발, 대회 날짜. 예매·좌석은 조회하지 않는다.',
      inputSchema: z
        .object({
          from: z.string().nullable().describe('출발역. 기본 포항'),
          to: z.string().describe('도착역. 예: 서울, 동대구, 부산, 대전'),
          date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .nullable()
            .describe('YYYY-MM-DD. 기본 대회 날짜'),
          after: timeSchema.nullable().describe('이 시각 이후 열차만'),
        })
        .strict(),
      execute: async ({ from, to, date, after }) => {
        const live = await trains({
          from: from ?? '포항',
          to,
          date: date ?? config.event.date,
        })
        if (live.status !== 'LIVE')
          return { status: live.status, message: live.message }
        const list = live.data.filter((t) => !after || t.departs >= after)
        return {
          status: 'LIVE' as const,
          source: '국토교통부 TAGO 열차정보',
          date: date ?? config.event.date,
          trains: list.slice(0, 12),
          total: list.length,
          note: 'SRT는 포함되지 않을 수 있어요. 예매는 코레일톡·SRT 앱에서.',
        }
      },
    }),
    get_weather: tool({
      description:
        '기상청 단기예보로 포항 지역 날씨(기온, 하늘, 강수확률, 바람)를 시간대별로 조회한다. "날씨 어때", "비 와?", "바람 세?"에 쓴다. 예보는 약 3일 뒤까지만 있다.',
      inputSchema: z
        .object({
          near: z.string().nullable().describe('위치. 기본 대회장'),
          date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .nullable()
            .describe('YYYY-MM-DD. 기본 오늘'),
        })
        .strict(),
      execute: async ({ near, date }) => {
        const { state, it } = now()
        const p =
          resolvePoint(config, state.plan, near ?? 'RACE', it.course) ??
          resolvePoint(config, state.plan, 'RACE')!
        // The short-term forecast reaches about 3 days ahead: say when to ask.
        const want = date ?? kst().slice(0, 10)
        const daysAhead = Math.round(
          (Date.parse(`${want}T00:00:00Z`) -
            Date.parse(`${kst().slice(0, 10)}T00:00:00Z`)) /
            86_400_000,
        )
        if (daysAhead > 3) {
          const from = new Date(
            Date.parse(`${want}T00:00:00Z`) - 3 * 86_400_000,
          )
            .toISOString()
            .slice(0, 10)
          return {
            status: 'OUT_OF_RANGE' as const,
            date: want,
            note: `${want} 예보는 아직 없어요. 기상청 단기예보는 3일 뒤까지라 ${from}부터 확인할 수 있어요.`,
          }
        }
        const result = await forecastForDay(p, want)
        const daytime = result.hours.filter(
          (h) => h.time >= '06:00' && h.time <= '20:00',
        )
        return {
          ...result,
          near: p.name,
          hours: (daytime.length ? daytime : result.hours)
            .filter((_, i) => i % 2 === 0)
            .slice(0, 8),
        }
      },
    }),

    // ── Commit ────────────────────────────────────────────────────────
    update_trip_details: tool({
      description:
        '사용자가 대화에서 말한 여정 정보(돌아가는 방법, 출발 시각, 가고 싶은 코스, 하고 싶은 일, 출발 장소, 도착 일시, 출발 준비 시각, 컨디션, 걷기, 짐)를 저장한다. 사용자가 이런 사실을 말할 때마다 쓴다. 코스가 정해진 뒤의 변경은 plan_course로 하고, 질문에는 쓰지 않는다. 사용자가 분명히 말한 값만 넣고 나머지는 null — 추측하지 않는다. interests는 저장 후의 전체 목록이다: "카페도"처럼 추가하면 여정 요약의 기존 목록에 더해서 넣는다.',
      inputSchema: detailsSchema,
      inputExamples: [
        {
          input: {
            ...noDetails,
            departMode: 'TRAIN',
            departTime: '18:30',
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
        if (
          stored.changes.agentPlan &&
          !canTravel(
            planner(config)(
              { ...record.state.plan, ...stored.changes },
              record.state.observations,
            ),
          )
        )
          return { applied: false, reason: 'INVALID_PLAN' as const }
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
        '현재 코스로 여정을 시작한다. 사용자가 이 코스로 가겠다고 동의했을 때 쓴다. 코스가 불가능한 상태(귀가 우선, 확인 필요)면 쓰지 않는다. 사용자 승인 후 실행된다.',
      inputSchema: z.object({}).strict(),
      execute: async () => {
        const { state, it } = now()
        if (ctx.isAI?.() && !state.plan.agentPlan)
          return {
            started: false,
            reason:
              '먼저 get_planning_context와 plan_course로 일정을 제안해 주세요.',
          }
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
