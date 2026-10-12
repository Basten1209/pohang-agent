import { eq, inArray, sql } from 'drizzle-orm'
import type { Db } from './client'
import { appConfig, communityPosts } from './schema'

const finishImage = '/images/finisher-demo.png'
const keeperId = 'a68ac061-8fdc-448e-aa6e-561a8f2911a4'

/** Reviewed on 2026-10-12: the community feed showed the same demo finish
 * photo twice. Keep the older post's photo and give this one a different
 * picture that matches its caption (the Yeongil Bay sea behind the runner).
 */
export const reviewedCommunityReplacements = [
  {
    id: 'cd11dea4-1a73-4771-babb-29d08bdb93aa',
    author: '민준',
    image: finishImage,
    replacement: '/images/yeongildae.jpg',
    keeperId,
  },
] as const

const key = 'community-cleanup:2026-10-12-duplicate-photo-swap'
export async function replaceReviewedCommunityPhotos(db: Db) {
  if ((await db.select().from(appConfig).where(eq(appConfig.key, key))).length)
    return
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(1381322293)`)
    if (
      (await tx.select().from(appConfig).where(eq(appConfig.key, key))).length
    )
      return
    const ids = [...reviewedCommunityReplacements.map((p) => p.id), keeperId]
    const rows = (
      await tx
        .select()
        .from(communityPosts)
        .where(inArray(communityPosts.id, ids))
        .for('update')
    ).map((p) => ({ ...p, image: p.demoImage || finishImage }))
    const active = reviewedCommunityReplacements.filter((target) =>
      rows.some((p) => p.id === target.id),
    )
    // Validate the whole batch first. A changed author/photo or a lost keeper
    // leaves everything untouched for review, without marking it done.
    if (
      active.some((target) => {
        const post = rows.find((p) => p.id === target.id)!
        const kept = rows.find((p) => p.id === target.keeperId)
        return (
          post.author !== target.author ||
          post.photoKind !== 'DEMO' ||
          post.image !== target.image ||
          !kept ||
          kept.photoKind !== 'DEMO' ||
          kept.image !== target.image
        )
      })
    )
      return
    for (const target of active)
      await tx
        .update(communityPosts)
        .set({ demoImage: target.replacement })
        .where(eq(communityPosts.id, target.id))
    await tx.insert(appConfig).values({
      key,
      version: 1,
      value: {
        appliedAt: new Date().toISOString(),
        replaced: active.map(({ id, replacement }) => ({ id, replacement })),
        keptId: keeperId,
      },
      meta: { source: 'user-request' },
    })
  })
}
