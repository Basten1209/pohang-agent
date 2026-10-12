import { createHash } from 'node:crypto'
import { beforeEach, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { memoryDb, type Db } from '#/server/db/client'
import { appConfig, communityVisitPosts } from '#/server/db/schema'
import { removeRequestedCommunityPost } from '#/server/db/community-cleanup'

let db: Db
const imageData = 'data:image/jpeg;base64,/9j/2Q=='
const imageSha256 = createHash('sha256')
  .update(Buffer.from('/9j/2Q==', 'base64'))
  .digest('hex')
const row = (id: string) => ({
  id,
  tripId: crypto.randomUUID(),
  course: 'guryongpo',
  placeId: 'food',
  placeName: '점심',
  author: '러너',
  caption: '사진',
  photoKind: 'UPLOAD',
  imageData,
})
beforeEach(async () => {
  db = await memoryDb()
})

it('removes only the requested post and image, records completion, and tolerates concurrent retries', async () => {
  const id = crypto.randomUUID()
  const otherId = crypto.randomUUID()
  await db.insert(communityVisitPosts).values([row(id), row(otherId)])
  await Promise.all([
    removeRequestedCommunityPost(db, { id, imageSha256 }),
    removeRequestedCommunityPost(db, { id, imageSha256 }),
  ])
  expect(
    (await db.select().from(communityVisitPosts)).map((p) => p.id),
  ).toEqual([otherId])
  const [marker] = await db
    .select()
    .from(appConfig)
    .where(eq(appConfig.key, `community-cleanup:${id}`))
  expect(marker.value).toMatchObject({ deleted: true })
})

it('preserves the post when the reviewed image does not match', async () => {
  const id = crypto.randomUUID()
  await db.insert(communityVisitPosts).values(row(id))
  await removeRequestedCommunityPost(db, { id, imageSha256: 'wrong-image' })
  expect(await db.select().from(communityVisitPosts)).toHaveLength(1)
  expect(await db.select().from(appConfig)).toHaveLength(0)
})

it('completes safely when the requested post was already removed', async () => {
  const id = crypto.randomUUID()
  await removeRequestedCommunityPost(db, { id, imageSha256 })
  const [marker] = await db.select().from(appConfig)
  expect(marker.value).toMatchObject({ deleted: false })
})
