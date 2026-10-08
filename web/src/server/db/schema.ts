import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Narrow relational spine, wide jsonb body.
 *
 * Columns hold what we query or join on (ids, kinds, timestamps). Everything
 * that describes *behaviour* — policy numbers, place attributes, source
 * contracts, event payloads, provenance — lives in jsonb so it can evolve
 * without migrations. `meta` is reserved on every table for annotations
 * (provenance, verification state, operator notes).
 */

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
const meta = () =>
  jsonb('meta').$type<Record<string, unknown>>().notNull().default({})

/** Keyed configuration documents: `policy`, `sources`, `agent`, `scenarios`, … */
export const appConfig = pgTable('app_config', {
  key: text('key').primaryKey(),
  version: integer('version').notNull().default(1),
  value: jsonb('value').$type<unknown>().notNull(),
  meta: meta(),
  updatedAt: updatedAt(),
})

/** Place catalogue. `attrs` carries everything the planner and UI need. */
export const places = pgTable(
  'places',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    sort: integer('sort').notNull().default(0),
    active: boolean('active').notNull().default(true),
    attrs: jsonb('attrs').$type<Record<string, unknown>>().notNull(),
    meta: meta(),
    updatedAt: updatedAt(),
  },
  (t) => [index('places_attrs_gin').using('gin', t.attrs)],
)

/** Latest folded state per trip (a cache of `trip_events`). */
/**
 * One row per trip: the folded state (the server is the source of truth),
 * the conversation as AI SDK UIMessages, and harness bookkeeping in `meta`
 * (ingested tool calls, stored previews).
 */
export const trips = pgTable('trips', {
  id: uuid('id').primaryKey(),
  state: jsonb('state').$type<unknown>(),
  messages: jsonb('messages').$type<unknown[]>().notNull().default([]),
  meta: meta(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

/** Append-only event log. The source of truth for what happened on a trip. */
export const tripEvents = pgTable(
  'trip_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tripId: uuid('trip_id').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    meta: meta(),
    createdAt: createdAt(),
  },
  (t) => [
    index('trip_events_trip_idx').on(t.tripId, t.createdAt),
    index('trip_events_payload_gin').using('gin', t.payload),
  ],
)

/** Every external observation fetch, successful or not, with its raw-but-filtered payload. */
export const observationSnapshots = pgTable(
  'observation_snapshots',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    sourceId: text('source_id').notNull(),
    status: text('status').notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    meta: meta(),
  },
  (t) => [
    index('observation_snapshots_source_idx').on(t.sourceId, t.fetchedAt),
  ],
)

/**
 * Idempotent bootstrap DDL mirroring the tables above. Used for PGlite and
 * first deploys; `drizzle-kit generate` produces the same shape for managed
 * migrations.
 */
export const bootstrapStatements = [
  `CREATE TABLE IF NOT EXISTS app_config (
    key text PRIMARY KEY,
    version integer NOT NULL DEFAULT 1,
    value jsonb NOT NULL,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS places (
    id text PRIMARY KEY,
    kind text NOT NULL,
    sort integer NOT NULL DEFAULT 0,
    active boolean NOT NULL DEFAULT true,
    attrs jsonb NOT NULL,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS places_attrs_gin ON places USING gin (attrs)`,
  `CREATE TABLE IF NOT EXISTS trips (
    id uuid PRIMARY KEY,
    state jsonb,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE trips ADD COLUMN IF NOT EXISTS messages jsonb NOT NULL DEFAULT '[]'::jsonb`,
  `CREATE TABLE IF NOT EXISTS trip_events (
    id bigserial PRIMARY KEY,
    trip_id uuid NOT NULL,
    type text NOT NULL,
    payload jsonb NOT NULL,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS trip_events_trip_idx ON trip_events (trip_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS trip_events_payload_gin ON trip_events USING gin (payload)`,
  `CREATE TABLE IF NOT EXISTS observation_snapshots (
    id bigserial PRIMARY KEY,
    source_id text NOT NULL,
    status text NOT NULL,
    observed_at timestamptz,
    fetched_at timestamptz NOT NULL,
    payload jsonb NOT NULL,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb
  )`,
  `CREATE INDEX IF NOT EXISTS observation_snapshots_source_idx ON observation_snapshots (source_id, fetched_at)`,
]
