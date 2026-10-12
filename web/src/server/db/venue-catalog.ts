import { eq, sql } from 'drizzle-orm'
import { venueCandidates } from '#/core/seed/venues'
import type { Db } from './client'
import { appConfig, places } from './schema'

const PATCH = 'official-venue-candidates-2026-10-12'
/** Only enrich candidate lists. Keep schedule geometry, images and operator settings. */
export async function applyVenueCatalog(db: Db) {
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
    for (const [id, candidates] of Object.entries(venueCandidates)) {
      const [place] = await tx.select().from(places).where(eq(places.id, id))
      if (!place) continue
      before[id] = place.attrs.candidates ?? null
      // An operator-supplied candidate list wins over this initial catalogue.
      if (
        Array.isArray(place.attrs.candidates) &&
        place.attrs.candidates.length
      )
        continue
      await tx
        .update(places)
        .set({
          attrs: sql`jsonb_set(${places.attrs}, '{candidates}', ${JSON.stringify(candidates)}::jsonb, true)`,
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
