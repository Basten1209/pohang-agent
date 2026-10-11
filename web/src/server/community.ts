import { and, desc, eq } from 'drizzle-orm'
import type { CommunityPost, CommunityPostInput } from '#/core/community'
import { visitedPlaces } from '#/core/community'
import type { TripConfig } from '#/core/schema'
import { tripStateSchema } from '#/core/trip'
import type { Db } from './db/client'
import { communityPosts, communityVisitPosts, trips } from './db/schema'

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
  kind: 'FINISH',
  placeId: null,
  placeName: null,
  photoKind: row.photoKind === 'DEMO' ? 'DEMO' : 'UPLOAD',
  image:
    row.photoKind === 'DEMO'
      ? '/images/finisher-demo.png'
      : `/api/community/${row.id}/image`,
  createdAt: row.createdAt.toISOString(),
})

const visitFields = {
  id: communityVisitPosts.id,
  course: communityVisitPosts.course,
  placeId: communityVisitPosts.placeId,
  placeName: communityVisitPosts.placeName,
  author: communityVisitPosts.author,
  caption: communityVisitPosts.caption,
  photoKind: communityVisitPosts.photoKind,
  demoImage: communityVisitPosts.demoImage,
  createdAt: communityVisitPosts.createdAt,
}
const asVisit = (
  row: Omit<typeof communityVisitPosts.$inferSelect, 'tripId' | 'imageData'>,
): CommunityPost => {
  const { demoImage, ...post } = row
  return {
    ...post,
    kind: 'VISIT',
    photoKind: row.photoKind === 'DEMO' ? 'DEMO' : 'UPLOAD',
    image:
      row.photoKind === 'DEMO' ? demoImage! : `/api/community/${row.id}/image`,
    createdAt: row.createdAt.toISOString(),
  }
}

export const listCommunity = async (db: Db) => {
  const [finishes, visits] = await Promise.all([
    db
      .select(publicFields)
      .from(communityPosts)
      .orderBy(desc(communityPosts.createdAt))
      .limit(20),
    db
      .select(visitFields)
      .from(communityVisitPosts)
      .orderBy(desc(communityVisitPosts.createdAt))
      .limit(20),
  ])
  return [...finishes.map(asPost), ...visits.map(asVisit)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20)
}

export const visitsForTrip = async (db: Db, tripId: string) =>
  (
    await db
      .select(visitFields)
      .from(communityVisitPosts)
      .where(eq(communityVisitPosts.tripId, tripId))
  ).map(asVisit)

export const visitForTrip = async (db: Db, tripId: string, placeId: string) => {
  const [row] = await db
    .select(visitFields)
    .from(communityVisitPosts)
    .where(
      and(
        eq(communityVisitPosts.tripId, tripId),
        eq(communityVisitPosts.placeId, placeId),
      ),
    )
  return row ? asVisit(row) : null
}

export const shareVisit = async (
  db: Db,
  config: TripConfig,
  input: CommunityPostInput,
) => {
  const [trip] = await db
    .select({ state: trips.state })
    .from(trips)
    .where(eq(trips.id, input.tripId))
  const state = tripStateSchema.safeParse(trip?.state)
  if (!state.success) return null
  const place = visitedPlaces(config, state.data).find(
    (p) => p.id === input.placeId,
  )
  if (
    !place ||
    place.attrs.course !== input.course ||
    (input.photo.kind === 'DEMO' && !place.attrs.image)
  )
    return null
  const [row] = await db
    .insert(communityVisitPosts)
    .values({
      id: crypto.randomUUID(),
      tripId: input.tripId,
      course: place.attrs.course,
      placeId: place.id,
      placeName: place.attrs.short,
      author: state.data.plan.nickname || '여행하는 러너',
      caption: input.caption,
      photoKind: input.photo.kind,
      imageData: input.photo.kind === 'UPLOAD' ? input.photo.data : null,
      demoImage: input.photo.kind === 'DEMO' ? place.attrs.image : null,
    })
    .onConflictDoNothing({
      target: [communityVisitPosts.tripId, communityVisitPosts.placeId],
    })
    .returning(visitFields)
  return row ? asVisit(row) : visitForTrip(db, input.tripId, place.id)
}

export const completionForTrip = async (db: Db, tripId: string) => {
  const [row] = await db
    .select(publicFields)
    .from(communityPosts)
    .where(eq(communityPosts.tripId, tripId))
  return row ? asPost(row) : null
}

export const shareCompletion = async (db: Db, input: CommunityPostInput) => {
  if (input.placeId) return null
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
  if (row?.imageData) return Buffer.from(row.imageData.split(',')[1], 'base64')
  const [visit] = await db
    .select({ imageData: communityVisitPosts.imageData })
    .from(communityVisitPosts)
    .where(eq(communityVisitPosts.id, id))
  return visit?.imageData
    ? Buffer.from(visit.imageData.split(',')[1], 'base64')
    : null
}
