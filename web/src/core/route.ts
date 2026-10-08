import type {
  Anchor,
  AnchorId,
  Course,
  HubId,
  Mode,
  Plan,
  TripConfig,
} from './schema'
import { hubIdSchema } from './schema'

/**
 * Where a trip goes and how it ends, resolved from the plan. The plan stores
 * only ids (`departMode`, `course`); names, hubs and legs come from config.
 */

export const modeOf = (config: TripConfig, plan: Pick<Plan, 'departMode'>) =>
  config.modes.find((m) => m.id === plan.departMode) ?? config.modes[0]

export const anchorOf = (
  config: TripConfig,
  id: AnchorId,
): Anchor | undefined => config.anchors.find((a) => a.id === id)

export const hubOf = (
  config: TripConfig,
  plan: Pick<Plan, 'departMode'>,
): { id: HubId; name: string; mode: Mode } => {
  const mode = modeOf(config, plan)
  return {
    id: mode.hub,
    name: anchorOf(config, mode.hub)?.name ?? mode.hub,
    mode,
  }
}

export const isHub = (id: string): id is HubId =>
  (hubIdSchema.options as string[]).includes(id)

export const activeCourses = (config: TripConfig): Course[] =>
  config.courses.filter((c) => c.active).sort((a, b) => a.sort - b.sort)

export const courseById = (
  config: TripConfig,
  id: string | null | undefined,
): Course | undefined => activeCourses(config).find((c) => c.id === id)

/** "18:30 열차", "17:00 버스", "19:00 귀가". */
export const departLabel = (
  config: TripConfig,
  plan: Pick<Plan, 'departMode' | 'departTime'>,
) => `${plan.departTime} ${modeOf(config, plan).noun}`

/** Places of one course, in catalogue order. */
export const placesOf = (config: TripConfig, courseId: string) =>
  config.places
    .filter((p) => p.active && p.attrs.course === courseId)
    .sort((a, b) => a.sort - b.sort)
