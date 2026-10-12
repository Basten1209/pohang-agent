import { eq, sql } from 'drizzle-orm'
import type { Venue } from '#/core/schema'
import { venueCandidates } from '#/core/seed/venues'
import legacy from './venue-catalog-v1.json'
import type { Db } from './client'
import { appConfig, places } from './schema'

const PATCH = 'venue-links-verified-2026-10-12-v2'
const same = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  const x = a as Record<string, unknown>,
    y = b as Record<string, unknown>
  return (
    Object.keys(x).length === Object.keys(y).length &&
    Object.keys(x).every((k) => same(x[k], y[k]))
  )
}
/** Update our v1 data only. Operator-created candidates and edited fields win. */
export function refreshedVenues(parent: string, current: Venue[]): Venue[] {
  const before = (legacy as Record<string, Venue[]>)[parent] ?? []
  const latest = venueCandidates[parent] ?? []
  return current.flatMap((v) => {
    const old = before.find((o) => o.id === v.id)
    if (!old || old.name !== v.name || old.address !== v.address) return [v]
    const next = latest.find((n) => n.id === v.id)
    if (!next) {
      // Replace the unverifiable drama-set restaurant only when it is unedited.
      if (
        v.id === 'jinsu-baekban' &&
        same(v, old) &&
        !current.some((c) => c.id === 'daebori286')
      )
        return latest
      return [v]
    }
    const patched = { ...v } as Record<string, unknown>
    for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) {
      const field = key as keyof Venue
      if (same(v[field], old[field])) {
        if (next[field] === undefined) delete patched[key]
        else patched[key] = next[field]
      }
    }
    return [patched as Venue]
  })
}

export async function refreshVenueCatalog(db: Db) {
  if (
    (
      await db
        .select({ key: appConfig.key })
        .from(appConfig)
        .where(eq(appConfig.key, PATCH))
    ).length
  )
    return
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(1381322292)`)
    if (
      (
        await tx
          .select({ key: appConfig.key })
          .from(appConfig)
          .where(eq(appConfig.key, PATCH))
      ).length
    )
      return
    const before: Record<string, unknown> = {}
    for (const id of Object.keys(legacy)) {
      const [place] = await tx.select().from(places).where(eq(places.id, id))
      if (!place || !Array.isArray(place.attrs.candidates)) continue
      const current = place.attrs.candidates as Venue[]
      const updated = refreshedVenues(id, current)
      if (same(current, updated)) continue
      before[id] = current
      await tx
        .update(places)
        .set({
          attrs: sql`jsonb_set(${places.attrs}, '{candidates}', ${JSON.stringify(updated)}::jsonb, true)`,
        })
        .where(eq(places.id, id))
    }
    await tx
      .insert(appConfig)
      .values({
        key: PATCH,
        value: { before, appliedAt: new Date().toISOString() },
        meta: { source: 'migration' },
      })
  })
}
