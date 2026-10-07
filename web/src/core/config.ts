import { deepMerge } from './fp'
import type { Place, TripConfig } from './schema'
import { configSchema, placeSchema } from './schema'

/** Config documents stored one-per-row in `app_config`. Places live in their own table. */
export const configKeys = [
  'policy',
  'anchors',
  'sources',
  'agent',
  'scenarios',
  'defaults',
] as const
export type ConfigKey = (typeof configKeys)[number]

export type ConfigIssue = { path: string; message: string }

/**
 * Overlay stored documents on the seed and validate the result.
 * Documents may be partial: a row `policy = {"stationBufferMin": 20}` changes
 * one number and inherits the rest. An invalid overlay is rejected as a whole
 * and reported, so a bad edit never takes the planner down.
 */
export const assembleConfig = (
  seed: TripConfig,
  docs: Partial<Record<string, unknown>>,
  placeRows: ReadonlyArray<unknown>,
): { config: TripConfig; issues: ConfigIssue[] } => {
  const overlay = Object.fromEntries(
    configKeys.filter((k) => docs[k] !== undefined).map((k) => [k, docs[k]]),
  )
  const parsedPlaces = placeRows.map((row) => placeSchema.safeParse(row))
  const places: Place[] = parsedPlaces.flatMap((p) =>
    p.success ? [p.data] : [],
  )
  const placeIssues = parsedPlaces.flatMap((p, i) =>
    p.success ? [] : [{ path: `places[${i}]`, message: p.error.message }],
  )
  const candidate = {
    ...deepMerge(seed, overlay),
    places: places.length ? places : seed.places,
  }
  const parsed = configSchema.safeParse(candidate)
  if (parsed.success) return { config: parsed.data, issues: placeIssues }
  return {
    config: seed,
    issues: [
      ...placeIssues,
      ...parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    ],
  }
}
