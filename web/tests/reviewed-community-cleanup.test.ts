import { beforeEach, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { memoryDb, type Db } from '#/server/db/client'
import {
  appConfig,
  communityPosts,
  communityVisitPosts,
} from '#/server/db/schema'
import {
  removeReviewedCommunityPosts,
  reviewedCommunityRemovals,
} from '#/server/db/reviewed-community-cleanup'

let db: Db
const keeperId = 'a68ac061-8fdc-448e-aa6e-561a8f2911a4'
const row = (
  id: string,
  author = '다른 러너',
  demoImage = '/images/finisher-demo.png',
) => ({
  id,
  tripId: crypto.randomUUID(),
  course: 'guryongpo',
  author,
  caption: '사진',
  photoKind: 'DEMO',
  demoImage,
})
beforeEach(async () => {
  db = await memoryDb()
  for (const target of reviewedCommunityRemovals) {
    const data = row(target.id, target.author, target.image)
    if (target.kind === 'FINISH') await db.insert(communityPosts).values(data)
    else
      await db
        .insert(communityVisitPosts)
        .values({ ...data, placeId: 'food', placeName: '점심' })
  }
  await db.insert(communityPosts).values(row(keeperId, '구룡포 완주 러너'))
})

it('deletes the eight reviewed posts across both tables and preserves the original and unreviewed posts', async () => {
  const newId = crypto.randomUUID()
  // A later submission by the same author must not become a permanent ban.
  await db.insert(communityPosts).values(row(newId, '민준'))
  await Promise.all([
    removeReviewedCommunityPosts(db),
    removeReviewedCommunityPosts(db),
  ])
  expect(
    (await db.select().from(communityPosts)).map((p) => p.id).sort(),
  ).toEqual([keeperId, newId].sort())
  expect(await db.select().from(communityVisitPosts)).toHaveLength(0)
  const [marker] = await db.select().from(appConfig)
  expect(marker.value).toMatchObject({ keptId: keeperId })
  expect((marker.value as { removed: unknown[] }).removed).toHaveLength(8)
})

it('preserves the entire batch when the duplicate keeper is missing', async () => {
  await db.delete(communityPosts).where(eq(communityPosts.id, keeperId))
  await removeReviewedCommunityPosts(db)
  expect(await db.select().from(communityPosts)).toHaveLength(5)
  expect(await db.select().from(communityVisitPosts)).toHaveLength(3)
  expect(await db.select().from(appConfig)).toHaveLength(0)
})

it.each([
  { author: '변경된 작성자' },
  { demoImage: '/images/changed.webp' },
  { photoKind: 'UPLOAD' },
])('preserves the batch if a reviewed target changed: %j', async (patch) => {
  await db
    .update(communityVisitPosts)
    .set(patch)
    .where(eq(communityVisitPosts.id, reviewedCommunityRemovals[0].id))
  await removeReviewedCommunityPosts(db)
  expect(await db.select().from(communityPosts)).toHaveLength(6)
  expect(await db.select().from(communityVisitPosts)).toHaveLength(3)
  expect(await db.select().from(appConfig)).toHaveLength(0)
})

it('tolerates an already deleted target', async () => {
  await db
    .delete(communityVisitPosts)
    .where(eq(communityVisitPosts.id, reviewedCommunityRemovals[0].id))
  await removeReviewedCommunityPosts(db)
  expect((await db.select().from(communityPosts)).map((p) => p.id)).toEqual([
    keeperId,
  ])
  expect(await db.select().from(communityVisitPosts)).toHaveLength(0)
  const [marker] = await db.select().from(appConfig)
  expect((marker.value as { removed: unknown[] }).removed).toHaveLength(7)
})
