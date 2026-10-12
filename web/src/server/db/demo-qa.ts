import { createHash } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import posts from '../../../scripts/demo-community.json'
import { visitDemoImages } from '#/core/demo-images'
import type { Db } from './client'
import {
  appConfig,
  communityPosts,
  communityVisitPosts,
  places,
} from './schema'

const MIGRATION = 'demo-qa-2026-10-12'
export const demoPostId = (name: string) => {
  const hex = createHash('sha256')
    .update(`run2-qa-demo-v1:${name}`)
    .digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** One-time, transactional data patch; never raises the global seed version.
 * Runs with the deployment's DB connection, so secrets need not leave Vercel.
 * The marker also retains original field values/ids for an auditable rollback.
 */
export async function applyDemoQaData(db: Db) {
  if (
    (
      await db
        .select({ key: appConfig.key })
        .from(appConfig)
        .where(eq(appConfig.key, MIGRATION))
    ).length
  )
    return
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(1381322291)`)
    if (
      (
        await tx
          .select({ key: appConfig.key })
          .from(appConfig)
          .where(eq(appConfig.key, MIGRATION))
      ).length
    )
      return
    const [agent] = await tx
      .select()
      .from(appConfig)
      .where(eq(appConfig.key, 'agent'))
    const beforePlaces = await tx
      .select({ id: places.id, attrs: places.attrs })
      .from(places)
    const beforePosts = [
      ...(await tx.select({ id: communityPosts.id }).from(communityPosts)),
      ...(await tx
        .select({ id: communityVisitPosts.id })
        .from(communityVisitPosts)),
    ]
    for (const [index, post] of posts.entries()) {
      const base = {
        id: demoPostId(post.key),
        tripId: demoPostId(`trip:${post.key}`),
        course: post.course,
        author: post.author,
        caption: post.caption,
        photoKind: 'DEMO',
        demoImage: post.image,
        createdAt: new Date(Date.now() - (24 + index) * 3600000),
      }
      if (post.kind === 'FINISH')
        await tx.insert(communityPosts).values(base).onConflictDoNothing()
      else
        await tx
          .insert(communityVisitPosts)
          .values({
            ...base,
            placeId: post.placeId!,
            placeName: post.placeName!,
          })
          .onConflictDoNothing()
    }
    for (const [id, image] of Object.entries(visitDemoImages)) {
      await tx.execute(sql`UPDATE places SET attrs=jsonb_set(attrs,'{image}',to_jsonb(${image}::text)), meta=meta || '{"imageSource":"AI_GENERATED_DEMO"}'::jsonb, updated_at=now()
        WHERE id=${id} AND (coalesce(attrs->>'image','')='' OR attrs->>'image' LIKE '/images/demo/sample-%')`)
    }
    await tx.execute(
      sql`UPDATE app_config SET value=jsonb_set(value,'{maxOutputTokens}','1600'::jsonb), meta=meta || '{"source":"operator"}'::jsonb, updated_at=now() WHERE key='agent'`,
    )
    await tx.insert(appConfig).values({
      key: MIGRATION,
      version: 1,
      value: {
        appliedAt: new Date().toISOString(),
        ids: posts.map((p) => demoPostId(p.key)),
        previous: {
          agent: agent?.value,
          placeImages: beforePlaces.map((p) => ({
            id: p.id,
            image: p.attrs.image,
          })),
          postIds: beforePosts.map((p) => p.id),
        },
      },
      meta: { source: 'migration' },
    })
  })
}
