import type { Evidence } from '#/core/evidence'
import { liveObservationEvents } from '#/core/live'
import type { TripConfig } from '#/core/schema'
import type { Db } from './db/client'
import type { TripRecord } from './trips'
import { commit } from './trips'

/**
 * Pull live observations into a trip: fetch the configured sources, turn
 * fresh decision readings into events, and commit them with their origin.
 * `minIntervalMs` keeps a busy conversation from calling the provider on
 * every turn; `force` skips it (an explicit "지금도 괜찮아?").
 */
export const syncLive = async (
  db: Db,
  config: TripConfig,
  record: TripRecord,
  observe: () => Promise<Evidence[]>,
  opts: { minIntervalMs?: number; force?: boolean; now?: number } = {},
): Promise<{ record: TripRecord; evidence: Evidence[] | null }> => {
  const now = opts.now ?? Date.now()
  const last = record.meta.liveSyncedAt
    ? Date.parse(record.meta.liveSyncedAt)
    : 0
  if (!opts.force && now - last < (opts.minIntervalMs ?? 5 * 60_000))
    return { record, evidence: null }
  const evidence = await observe().catch(() => [] as Evidence[])
  const events = liveObservationEvents(
    config,
    record.state.observations,
    evidence,
  )
  const next = await commit(db, record, events, {
    source: 'live-observations',
    evidence: evidence.map((e) => ({
      sourceId: e.sourceId,
      status: e.status,
      freshness: e.freshness,
      observedAt: e.observedAt,
      fetchedAt: e.fetchedAt,
    })),
  })
  return {
    record: {
      ...next,
      meta: { ...next.meta, liveSyncedAt: new Date(now).toISOString() },
    },
    evidence,
  }
}
