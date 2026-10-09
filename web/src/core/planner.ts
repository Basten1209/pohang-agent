import type { Rule } from './fp'
import { decideWith, indexBy, sum } from './fp'
import { activeCourses, courseById, hubOf, isHub } from './route'
import type {
  Course,
  HubId,
  Mode,
  Observations,
  Place,
  PlaceId,
  Plan,
  TripConfig,
  Variant,
} from './schema'
import { AUTO_COURSE } from './schema'
import type { Effect } from './signals'
import { assessSignals, fill } from './signals'
import { minutes, within } from './time'

/**
 * The decision engine: `planner(config)(plan, observations) → Itinerary`.
 *
 * Pure and deterministic. For one course it is a short list of rules tried
 * in priority order (medical first, then completeness, then routes, then the
 * variant search). With `course: 'auto'` every active course is planned and
 * the best fit wins. All numbers come from config (`courses`, `modes`,
 * `policy`); this file only knows how to combine them.
 *
 * "Station" in field names means the trip's hub: the station, bus terminal,
 * airport or race parking, depending on how the runner leaves.
 */

export type Decision =
  | 'GO'
  | 'SHORTEN'
  | 'INDOOR'
  | 'CANCEL'
  | 'MEDICAL_FIRST'
  | 'NEEDS_DATA'
  | 'INCOMPLETE'

export type Stop = { id: PlaceId; start: number; end: number; dwell: number }

export type Itinerary = {
  decision: Decision
  calculationStatus: 'READY' | 'PARTIAL' | 'NOT_RUN' | 'NEEDS_DATA'
  executionMode: 'DEMO'
  /** The course this itinerary is for (chosen, or picked by `auto`). */
  course: string | null
  /** Other courses that can be done under the same conditions (at most 3). */
  alternatives: string[]
  hub: HubId
  variant: string | null
  revision: number
  start: number
  stops: Stop[]
  stationEta: number | null
  planningArrival: number | null
  stationTarget: number
  slack: number | null
  walking: number
  localMin: number
  outbound: number
  returnMin: number
  returnDeparture: number | null
  trafficReserve: number
  reasons: string[]
  excluded: { id: PlaceId; reason: string }[]
}

export const canTravel = (it: Itinerary) =>
  it.decision === 'GO' || it.decision === 'SHORTEN' || it.decision === 'INDOOR'

type Context = {
  config: TripConfig
  plan: Plan
  obs: Observations
  course: Course
  mode: Mode
  hub: { id: HubId; name: string }
  /** Minutes from the course area to the hub; null = no registered route. */
  hubMin: number | null
  start: number
  target: number
  effect: Effect
  places: Record<PlaceId, Place>
  base: Itinerary
}

const contextOf = (
  config: TripConfig,
  plan: Plan,
  obs: Observations,
  course: Course,
): Context => {
  const { policy } = config
  const { mode, ...hub } = hubOf(config, plan)
  const start =
    Math.max(minutes(plan.readyTime), minutes(plan.currentTime)) + plan.restMin
  const target = minutes(plan.departTime) - mode.bufferMin
  const hubMin = course.return.minutes[hub.id] ?? null
  return {
    config,
    plan,
    obs,
    course,
    mode,
    hub,
    hubMin,
    start,
    target,
    effect: assessSignals(policy, obs),
    places: indexBy(
      config.places.filter((p) => p.active && p.attrs.course === course.id),
      (p) => p.id,
    ),
    base: {
      decision: 'INCOMPLETE',
      calculationStatus: 'NOT_RUN',
      executionMode: 'DEMO',
      course: course.id,
      alternatives: [],
      hub: hub.id,
      variant: null,
      revision: plan.revision,
      start,
      stops: [],
      stationEta: null,
      planningArrival: null,
      stationTarget: target,
      slack: null,
      walking: 0,
      localMin: 0,
      outbound: plan.currentPlace === 'COURSE' ? 0 : course.outbound.minutes,
      returnMin: hubMin ?? 0,
      returnDeparture: null,
      trafficReserve: 0,
      reasons: [],
      excluded: [],
    },
  }
}

/** Copy from config, with the trip's names available to every sentence. */
const copy = (
  ctx: Context,
  key: string,
  vars?: Record<string, string | number>,
) =>
  fill(ctx.config.policy.copy[key] ?? key, {
    area: ctx.course.area,
    hub: ctx.hub.name,
    noun: ctx.mode.noun,
    time: ctx.plan.departTime,
    buffer: ctx.mode.bufferMin,
    ...vars,
  })

/** The base with observation effects applied (reserve, partial status). */
const observed = (ctx: Context): Itinerary => ({
  ...ctx.base,
  trafficReserve: ctx.effect.reserveMin,
  calculationStatus: ctx.effect.uncertain ? 'PARTIAL' : 'READY',
})

// ── Rules, in priority order ────────────────────────────────────────────

const medicalFirst: Rule<Context, Itinerary> = (ctx) =>
  ctx.plan.condition === 'UNWELL'
    ? {
        ...ctx.base,
        decision: 'MEDICAL_FIRST',
        reasons: [copy(ctx, 'medical')],
      }
    : undefined

const incomplete: Rule<Context, Itinerary> = (ctx) =>
  ctx.plan.condition === 'UNANSWERED' || !ctx.plan.baggageCollected
    ? { ...ctx.base, reasons: [copy(ctx, 'incomplete')] }
    : undefined

const atStation: Rule<Context, Itinerary> = (ctx) => {
  if (!isHub(ctx.plan.currentPlace)) return undefined
  const now = minutes(ctx.plan.currentTime)
  return {
    ...ctx.base,
    decision: 'GO',
    calculationStatus: 'READY',
    stationEta: now,
    planningArrival: now,
    slack: ctx.target - now,
    outbound: 0,
    returnMin: 0,
    reasons: [copy(ctx, 'atStation')],
  }
}

const routeUnavailable: Rule<Context, Itinerary> = (ctx) => {
  if (ctx.hubMin === null)
    return {
      ...ctx.base,
      decision: 'NEEDS_DATA',
      calculationStatus: 'NEEDS_DATA',
      reasons: [copy(ctx, 'noHubRoute')],
    }
  const { outbound } = ctx.course
  const outOfWindow =
    ctx.base.outbound > 0 && !within(outbound.window)(ctx.start)
  return !ctx.obs.routeAvailable || outOfWindow
    ? {
        ...ctx.base,
        decision: 'NEEDS_DATA',
        calculationStatus: 'NEEDS_DATA',
        reasons: [copy(ctx, 'routeMissing')],
      }
    : undefined
}

const returnLeg: Rule<Context, Itinerary> = (ctx) => {
  if (ctx.plan.stage !== 'RETURN') return undefined
  const leg = ctx.course.return
  const legMin = ctx.hubMin ?? 0
  const base = observed(ctx)
  if (!within(leg.window)(ctx.start))
    return {
      ...base,
      decision: 'NEEDS_DATA',
      calculationStatus: 'NEEDS_DATA',
      outbound: 0,
      reasons: [copy(ctx, 'returnRouteMissing')],
    }
  const departure = ctx.start + leg.stopAccess
  const eta = departure + legMin
  const planned = eta + ctx.effect.reserveMin
  return {
    ...base,
    decision: planned <= ctx.target ? 'GO' : 'CANCEL',
    outbound: 0,
    returnMin: leg.stopAccess + legMin,
    stationEta: eta,
    planningArrival: planned,
    returnDeparture: departure,
    slack: ctx.target - planned,
    reasons: [
      ...ctx.effect.reasons,
      copy(ctx, 'returnLeg', {
        stopAccess: leg.stopAccess,
        returnMin: legMin,
      }),
    ],
  }
}

// ── Course search over configured variants ──────────────────────────────

type Candidate =
  | { kind: 'ok'; itinerary: Itinerary }
  | { kind: 'window-miss' }
  | { kind: 'infeasible' }
  | { kind: 'empty' }

const allowedIn = (ctx: Context) => (id: PlaceId) =>
  id in ctx.places &&
  ctx.plan.interests.includes(ctx.places[id].attrs.interest) &&
  !ctx.plan.excluded.includes(id) &&
  !ctx.plan.completed.includes(id) &&
  !(ctx.effect.outdoorBlocked && ctx.places[id].attrs.outdoor)

const evaluate =
  (ctx: Context) =>
  (variant: Variant, index: number): Candidate => {
    const { policy } = ctx.config
    const { plan, base, effect } = ctx
    const selected = variant.stops.filter((s) => allowedIn(ctx)(s.place))
    const resumed = plan.completed.length > 0
    if (!selected.length && !resumed) return { kind: 'empty' }

    const approach = resumed
      ? policy.local.lastApproach
      : selected.length
        ? policy.local.firstApproach + policy.local.lastApproach
        : 0
    const localMin = approach + sum(selected.map((s) => s.dwell))
    const walking =
      (base.outbound ? ctx.course.outbound.accessWalk : 0) +
      ctx.course.return.accessWalk +
      sum(selected.map((s) => s.walk))
    const returnDeparture = ctx.start + base.outbound + localMin
    if (!within(ctx.course.return.window)(returnDeparture))
      return { kind: 'window-miss' }

    const eta = returnDeparture + base.returnMin
    const planned = eta + effect.reserveMin
    if (planned > ctx.target || walking > plan.walkingLimit)
      return { kind: 'infeasible' }

    const firstAt =
      ctx.start +
      base.outbound +
      (selected.length && !resumed ? policy.local.firstApproach : 0)
    const stops = selected.reduce<Stop[]>((acc, s) => {
      const from = acc.length ? acc[acc.length - 1].end : firstAt
      return [
        ...acc,
        { id: s.place, start: from, end: from + s.dwell, dwell: s.dwell },
      ]
    }, [])

    const chosen = new Set(selected.map((s) => s.place))
    const excluded = Object.values(ctx.places)
      .filter((p) => !chosen.has(p.id) && !plan.completed.includes(p.id))
      .sort((a, b) => a.sort - b.sort)
      .map((p) => ({
        id: p.id,
        reason: plan.excluded.includes(p.id)
          ? copy(ctx, 'excludedByUser')
          : !plan.interests.includes(p.attrs.interest)
            ? copy(ctx, 'excludedByInterest')
            : p.attrs.outdoor && effect.outdoorBlocked
              ? copy(ctx, 'excludedOutdoor')
              : copy(ctx, 'excludedByTime'),
      }))

    const reasons = [
      ...effect.reasons,
      ...(index > 0 && variant.reason ? [variant.reason] : []),
    ]
    return {
      kind: 'ok',
      itinerary: {
        ...observed(ctx),
        decision:
          index > 0 ? 'SHORTEN' : effect.outdoorBlocked ? 'INDOOR' : 'GO',
        variant: variant.id,
        stops,
        stationEta: eta,
        planningArrival: planned,
        slack: ctx.target - planned,
        walking,
        localMin,
        returnDeparture,
        reasons: reasons.length
          ? reasons
          : [
              copy(
                ctx,
                ctx.mode.bufferMin > 0 ? 'fullCourse' : 'fullCourseBack',
                { count: selected.length },
              ),
            ],
        excluded,
      },
    }
  }

const courseSearch = (ctx: Context): Itinerary => {
  let windowMissing = false
  let allEmpty = true
  const { variants } = ctx.course
  for (let i = 0; i < variants.length; i++) {
    const candidate = evaluate(ctx)(variants[i], i)
    if (candidate.kind === 'ok') return candidate.itinerary
    if (candidate.kind === 'window-miss') windowMissing = true
    if (candidate.kind !== 'empty') allEmpty = false
  }
  const base = observed(ctx)
  const why = windowMissing
    ? 'windowMissing'
    : allEmpty && ctx.plan.interests.length
      ? 'noInterest'
      : 'cancel'
  return {
    ...base,
    decision: windowMissing ? 'NEEDS_DATA' : 'CANCEL',
    calculationStatus: windowMissing ? 'NEEDS_DATA' : base.calculationStatus,
    reasons: [...ctx.effect.reasons, copy(ctx, why)],
  }
}

const decide = decideWith<Context, Itinerary>(
  [medicalFirst, incomplete, atStation, routeUnavailable, returnLeg],
  courseSearch,
)

/** Lower is better: a full course, then a shortened one, then anything else. */
const fit = (it: Itinerary) =>
  it.decision === 'GO' || it.decision === 'INDOOR'
    ? 0
    : it.decision === 'SHORTEN'
      ? 1
      : 2

/** The best of several courses' itineraries: fit, then more stops, then catalogue order. */
export const bestOf = (its: Itinerary[]): Itinerary =>
  its.reduce((best, it) =>
    fit(it) < fit(best) ||
    (fit(it) === fit(best) && it.stops.length > best.stops.length)
      ? it
      : best,
  )

/** One itinerary per active course, for comparison. */
export const planEveryCourse = (
  config: TripConfig,
  plan: Plan,
  obs: Observations,
): Itinerary[] =>
  activeCourses(config).map((c) => decide(contextOf(config, plan, obs, c)))

/**
 * `auto`: the featured course whenever it can be done, otherwise the best
 * other course, saying why the featured one was passed over.
 */
const chooseAuto = (config: TripConfig, all: Itinerary[]): Itinerary => {
  const featuredId = config.policy.featuredCourse
  const featured = all.find((i) => i.course === featuredId)
  if (featured && canTravel(featured)) return featured
  const best = bestOf(all)
  if (!featured || best === featured || !canTravel(best)) return best
  const fill = (key: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce(
      (text, [k, v]) => text.replaceAll(`{${k}}`, v),
      config.policy.copy[key] ?? key,
    )
  return {
    ...best,
    reasons: [
      fill('featuredSkipped', {
        featured: courseById(config, featuredId)?.area ?? '',
        area: courseById(config, best.course)?.area ?? '',
      }),
      ...best.reasons,
    ],
  }
}

export const planner =
  (config: TripConfig) =>
  (plan: Plan, obs: Observations): Itinerary => {
    const all = planEveryCourse(config, plan, obs)
    const fixed =
      plan.course === AUTO_COURSE ? undefined : courseById(config, plan.course)
    const pick =
      (fixed && all.find((i) => i.course === fixed.id)) ??
      chooseAuto(config, all)
    return {
      ...pick,
      alternatives: all
        .filter((i) => i.course !== pick.course && canTravel(i))
        .slice(0, 3)
        .map((i) => i.course!),
    }
  }
