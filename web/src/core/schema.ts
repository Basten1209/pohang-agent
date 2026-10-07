import { z } from 'zod'

/**
 * Contracts. Places, signals, sources and scenarios are *data*: the schemas
 * describe their shape, and the concrete catalogue lives in config (jsonb).
 * Adding a place or an observation source never requires a code change.
 */

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
export const placeIdSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/)
export type PlaceId = z.infer<typeof placeIdSchema>

// ── Trip plan ────────────────────────────────────────────────────────────
export const conditionSchema = z.enum(['OK', 'TIRED', 'UNWELL', 'UNANSWERED'])
export const stageSchema = z.enum([
  'BEFORE',
  'OUTBOUND',
  'LOCAL',
  'RETURN',
  'DONE',
])
export const anchorIdSchema = z.enum(['RACE', 'HOTEL', 'GURYONGPO', 'STATION'])
export type AnchorId = z.infer<typeof anchorIdSchema>

export const planSchema = z.object({
  revision: z.number().int().nonnegative(),
  arrivalAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  trainTime: timeSchema,
  readyTime: timeSchema,
  condition: conditionSchema,
  walkingLimit: z.number().int().min(5).max(120),
  baggageCollected: z.boolean(),
  origin: z.enum(['RACE', 'HOTEL']),
  interests: z.array(placeIdSchema),
  excluded: z.array(placeIdSchema),
  restMin: z.number().int().min(0).max(180),
  stage: stageSchema,
  completed: z.array(placeIdSchema),
  currentTime: timeSchema,
  currentPlace: anchorIdSchema,
})
export type Plan = z.infer<typeof planSchema>

// ── Observations: a bag of named readings with provenance ───────────────
export const freshnessSchema = z.enum(['FRESH', 'STALE', 'UNKNOWN'])
export const observationsSchema = z.object({
  readings: z.record(z.string(), z.number().finite().nullable()),
  freshness: freshnessSchema,
  routeAvailable: z.boolean(),
  provenance: z.enum(['SIMULATED', 'LIVE', 'SNAPSHOT']),
  observedAt: z.string().nullable().optional(),
})
export type Observations = z.infer<typeof observationsSchema>

// ── Config: places ──────────────────────────────────────────────────────
export const geoSchema = z.object({ lat: z.number(), lng: z.number() })
export const placeSchema = z.object({
  id: placeIdSchema,
  kind: z.string(),
  sort: z.number().int().default(0),
  active: z.boolean().default(true),
  attrs: z
    .object({
      title: z.string(),
      short: z.string(),
      subtitle: z.string(),
      category: z.string(),
      desc: z.string(),
      detail: z.string(),
      icon: z.string(),
      image: z.string(),
      actionLabel: z.string(),
      interestLabel: z.string(),
      outdoor: z.boolean(),
      defaultDwell: z.number().int().positive(),
      geo: geoSchema,
    })
    .passthrough(),
  meta: z.record(z.string(), z.unknown()).default({}),
})
export type Place = z.infer<typeof placeSchema>

// ── Config: decision policy ─────────────────────────────────────────────
export const windowSchema = z.object({ from: timeSchema, to: timeSchema })

/** Signals are interpreted by kind (see core/signals.ts). Unknown kinds are ignored. */
export const signalSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('reserve-by-band'),
    reading: z.string(),
    label: z.string(),
    bands: z.array(
      z.object({ gte: z.number(), reserveMin: z.number().int().min(0) }),
    ),
    unknownReserveMin: z.number().int().min(0),
  }),
  z.object({
    kind: z.literal('outdoor-limit'),
    reading: z.string(),
    label: z.string(),
    limit: z.number(),
  }),
])
export type Signal = z.infer<typeof signalSchema>

export const variantSchema = z.object({
  id: z.string(),
  stops: z.array(
    z.object({
      place: placeIdSchema,
      dwell: z.number().int().positive(),
      walk: z.number().int().min(0).default(0),
    }),
  ),
  reason: z.string().nullable(),
})
export type Variant = z.infer<typeof variantSchema>

export const policySchema = z.object({
  stationBufferMin: z.number().int().min(0),
  restCapMin: z.number().int().min(0),
  legs: z.object({
    outbound: z.object({
      minutes: z.number().int().positive(),
      accessWalk: z.number().int().min(0),
      window: windowSchema,
    }),
    return: z.object({
      minutes: z.number().int().positive(),
      accessWalk: z.number().int().min(0),
      stopAccess: z.number().int().min(0),
      window: windowSchema,
    }),
  }),
  local: z.object({
    firstApproach: z.number().int().min(0),
    lastApproach: z.number().int().min(0),
  }),
  signals: z.array(signalSchema),
  variants: z.array(variantSchema).min(1),
  copy: z.record(z.string(), z.string()),
})
export type Policy = z.infer<typeof policySchema>

// ── Config: anchors, sources, agent, scenarios ──────────────────────────
export const anchorSchema = z.object({
  id: anchorIdSchema,
  name: z.string(),
  geo: geoSchema,
})
export type Anchor = z.infer<typeof anchorSchema>

const paramValueSchema = z.union([
  z.object({ env: z.string() }),
  z.object({ value: z.string() }),
])
export const sourceSchema = z.object({
  id: z.string(),
  label: z.string(),
  url: z.string().url(),
  enabled: z.boolean().default(true),
  /** `serviceKey` is always taken from the server environment, never from config. */
  params: z.record(z.string(), paramValueSchema).default({}),
  /** The reading this source feeds, e.g. `congestion` or `pm25`. */
  reading: z.string(),
  valueField: z.string(),
  timeField: z.string(),
  /** Provider timestamps without an offset are interpreted in this zone. */
  timezone: z.string().nullable(),
  range: z.object({ min: z.number(), max: z.number() }),
  unit: z.string(),
  keepFields: z.array(z.string()),
  timeoutMs: z.number().int().positive().default(3000),
  maxAgeSeconds: z.number().int().positive().nullable(),
  meta: z.record(z.string(), z.unknown()).default({}),
})
export type Source = z.infer<typeof sourceSchema>

export const agentConfigSchema = z.object({
  model: z.string(),
  maxSteps: z.number().int().min(1).max(8),
  maxToolCalls: z.number().int().min(1).max(8),
  timeoutMs: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive(),
  suggestions: z.array(z.string()),
})
export type AgentConfig = z.infer<typeof agentConfigSchema>

export const screenSchema = z.enum(['plan', 'day', 'finish', 'course', 'next'])
export type Screen = z.infer<typeof screenSchema>

export const scenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  desc: z.string(),
  /** `reset` starts the plan from defaults; `keep` patches the current plan. */
  base: z.enum(['reset', 'keep']),
  plan: planSchema.partial().default({}),
  readings: z.record(z.string(), z.number().nullable()).default({}),
  observations: observationsSchema
    .omit({ readings: true })
    .partial()
    .default({}),
  screen: screenSchema.optional(),
})
export type Scenario = z.infer<typeof scenarioSchema>

export const configSchema = z.object({
  version: z.number().int(),
  policy: policySchema,
  places: z.array(placeSchema),
  anchors: z.array(anchorSchema),
  sources: z.array(sourceSchema),
  agent: agentConfigSchema,
  scenarios: z.array(scenarioSchema),
  defaults: z.object({ plan: planSchema, observations: observationsSchema }),
})
export type TripConfig = z.infer<typeof configSchema>
