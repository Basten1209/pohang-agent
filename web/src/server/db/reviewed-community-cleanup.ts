import { eq, inArray, sql } from 'drizzle-orm'
import type { Db } from './client'
import { appConfig, communityPosts, communityVisitPosts } from './schema'

const finishImage = '/images/finisher-demo.png'
const keeperId = 'a68ac061-8fdc-448e-aa6e-561a8f2911a4'

/** Reviewed on 2026-10-12: remove these existing posts, not future submissions.
 * The six finish photos were also compared by SHA-256 and matched exactly.
 * Keep the oldest post by another author for that image.
 */
export const reviewedCommunityRemovals = [
  {
    id: 'b6336818-cbfa-423e-b3c3-b8cbd6cab4c7',
    kind: 'VISIT',
    author: '민준',
    image: '/images/demo/sample-cafe.webp',
    reason: 'AUTHOR',
  },
  {
    id: '5f09ab17-5603-4346-b9d0-e7e12f1e2146',
    kind: 'VISIT',
    author: '민준',
    image: '/images/demo/sample-street.webp',
    reason: 'AUTHOR',
  },
  {
    id: '7f55749b-4dce-4c23-a78d-19992f804932',
    kind: 'VISIT',
    author: '민준',
    image: '/images/demo/sample-food.webp',
    reason: 'AUTHOR',
  },
  {
    id: '5894f4ee-f17f-4c38-85ef-e5eb820b7b1b',
    kind: 'FINISH',
    author: '민준',
    image: finishImage,
    reason: 'AUTHOR',
  },
  {
    id: '6b6da32d-0709-46f7-919a-af7bffaf4669',
    kind: 'FINISH',
    author: '벤',
    image: finishImage,
    reason: 'DUPLICATE',
    keeperId,
  },
  {
    id: 'f2d52251-7f60-43d8-83a1-1835a99797d1',
    kind: 'FINISH',
    author: '완주한 러너',
    image: finishImage,
    reason: 'DUPLICATE',
    keeperId,
  },
  {
    id: '3e1fd167-bdc6-4bf1-a1ab-bed1ff2f7e63',
    kind: 'FINISH',
    author: '포항러너',
    image: finishImage,
    reason: 'DUPLICATE',
    keeperId,
  },
  {
    id: '6fc69ec7-319d-4293-9fb2-6dc6c38ca7b8',
    kind: 'FINISH',
    author: '발표 리허설',
    image: finishImage,
    reason: 'DUPLICATE',
    keeperId,
  },
] as const

const key = 'community-cleanup:2026-10-12-minjun-duplicates'
export async function removeReviewedCommunityPosts(db: Db) {
  if ((await db.select().from(appConfig).where(eq(appConfig.key, key))).length)
    return
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(1381322292)`)
    if (
      (await tx.select().from(appConfig).where(eq(appConfig.key, key))).length
    )
      return
    const ids = [...reviewedCommunityRemovals.map((p) => p.id), keeperId]
    const finishes = await tx
      .select()
      .from(communityPosts)
      .where(inArray(communityPosts.id, ids))
      .for('update')
    const visits = await tx
      .select()
      .from(communityVisitPosts)
      .where(inArray(communityVisitPosts.id, ids))
      .for('update')
    const rows = [
      ...finishes.map((p) => ({
        ...p,
        kind: 'FINISH' as const,
        image: p.demoImage || finishImage,
      })),
      ...visits.map((p) => ({
        ...p,
        kind: 'VISIT' as const,
        image: p.demoImage,
      })),
    ]
    const active = reviewedCommunityRemovals.filter((target) =>
      rows.some((p) => p.id === target.id && p.kind === target.kind),
    )
    // Validate the whole batch before deletion. A changed image/author or lost
    // keeper leaves the batch untouched for review, without marking it done.
    if (
      active.some((target) => {
        const post = rows.find(
          (p) => p.id === target.id && p.kind === target.kind,
        )!
        if (
          post.author !== target.author ||
          post.photoKind !== 'DEMO' ||
          post.image !== target.image
        )
          return true
        if ('keeperId' in target) {
          const kept = rows.find(
            (p) => p.id === target.keeperId && p.kind === target.kind,
          )
          return (
            !kept ||
            kept.photoKind !== 'DEMO' ||
            kept.image !== target.image ||
            kept.author === '민준'
          )
        }
        return false
      })
    )
      return
    for (const kind of ['FINISH', 'VISIT'] as const) {
      const removeIds = active.filter((p) => p.kind === kind).map((p) => p.id)
      if (!removeIds.length) continue
      const table = kind === 'FINISH' ? communityPosts : communityVisitPosts
      await tx.delete(table).where(inArray(table.id, removeIds))
    }
    await tx.insert(appConfig).values({
      key,
      version: 1,
      value: {
        appliedAt: new Date().toISOString(),
        removed: active.map(({ id, kind, reason }) => ({ id, kind, reason })),
        keptId: keeperId,
      },
      meta: { source: 'user-request' },
    })
  })
}
