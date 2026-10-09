import { z } from 'zod'

/**
 * Contracts. Places, signals, sources and scenarios are *data*: the schemas
 * describe their shape, and the concrete catalogue lives in config (jsonb).
 * Adding a place or an observation source never requires a code change.
 */

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
export const placeIdSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/)
export type PlaceId = z.infer<typeof placeIdSchema>
/** A course id, or `auto` to let the planner pick the course that fits. */
export const courseIdSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/)
export type CourseId = z.infer<typeof courseIdSchema>
export const AUTO_COURSE = 'auto'

/** How the runner leaves Pohang (or that they live here). */
export const departModeSchema = z.enum([
  'TRAIN',
  'BUS',
  'FLIGHT',
  'CAR',
  'LOCAL',
])
export type DepartMode = z.infer<typeof departModeSchema>

/** What the runner wants to do after the race; every place has one. */
export const interestSchema = z.enum(['food', 'walk', 'cafe', 'view', 'indoor'])
export type Interest = z.infer<typeof interestSchema>

// ── Trip plan ────────────────────────────────────────────────────────────
export const conditionSchema = z.enum(['OK', 'TIRED', 'UNWELL', 'UNANSWERED'])
export const stageSchema = z.enum([
  'BEFORE',
  'OUTBOUND',
  'LOCAL',
  'RETURN',
  'DONE',
])
/** Where the trip ends: the station, terminal, airport or race parking. */
export const hubIdSchema = z.enum(['STATION', 'TERMINAL', 'AIRPORT', 'PARKING'])
export type HubId = z.infer<typeof hubIdSchema>
/** `COURSE` = somewhere in the chosen course's area. */
export const anchorIdSchema = z.enum([
  'RACE',
  'HOTEL',
  'COURSE',
  ...hubIdSchema.options,
])
export type AnchorId = z.infer<typeof anchorIdSchema>

export const planSchema = z.object({
  revision: z.number().int().nonnegative(),
  arrivalAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  departMode: departModeSchema,
  /** Departure (train, bus, flight) or the time to be back (car, local). */
  departTime: timeSchema,
  course: courseIdSchema,
  readyTime: timeSchema,
  condition: conditionSchema,
  walkingLimit: z.number().int().min(5).max(120),
  baggageCollected: z.boolean(),
  origin: z.enum(['RACE', 'HOTEL']),
  interests: z.array(interestSchema),
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

/**
 * Where one reading came from: a live provider response, a demo scenario, or
 * the seed's simulated value. Shown next to every number the plan uses.
 */
export const readingSourceSchema = z.object({
  provenance: z.enum(['LIVE', 'SNAPSHOT', 'SIMULATED', 'DEMO']),
  sourceId: z.string().nullable().default(null),
  observedAt: z.string().nullable().default(null),
  fetchedAt: z.string().nullable().default(null),
  /** Why a live value is not used, e.g. the provider could not be reached. */
  note: z.string().nullable().default(null),
})
export type ReadingSource = z.infer<typeof readingSourceSchema>

export const observationsSchema = z.object({
  readings: z.record(z.string(), z.number().finite().nullable()),
  /** Per-reading provenance; a reading without an entry is the seed's simulated value. */
  sources: z.record(z.string(), readingSourceSchema).default({}),
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
      /** Optional photo path; '' when there is none. */
      image: z.string(),
      actionLabel: z.string(),
      /** The course this place belongs to. */
      course: courseIdSchema,
      interest: interestSchema,
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
  /** Tried first when the course is `auto`; others only if it cannot be done. */
  featuredCourse: courseIdSchema.nullable().default(null),
  restCapMin: z.number().int().min(0),
  local: z.object({
    firstApproach: z.number().int().min(0),
    lastApproach: z.number().int().min(0),
  }),
  signals: z.array(signalSchema),
  copy: z.record(z.string(), z.string()),
})
export type Policy = z.infer<typeof policySchema>

// ── Config: courses (one area each) and ways home ───────────────────────
export const courseSchema = z.object({
  id: courseIdSchema,
  sort: z.number().int().default(0),
  active: z.boolean().default(true),
  title: z.string(),
  /** Area name used in sentences: "구룡포", "호미곶". */
  area: z.string(),
  desc: z.string(),
  tags: z.array(z.string()).default([]),
  geo: geoSchema,
  /** From the race (or the hotel) to the area. */
  outbound: z.object({
    minutes: z.number().int().positive(),
    accessWalk: z.number().int().min(0),
    window: windowSchema,
    via: z.string(),
  }),
  /** From the area to each hub. A hub without an entry has no route. */
  return: z.object({
    minutes: z.partialRecord(hubIdSchema, z.number().int().positive()),
    accessWalk: z.number().int().min(0),
    stopAccess: z.number().int().min(0),
    window: windowSchema,
    via: z.string(),
  }),
  /** Tried in order; the first that fits is the plan, later ones are shorter. */
  variants: z.array(variantSchema).min(1),
  meta: z.record(z.string(), z.unknown()).default({}),
})
export type Course = z.infer<typeof courseSchema>

/** The race itself: what a participant asks about. Served by the agent's tools and the 대회 개요 tab. */
export const raceEventSchema = z.object({
  name: z.string(),
  category: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateLabel: z.string(),
  gun: timeSchema,
  venue: z.string(),
  address: z.string(),
  geo: geoSchema,
  cutoff: z.string(),
  schedule: z.array(z.object({ time: timeSchema, label: z.string() })),
  course: z.object({
    distanceKm: z.number().positive(),
    summary: z.string(),
    route: z.array(z.string()),
    checkpoints: z.array(z.object({ km: z.number(), label: z.string() })),
  }),
  kit: z.array(z.string()),
  facilities: z.array(z.object({ label: z.string(), detail: z.string() })),
  rules: z.array(z.string()),
  notes: z.array(z.string()),
  faq: z.array(z.object({ q: z.string(), a: z.string() })),
  meta: z.record(z.string(), z.unknown()).default({}),
})
export type RaceEvent = z.infer<typeof raceEventSchema>

/** A short reference note the agent can search (sights, food, transport, tips). */
export const guideDocSchema = z.object({
  id: z.string(),
  topic: z.enum(['sight', 'food', 'transport', 'tip', 'festival', 'stay']),
  title: z.string(),
  body: z.string(),
  tags: z.array(z.string()).default([]),
  geo: geoSchema.optional(),
  meta: z.record(z.string(), z.unknown()).default({}),
})
export type GuideDoc = z.infer<typeof guideDocSchema>

export const modeSchema = z.object({
  id: departModeSchema,
  label: z.string(),
  say: z.string(),
  hub: hubIdSchema,
  /** Minutes to be at the hub before `departTime`. */
  bufferMin: z.number().int().min(0),
  /** "18:30 {noun}" — 열차, 버스, 비행기 … */
  noun: z.string(),
  question: z.string(),
  hint: z.string(),
  times: z.array(timeSchema),
  /** Reply when the runner does not know the time yet. */
  unknownReply: z.string(),
})
export type Mode = z.infer<typeof modeSchema>

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
  /** A live, fresh value of this source replaces the simulated reading in the plan. */
  decision: z.boolean().default(false),
  meta: z.record(z.string(), z.unknown()).default({}),
})
export type Source = z.infer<typeof sourceSchema>

export const agentConfigSchema = z.object({
  model: z.string(),
  /** Low for a stable demo. Reasoning models ignore it (the SDK drops it with a warning). */
  temperature: z.number().min(0).max(1).nullable().default(null),
  maxSteps: z.number().int().min(1).max(8),
  maxToolCalls: z.number().int().min(1).max(8),
  timeoutMs: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive(),
  suggestions: z.array(z.string()),
})
export type AgentConfig = z.infer<typeof agentConfigSchema>

// ── Conversation: what the agent asks, as data ──────────────────────────
/** Trip details the chat collects, one question at a time. */
export const slotIdSchema = z.enum([
  'departMode',
  'departTime',
  'course',
  'interests',
  'origin',
  'arrivalAt',
  'readyTime',
  'condition',
  'walkingLimit',
  'baggageCollected',
])
export type SlotId = z.infer<typeof slotIdSchema>

/**
 * A reply chip. Tapping it sends `say` as the user's own message, with
 * `value` attached so the server can apply it without guessing.
 * `value: null` means "I don't know" — the slot is answered and keeps its default.
 */
export const choiceSchema = z.object({
  label: z.string(),
  say: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  /** One line the app answers with when this chip is tapped. */
  reply: z.string().optional(),
})
export type Choice = z.infer<typeof choiceSchema>

export const slotSpecSchema = z.object({
  question: z.string(),
  /** Composer placeholder while this question is open. */
  hint: z.string(),
  /** Several chips may be picked, then sent together. */
  multiple: z.boolean().default(false),
  /** Fixed chips. Some slots add chips computed from the trip (places, times). */
  choices: z.array(choiceSchema).default([]),
})
export type SlotSpec = z.infer<typeof slotSpecSchema>

export const conversationSchema = z.object({
  /** Asked, in order, until the trip exists. */
  onboarding: z.array(slotIdSchema),
  /** Asked, in order, right after the race. */
  checkIn: z.array(slotIdSchema),
  slots: z.partialRecord(slotIdSchema, slotSpecSchema),
})
export type ConversationConfig = z.infer<typeof conversationSchema>

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
  event: raceEventSchema,
  policy: policySchema,
  courses: z.array(courseSchema).min(1),
  modes: z.array(modeSchema).min(1),
  guide: z.array(guideDocSchema).default([]),
  places: z.array(placeSchema),
  anchors: z.array(anchorSchema),
  sources: z.array(sourceSchema),
  agent: agentConfigSchema,
  conversation: conversationSchema,
  scenarios: z.array(scenarioSchema),
  defaults: z.object({ plan: planSchema, observations: observationsSchema }),
})
export type TripConfig = z.infer<typeof configSchema>
