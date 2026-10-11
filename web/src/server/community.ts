import { desc, eq } from 'drizzle-orm'
import type { CommunityPost, CommunityPostInput } from '#/core/community'
import { tripStateSchema } from '#/core/trip'
import type { Db } from './db/client'
import { communityPosts, trips } from './db/schema'

const publicFields = {
  id: communityPosts.id,
  course: communityPosts.course,
  author: communityPosts.author,
  caption: communityPosts.caption,
  photoKind: communityPosts.photoKind,
  createdAt: communityPosts.createdAt,
}
const asPost = (
  row: Omit<typeof communityPosts.$inferSelect, 'tripId' | 'imageData'>,
): CommunityPost => ({
  ...row,
  photoKind: row.photoKind === 'DEMO' ? 'DEMO' : 'UPLOAD',
  image:
    row.photoKind === 'DEMO'
      ? '/images/finisher-demo.png'
      : `/api/community/${row.id}/image`,
  createdAt: row.createdAt.toISOString(),
})

export const listCommunity = async (db: Db) =>
  (
    await db
      .select(publicFields)
      .from(communityPosts)
      .orderBy(desc(communityPosts.createdAt))
      .limit(20)
  ).map(asPost)

export const completionForTrip = async (db: Db, tripId: string) => {
  const [row] = await db
    .select(publicFields)
    .from(communityPosts)
    .where(eq(communityPosts.tripId, tripId))
  return row ? asPost(row) : null
}

export const shareCompletion = async (db: Db, input: CommunityPostInput) => {
  const [trip] = await db
    .select({ state: trips.state })
    .from(trips)
    .where(eq(trips.id, input.tripId))
  const state = tripStateSchema.safeParse(trip?.state)
  if (!state.success || !state.data.created || state.data.phase < 3) return null
  const [inserted] = await db
    .insert(communityPosts)
    .values({
      id: crypto.randomUUID(),
      tripId: input.tripId,
      course: input.course,
      author: state.data.plan.nickname || '완주한 러너',
      caption: input.caption,
      photoKind: input.photo.kind,
      imageData: input.photo.kind === 'UPLOAD' ? input.photo.data : null,
    })
    .onConflictDoNothing({ target: communityPosts.tripId })
    .returning(publicFields)
  // Idempotent retries: a flaky connection or double-click never duplicates a post.
  const row =
    inserted ??
    (
      await db
        .select(publicFields)
        .from(communityPosts)
        .where(eq(communityPosts.tripId, input.tripId))
    )[0]
  return asPost(row)
}

export const communityImage = async (db: Db, id: string) => {
  const [row] = await db
    .select({ imageData: communityPosts.imageData })
    .from(communityPosts)
    .where(eq(communityPosts.id, id))
  return row?.imageData
    ? Buffer.from(row.imageData.split(',')[1], 'base64')
    : null
}
