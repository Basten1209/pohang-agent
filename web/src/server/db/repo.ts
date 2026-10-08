import { and, desc, eq, sql } from 'drizzle-orm'
import type { ConfigKey } from '#/core/config'
import { assembleConfig, configKeys } from '#/core/config'
import type { TripConfig } from '#/core/schema'
import type { TripEvent } from '#/core/trip'
import type { Db } from './client'
import {
  appConfig,
  observationSnapshots,
  places,
  tripEvents,
  trips,
} from './schema'

/**
 * Write the seed. Rows are written once and edits in the DB survive
 * restarts; a row still holding an *older seed* (never edited, or edited
 * before the seed changed shape) is replaced when the seed version rises.
 */
export const seed = async (db: Db, config: TripConfig) => {
  await db
    .insert(appConfig)
    .values(
      configKeys.map((key) => ({
        key,
        version: config.version,
        value: config[key],
        meta: { source: 'seed' },
      })),
    )
    .onConflictDoUpdate({
      target: appConfig.key,
      set: {
        value: sql`excluded.value`,
        version: sql`excluded.version`,
        updatedAt: new Date(),
      },
      setWhere: sql`${appConfig.version} < excluded.version and ${appConfig.meta}->>'source' = 'seed'`,
    })
  await db
    .insert(places)
    .values(
      config.places.map((p) => ({
        id: p.id,
        kind: p.kind,
        sort: p.sort,
        active: p.active,
        attrs: p.attrs,
        meta: { ...p.meta, seedVersion: config.version },
      })),
    )
    .onConflictDoUpdate({
      target: places.id,
      set: {
        kind: sql`excluded.kind`,
        sort: sql`excluded.sort`,
        active: sql`excluded.active`,
        attrs: sql`excluded.attrs`,
        meta: sql`excluded.meta`,
        updatedAt: new Date(),
      },
      setWhere: sql`coalesce((${places.meta}->>'seedVersion')::int, 1) < (excluded.meta->>'seedVersion')::int`,
    })
}

export const readConfig = async (db: Db, base: TripConfig) => {
  const [docs, rows] = await Promise.all([
    db.select().from(appConfig),
    db.select().from(places).orderBy(places.sort),
  ])
  return assembleConfig(
    base,
    Object.fromEntries(docs.map((d) => [d.key, d.value])),
    rows,
  )
}

/** Merge a partial document into one config key (jsonb `||` keeps unspecified fields). */
export const patchConfig = (
  db: Db,
  key: ConfigKey,
  patch: Record<string, unknown>,
) =>
  db
    .update(appConfig)
    .set({
      value: sql`${appConfig.value} || ${JSON.stringify(patch)}::jsonb`,
      version: sql`${appConfig.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(appConfig.key, key))

export const appendEvents = async (
  db: Db,
  tripId: string,
  events: ReadonlyArray<TripEvent>,
  state: unknown,
  meta: Record<string, unknown> = {},
) => {
  if (!events.length) return 0
  await db
    .insert(trips)
    .values({ id: tripId, state, meta })
    .onConflictDoUpdate({
      target: trips.id,
      set: { state, updatedAt: new Date() },
    })
  await db.insert(tripEvents).values(
    events.map((e) => {
      const { type, ...payload } = e
      return { tripId, type, payload, meta }
    }),
  )
  return events.length
}

export const eventsOf = (db: Db, tripId: string) =>
  db
    .select()
    .from(tripEvents)
    .where(eq(tripEvents.tripId, tripId))
    .orderBy(tripEvents.id)

/** jsonb query example: every event whose payload changed the train time. */
export const departChanges = (db: Db, tripId: string) =>
  db
    .select({
      at: tripEvents.createdAt,
      departTime: sql<string>`${tripEvents.payload} #>> '{patch,departTime}'`,
    })
    .from(tripEvents)
    .where(
      and(
        eq(tripEvents.tripId, tripId),
        sql`${tripEvents.payload} @> '{"patch":{}}'::jsonb`,
        sql`${tripEvents.payload} -> 'patch' ? 'departTime'`,
      ),
    )
    .orderBy(tripEvents.id)

export type SnapshotInput = {
  sourceId: string
  status: string
  observedAt: string | null
  fetchedAt: string
  payload: Record<string, unknown>
  meta?: Record<string, unknown>
}

export const saveSnapshot = (db: Db, s: SnapshotInput) =>
  db.insert(observationSnapshots).values({
    sourceId: s.sourceId,
    status: s.status,
    observedAt: s.observedAt ? new Date(s.observedAt) : null,
    fetchedAt: new Date(s.fetchedAt),
    payload: s.payload,
    meta: s.meta ?? {},
  })

/** The most recent successful snapshot per source, for offline replay on stage. */
export const latestLiveSnapshot = (db: Db, sourceId: string) =>
  db
    .select()
    .from(observationSnapshots)
    .where(
      and(
        eq(observationSnapshots.sourceId, sourceId),
        eq(observationSnapshots.status, 'LIVE'),
      ),
    )
    .orderBy(desc(observationSnapshots.fetchedAt))
    .limit(1)
