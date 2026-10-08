import { uniq } from './fp'
import type { Changes } from './intents'
import type { Itinerary } from './planner'
import { planner } from './planner'
import { courseById, departLabel, hubOf } from './route'
import type { Observations, Plan, TripConfig } from './schema'
import { AUTO_COURSE } from './schema'

/**
 * Turn requested constraint changes into a *preview*: the plan patch and the
 * itinerary it would produce. Nothing is committed; the client applies the
 * patch only if the plan revision still matches.
 */
export type Preview = {
  revision: number
  changes: Partial<Plan>
  itinerary: Itinerary
}

export const toPlanPatch = (
  config: TripConfig,
  plan: Plan,
  changes: Changes,
): Partial<Plan> => {
  const known = new Set(config.places.map((p) => p.id))
  const exclude = (changes.excludePlaces ?? []).filter((id) => known.has(id))
  return {
    ...(changes.departTime ? { departTime: changes.departTime } : {}),
    ...(changes.course &&
    (changes.course === AUTO_COURSE || courseById(config, changes.course))
      ? { course: changes.course }
      : {}),
    ...(changes.walkingLimit ? { walkingLimit: changes.walkingLimit } : {}),
    ...(changes.extraRestMin !== null
      ? {
          restMin: Math.min(
            config.policy.restCapMin,
            plan.restMin + changes.extraRestMin,
          ),
        }
      : {}),
    ...(exclude.length
      ? { excluded: uniq([...plan.excluded, ...exclude]) }
      : {}),
    ...(changes.dropInterests?.length
      ? {
          interests: plan.interests.filter(
            (i) => !changes.dropInterests!.includes(i),
          ),
        }
      : {}),
  }
}

export const preview = (
  config: TripConfig,
  plan: Plan,
  obs: Observations,
  changes: Changes,
): Preview => {
  const patch = toPlanPatch(config, plan, changes)
  return {
    revision: plan.revision,
    changes: patch,
    itinerary: planner(config)({ ...plan, ...patch }, obs),
  }
}

/** A small, model-safe summary of the current situation. */
export const planContext = (
  config: TripConfig,
  plan: Plan,
  obs: Observations,
) => {
  const it = planner(config)(plan, obs)
  return {
    depart: departLabel(config, plan),
    hub: hubOf(config, plan).name,
    course: courseById(config, it.course)?.title ?? null,
    readyTime: plan.readyTime,
    walkingLimit: plan.walkingLimit,
    stage: plan.stage,
    decision: it.decision,
    stops: it.stops.map((s) => s.id),
    planningArrival: it.planningArrival,
    stationTarget: it.stationTarget,
    reasons: it.reasons,
    excluded: it.excluded,
  }
}
