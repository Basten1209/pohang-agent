import { z } from 'zod'
import { clamp, toggle, uniq } from './fp'
import type { Itinerary } from './planner'
import { canTravel } from './planner'
import type { Observations, Plan, Screen, TripConfig } from './schema'
import { observationsSchema, planSchema, screenSchema } from './schema'
import { clock, minutes } from './time'

/**
 * Trip state is a left fold over events: `state = events.reduce(apply, initial)`.
 *
 * Events are plain JSON (stored as jsonb on the server), so the history of a
 * trip can be replayed, audited, or analysed. Commands below are pure
 * functions `state → events`; the UI only dispatches what they return.
 */

export const tripStateSchema = z.object({
  version: z.literal(2),
  screen: screenSchema,
  plan: planSchema,
  observations: observationsSchema,
  phase: z.number().int().min(0).max(2),
  candidate: z.boolean(),
  checks: z.array(z.boolean()).length(3),
  created: z.boolean(),
})
export type TripState = z.infer<typeof tripStateSchema>

export const initialTrip = (config: TripConfig): TripState => ({
  version: 2,
  screen: 'plan',
  plan: structuredClone(config.defaults.plan),
  observations: structuredClone(config.defaults.observations),
  phase: 0,
  candidate: false,
  checks: [false, false, false],
  created: false,
})

export type TripEvent =
  | { type: 'plan.patched'; patch: Partial<Plan> }
  | { type: 'observations.patched'; patch: Partial<Observations> }
  | { type: 'readings.patched'; readings: Record<string, number | null> }
  | { type: 'screen.changed'; screen: Screen }
  | { type: 'trip.created' }
  | { type: 'day.advanced'; phase: number }
  | { type: 'day.checkToggled'; index: number }
  | { type: 'candidate.toggled' }
  | { type: 'trip.reset'; plan: Plan; observations: Observations }

type Handlers = {
  [K in TripEvent['type']]: (
    state: TripState,
    event: Extract<TripEvent, { type: K }>,
  ) => TripState
}

/** Plan and observation changes bump the revision; navigation does not. */
const bump = (state: TripState, plan: Partial<Plan> = {}): TripState => ({
  ...state,
  plan: { ...state.plan, ...plan, revision: state.plan.revision + 1 },
})

const handlers: Handlers = {
  'plan.patched': (s, e) => bump(s, e.patch),
  'observations.patched': (s, e) =>
    bump({ ...s, observations: { ...s.observations, ...e.patch } }),
  'readings.patched': (s, e) =>
    bump({
      ...s,
      observations: {
        ...s.observations,
        readings: { ...s.observations.readings, ...e.readings },
      },
    }),
  'screen.changed': (s, e) => ({ ...s, screen: e.screen }),
  'trip.created': (s) => ({ ...s, created: true }),
  'day.advanced': (s, e) => ({ ...s, phase: clamp(0, 2)(e.phase) }),
  'day.checkToggled': (s, e) => ({
    ...s,
    checks: s.checks.map((c, i) => (i === e.index ? !c : c)),
  }),
  'candidate.toggled': (s) => ({ ...s, candidate: !s.candidate }),
  'trip.reset': (s, e) => ({
    ...s,
    screen: 'plan',
    phase: 0,
    candidate: false,
    checks: [false, false, false],
    created: false,
    observations: e.observations,
    plan: { ...e.plan, revision: s.plan.revision + 1 },
  }),
}

export const apply = (state: TripState, event: TripEvent): TripState =>
  (handlers[event.type] as (s: TripState, e: TripEvent) => TripState)(
    state,
    event,
  )

export const replay = (initial: TripState, events: ReadonlyArray<TripEvent>) =>
  events.reduce(apply, initial)

// ── Commands: state (+ derived itinerary) → events ──────────────────────

export type Command = { events: TripEvent[]; notice?: string; open?: string }

const patch = (p: Partial<Plan>): TripEvent => ({
  type: 'plan.patched',
  patch: p,
})
const go = (screen: Screen): TripEvent => ({ type: 'screen.changed', screen })

export const navigate = (state: TripState, target: Screen): Command => {
  if (target !== 'plan' && !state.created)
    return { events: [], notice: '먼저 내 하루를 만들어 주세요.' }
  if (
    (target === 'course' || target === 'next') &&
    state.plan.condition === 'UNANSWERED'
  )
    return { events: [go('finish')] }
  if (target === 'next' && state.plan.stage === 'BEFORE')
    return { events: [], notice: '구룡포 코스를 먼저 선택해 주세요.' }
  return { events: [go(target)] }
}

export const createTrip = (config: TripConfig, state: TripState): Command => {
  const deadline = Date.parse('2026-10-13T09:00:00+09:00')
  if (Date.parse(`${state.plan.arrivalAt}:00+09:00`) >= deadline)
    return { events: [], notice: '포항 도착은 대회 출발 전으로 입력해 주세요.' }
  const ids = config.places.filter((p) => p.active).map((p) => p.id)
  return {
    events: [
      patch({
        excluded: ids.filter((id) => !state.plan.interests.includes(id)),
      }),
      { type: 'trip.created' },
      go('day'),
    ],
  }
}

export const accept = (state: TripState, it: Itinerary): Command =>
  canTravel(it)
    ? {
        events: [
          patch({
            stage:
              state.plan.stage === 'BEFORE' ? 'OUTBOUND' : state.plan.stage,
          }),
          go('next'),
        ],
      }
    : { events: [] }

/** Confirm the next arrival or completion. Location is never tracked. */
export const advance = (
  config: TripConfig,
  state: TripState,
  it: Itinerary,
): Command => {
  const { plan } = state
  if (plan.stage === 'OUTBOUND')
    return {
      events: [
        patch({
          stage: 'LOCAL',
          currentPlace: 'GURYONGPO',
          currentTime: clock(it.start + config.policy.legs.outbound.minutes),
          restMin: 0,
        }),
      ],
    }
  if (plan.stage === 'LOCAL' && it.stops.length) {
    const [stop] = it.stops
    return {
      events: [
        patch({
          completed: uniq([...plan.completed, stop.id]),
          currentTime: clock(stop.end),
          restMin: 0,
        }),
      ],
    }
  }
  if (plan.stage === 'RETURN')
    return {
      events: [
        patch({
          stage: 'DONE',
          currentPlace: 'STATION',
          currentTime: clock(it.stationEta ?? minutes(plan.currentTime)),
          restMin: 0,
        }),
      ],
    }
  return { events: [] }
}

export const startReturn = (state: TripState): Command =>
  state.plan.currentPlace !== 'GURYONGPO'
    ? { events: [], open: 'STATION' }
    : { events: [patch({ stage: 'RETURN', restMin: 0 }), go('next')] }

export const skipStop = (state: TripState, it: Itinerary): Command =>
  it.stops.length
    ? {
        events: [
          patch({ excluded: uniq([...state.plan.excluded, it.stops[0].id]) }),
        ],
        notice: '이 장소를 빼고 남은 일정을 다시 계산했어요.',
      }
    : { events: [] }

export const restMore = (
  config: TripConfig,
  state: TripState,
  by = 30,
): Command => ({
  events: [
    patch({
      restMin: Math.min(config.policy.restCapMin, state.plan.restMin + by),
    }),
  ],
  notice: '조건에 맞춰 코스를 다시 계산했어요.',
})

export const toggleExcluded = (state: TripState, id: string): Command => ({
  events: [patch({ excluded: toggle(state.plan.excluded, id) })],
  notice: '조건에 맞춰 코스를 다시 계산했어요.',
})

export const toggleWalking = (state: TripState): Command => ({
  events: [patch({ walkingLimit: state.plan.walkingLimit === 30 ? 15 : 30 })],
  notice: '조건에 맞춰 코스를 다시 계산했어요.',
})

export const changeTrain = (trainTime: string): Command => ({
  events: [patch({ trainTime })],
  notice: '조건에 맞춰 코스를 다시 계산했어요.',
})

/** Apply an agent preview only if the plan has not changed since it was made. */
export const applyPreview = (
  state: TripState,
  preview: { revision: number; changes: Partial<Plan> },
): Command =>
  preview.revision === state.plan.revision
    ? {
        events: [patch(preview.changes)],
        notice: '요청한 변경을 일정에 반영했어요.',
      }
    : { events: [], notice: '조건이 바뀌었어요. 다시 요청해 주세요.' }

export const runScenario = (
  config: TripConfig,
  state: TripState,
  id: string,
): Command => {
  if (id === 'reset')
    return {
      events: [
        {
          type: 'trip.reset',
          plan: structuredClone(config.defaults.plan),
          observations: structuredClone(config.defaults.observations),
        },
      ],
      notice: '처음부터 다시 시작해요.',
    }
  const scenario = config.scenarios.find((s) => s.id === id)
  if (!scenario) return { events: [] }
  const reset = scenario.base === 'reset'
  const plan: Plan = reset
    ? {
        ...config.defaults.plan,
        ...scenario.plan,
        revision: state.plan.revision,
      }
    : { ...state.plan, ...scenario.plan }
  const baseObs = reset ? config.defaults.observations : state.observations
  const observations: Observations = {
    ...baseObs,
    ...scenario.observations,
    readings: { ...baseObs.readings, ...scenario.readings },
  }
  return {
    events: [
      patch(plan),
      { type: 'observations.patched', patch: observations },
      ...(reset ? [{ type: 'trip.created' } as const] : []),
      ...(scenario.screen ? [go(scenario.screen)] : []),
    ],
    notice: '시연 조건을 적용했어요.',
  }
}
