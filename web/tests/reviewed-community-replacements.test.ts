import { beforeEach, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { memoryDb, type Db } from '#/server/db/client'
import { appConfig, communityPosts } from '#/server/db/schema'
import {
  replaceReviewedCommunityPhotos,
  reviewedCommunityReplacements,
} from '#/server/db/reviewed-community-replacements'

let db: Db
const keeperId = 'a68ac061-8fdc-448e-aa6e-561a8f2911a4'
const [target] = reviewedCommunityReplacements
const row = (id: string, author: string, demoImage: string | null = null) => ({
  id,
  tripId: crypto.randomUUID(),
  course: 'guryongpo',
  author,
  caption: '사진',
  photoKind: 'DEMO',
  demoImage,
})
const imageOf = async (id: string) =>
  (await db.select().from(communityPosts).where(eq(communityPosts.id, id)))[0]
    ?.demoImage
beforeEach(async () => {
  db = await memoryDb()
  await db.insert(communityPosts).values(row(target.id, target.author))
  await db.insert(communityPosts).values(row(keeperId, '구룡포 완주 러너'))
})

it('gives the duplicate a different photo once and keeps the original', async () => {
  const later = crypto.randomUUID()
  await db.insert(communityPosts).values(row(later, '민준'))
  await Promise.all([
    replaceReviewedCommunityPhotos(db),
    replaceReviewedCommunityPhotos(db),
  ])
  expect(await imageOf(target.id)).toBe('/images/yeongildae.jpg')
  expect(await imageOf(keeperId)).toBeNull()
  expect(await imageOf(later)).toBeNull()
  const [marker] = await db.select().from(appConfig)
  expect(marker.value).toMatchObject({ keptId: keeperId })
})

it('leaves a photo changed since the review alone', async () => {
  await db
    .update(communityPosts)
    .set({ demoImage: '/images/changed.webp' })
    .where(eq(communityPosts.id, target.id))
  await replaceReviewedCommunityPhotos(db)
  expect(await imageOf(target.id)).toBe('/images/changed.webp')
  expect(await db.select().from(appConfig)).toHaveLength(0)
})

it('leaves the duplicate alone when the original is gone', async () => {
  await db.delete(communityPosts).where(eq(communityPosts.id, keeperId))
  await replaceReviewedCommunityPhotos(db)
  expect(await imageOf(target.id)).toBeNull()
  expect(await db.select().from(appConfig)).toHaveLength(0)
})
