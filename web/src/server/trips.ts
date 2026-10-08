import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { TripConfig } from '#/core/schema'
import { planSchema } from '#/core/schema'
import type { TripEvent, TripState } from '#/core/trip'
import { initialTrip, replay, tripStateSchema } from '#/core/trip'
import type { Db } from './db/client'
import { tripEvents, trips } from './db/schema'

/**
 * The server is the single source of truth for a trip.
 *
 * A trip row holds the folded state, the conversation (AI SDK UIMessages)
 * and harness bookkeeping in `meta` jsonb. Every change goes through
 * `commit`: replay the events onto the stored state, persist the result,
 * and append the events to the log.
 */

/** A plan-change preview the agent made; applying it re-checks the revision. */
export const storedPreviewSchema = z.object({
  id: z.string(),
  revision: z.number().int(),
  changes: planSchema.partial(),
})
export type StoredPreview = z.infer<typeof storedPreviewSchema>

export const tripMetaSchema = z.object({
  /** Tool call ids whose client-side output has already been applied. */
  ingested: z.array(z.string()).default([]),
  /** Recent previews by id (bounded). */
  previews: z.record(z.string(), storedPreviewSchema).default({}),
})
export type TripMeta = z.infer<typeof tripMetaSchema>

export type TripRecord = {
  id: string
  state: TripState
  messages: unknown[]
  meta: TripMeta
}

const emptyMeta = (): TripMeta => ({ ingested: [], previews: {} })

/**
 * A row from an older state version starts over as a whole: a fresh state
 * with the old conversation would ask questions the trip no longer matches.
 */
const fromRow = (
  config: TripConfig,
  row: typeof trips.$inferSelect,
  opening: () => unknown[],
): TripRecord & { restarted: boolean } => {
  const state = tripStateSchema.safeParse(row.state)
  const meta = tripMetaSchema.safeParse(row.meta)
  if (!state.success)
    return {
      id: row.id,
      state: initialTrip(config),
      messages: opening(),
      meta: emptyMeta(),
      restarted: true,
    }
  return {
    id: row.id,
    restarted: false,
    state: state.data,
    messages: Array.isArray(row.messages) ? row.messages : [],
    meta: meta.success ? meta.data : emptyMeta(),
  }
}

/** Load a trip, creating it (with the given opening messages) if it does not exist. */
export const openTrip = async (
  db: Db,
  config: TripConfig,
  id: string,
  opening: () => unknown[] = () => [],
): Promise<TripRecord> => {
  const [row] = await db.select().from(trips).where(eq(trips.id, id))
  if (row) {
    const { restarted, ...record } = fromRow(config, row, opening)
    // Persist a restarted trip right away so the next load agrees with it.
    if (restarted)
      await db
        .update(trips)
        .set({
          state: record.state,
          messages: record.messages,
          meta: record.meta,
          updatedAt: new Date(),
        })
        .where(eq(trips.id, id))
    return record
  }
  const fresh: TripRecord = {
    id,
    state: initialTrip(config),
    messages: opening(),
    meta: emptyMeta(),
  }
  await db
    .insert(trips)
    .values({
      id,
      state: fresh.state,
      messages: fresh.messages,
      meta: fresh.meta,
    })
    .onConflictDoNothing()
  return fresh
}

/** Apply events to the stored state and persist both the state and the log. */
export const commit = async (
  db: Db,
  record: TripRecord,
  events: ReadonlyArray<TripEvent>,
  source: Record<string, unknown> = {},
): Promise<TripRecord> => {
  if (!events.length) return record
  const state = replay(record.state, events)
  await db
    .update(trips)
    .set({ state, updatedAt: new Date() })
    .where(eq(trips.id, record.id))
  await db.insert(tripEvents).values(
    events.map((e) => {
      const { type, ...payload } = e
      return { tripId: record.id, type, payload, meta: source }
    }),
  )
  return { ...record, state }
}

export const saveConversation = (
  db: Db,
  record: Pick<TripRecord, 'id' | 'messages' | 'meta'>,
) =>
  db
    .update(trips)
    .set({
      messages: record.messages,
      meta: record.meta,
      updatedAt: new Date(),
    })
    .where(eq(trips.id, record.id))

/** Keep only the latest previews so meta stays small. */
export const rememberPreview = (
  meta: TripMeta,
  preview: StoredPreview,
  keep = 8,
): TripMeta => {
  const entries = Object.entries({ ...meta.previews, [preview.id]: preview })
  return { ...meta, previews: Object.fromEntries(entries.slice(-keep)) }
}
