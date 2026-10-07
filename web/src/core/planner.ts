import type { Rule } from './fp'
import { decideWith, indexBy, sum } from './fp'
import type {
  Observations,
  Place,
  PlaceId,
  Plan,
  TripConfig,
  Variant,
} from './schema'
import type { Effect } from './signals'
import { assessSignals, fill } from './signals'
import { minutes, within } from './time'

/**
 * The decision engine: `planner(config)(plan, observations) → Itinerary`.
 *
 * Pure and deterministic. It is a short list of rules tried in priority
 * order (medical first, then completeness, then routes, then the course
 * search). All numbers come from `config.policy`; this file only knows how
 * to combine them.
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
): Context => {
  const { policy } = config
  const start =
    Math.max(minutes(plan.readyTime), minutes(plan.currentTime)) + plan.restMin
  const target = minutes(plan.trainTime) - policy.stationBufferMin
  return {
    config,
    plan,
    obs,
    start,
    target,
    effect: assessSignals(policy, obs),
    places: indexBy(
      config.places.filter((p) => p.active),
      (p) => p.id,
    ),
    base: {
      decision: 'INCOMPLETE',
      calculationStatus: 'NOT_RUN',
      executionMode: 'DEMO',
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
      outbound:
        plan.currentPlace === 'GURYONGPO' ? 0 : policy.legs.outbound.minutes,
      returnMin: policy.legs.return.minutes,
      returnDeparture: null,
      trafficReserve: 0,
      reasons: [],
      excluded: [],
    },
  }
}

const copy = (
  ctx: Context,
  key: string,
  vars?: Record<string, string | number>,
) => fill(ctx.config.policy.copy[key] ?? key, vars)

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
  if (ctx.plan.currentPlace !== 'STATION') return undefined
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
  const { outbound } = ctx.config.policy.legs
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
  const leg = ctx.config.policy.legs.return
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
  const eta = departure + leg.minutes
  const planned = eta + ctx.effect.reserveMin
  return {
    ...base,
    decision: planned <= ctx.target ? 'GO' : 'CANCEL',
    outbound: 0,
    returnMin: leg.stopAccess + leg.minutes,
    stationEta: eta,
    planningArrival: planned,
    returnDeparture: departure,
    slack: ctx.target - planned,
    reasons: [
      ...ctx.effect.reasons,
      copy(ctx, 'returnLeg', {
        stopAccess: leg.stopAccess,
        returnMin: leg.minutes,
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
      (base.outbound ? policy.legs.outbound.accessWalk : 0) +
      policy.legs.return.accessWalk +
      sum(selected.map((s) => s.walk))
    const returnDeparture = ctx.start + base.outbound + localMin
    if (!within(policy.legs.return.window)(returnDeparture))
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
    const excluded = ctx.config.places
      .filter(
        (p) => p.active && !chosen.has(p.id) && !plan.completed.includes(p.id),
      )
      .sort((a, b) => a.sort - b.sort)
      .map((p) => ({
        id: p.id,
        reason: plan.excluded.includes(p.id)
          ? copy(ctx, 'excludedByUser')
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
              copy(ctx, 'fullCourse', {
                count: selected.length,
                buffer: policy.stationBufferMin,
              }),
            ],
        excluded,
      },
    }
  }

const courseSearch = (ctx: Context): Itinerary => {
  let windowMissing = false
  const variants = ctx.config.policy.variants
  for (let i = 0; i < variants.length; i++) {
    const candidate = evaluate(ctx)(variants[i], i)
    if (candidate.kind === 'ok') return candidate.itinerary
    if (candidate.kind === 'window-miss') windowMissing = true
  }
  const base = observed(ctx)
  return {
    ...base,
    decision: windowMissing ? 'NEEDS_DATA' : 'CANCEL',
    calculationStatus: windowMissing ? 'NEEDS_DATA' : base.calculationStatus,
    reasons: [
      ...ctx.effect.reasons,
      copy(ctx, windowMissing ? 'windowMissing' : 'cancel'),
    ],
  }
}

const decide = decideWith<Context, Itinerary>(
  [medicalFirst, incomplete, atStation, routeUnavailable, returnLeg],
  courseSearch,
)

export const planner =
  (config: TripConfig) =>
  (plan: Plan, obs: Observations): Itinerary =>
    decide(contextOf(config, plan, obs))
