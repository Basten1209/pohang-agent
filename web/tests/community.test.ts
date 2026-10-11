import { beforeAll, describe, expect, it } from 'vitest'
import {
  communityPostSchema,
  photoOpportunity,
  visitedPlaces,
} from '#/core/community'
import { seedConfig } from '#/core/defaults'
import { initialTrip } from '#/core/trip'
import {
  communityImage,
  completionForTrip,
  listCommunity,
  shareCompletion,
  shareVisit,
  visitsForTrip,
  visitForTrip,
} from '#/server/community'
import { bootstrap, memoryDb, type Db } from '#/server/db/client'
import { trips } from '#/server/db/schema'
import { parseBody } from '#/server/http'

let db: Db
beforeAll(async () => {
  db = await memoryDb()
})

describe('방문 사진과 제안', () => {
  const visit = async (completed = ['street', 'cafe']) => {
    const id = crypto.randomUUID()
    const state = { ...initialTrip(seedConfig), created: true, phase: 3 }
    state.plan = {
      ...state.plan,
      nickname: '구룡포 러너',
      condition: 'OK',
      stage: 'LOCAL',
      completed,
    }
    await db.insert(trips).values({ id, state })
    return { id, state }
  }
  it('예정 장소를 방문한 것처럼 게시하거나 다른 권역으로 태그할 수 없다', async () => {
    const { id } = await visit(['food'])
    expect(
      await shareVisit(db, seedConfig, { ...input(id), placeId: 'street' }),
    ).toBeNull()
    const visited = await visit()
    expect(
      await shareVisit(db, seedConfig, {
        ...input(visited.id),
        placeId: 'street',
        course: 'homigot',
      }),
    ).toBeNull()
    const inactive = {
      ...seedConfig,
      places: seedConfig.places.map((p) => ({ ...p, active: false })),
    }
    expect(
      await shareVisit(db, inactive, {
        ...input(visited.id),
        placeId: 'street',
      }),
    ).toBeNull()
    expect(
      await shareCompletion(db, { ...input(visited.id), placeId: 'street' }),
    ).toBeNull()
  })
  it('완주 사진과 장소별 사진을 함께 보존하고 동시 재시도도 중복 게시하지 않는다', async () => {
    const { id } = await visit()
    const finish = await shareCompletion(db, input(id))
    const data = {
      ...input(id),
      placeId: 'street',
      caption: '골목에서 남긴 한 장',
    }
    const [first, retry] = await Promise.all([
      shareVisit(db, seedConfig, data),
      shareVisit(db, seedConfig, data),
    ])
    expect(first).toEqual(retry)
    expect(first).toMatchObject({
      kind: 'VISIT',
      placeId: 'street',
      placeName: '일본인 가옥거리',
      image: '/images/guryongpo-street-2024.jpg',
    })
    expect(first).not.toHaveProperty('tripId')
    expect(first).not.toHaveProperty('imageData')
    expect(first).not.toHaveProperty('demoImage')
    expect(await completionForTrip(db, id)).toEqual(finish)
    expect(await visitForTrip(db, id, 'street')).toEqual(first)
    expect(await visitForTrip(db, id, 'hm-hand')).toBeNull()
    const cafe = await shareVisit(db, seedConfig, {
      ...data,
      placeId: 'cafe',
      photo: { kind: 'UPLOAD', data: 'data:image/jpeg;base64,/9j/2Q==' },
    })
    expect(cafe!.id).not.toBe(first!.id)
    expect(await communityImage(db, cafe!.id)).toEqual(
      Buffer.from('/9j/2Q==', 'base64'),
    )
    expect(await visitsForTrip(db, id)).toHaveLength(2)
    await bootstrap(db)
    expect(await completionForTrip(db, id)).toEqual(finish)
    expect(
      (await listCommunity(db)).filter((p) =>
        [finish!.id, first!.id, cafe!.id].includes(p.id),
      ),
    ).toHaveLength(3)
  })
  it('직접 확인한 방문 뒤 여유가 있을 때만 제안하고 의료·복귀 중에는 제안하지 않는다', async () => {
    const { state } = await visit()
    expect(visitedPlaces(seedConfig, state).map((p) => p.id)).toEqual([
      'street',
      'cafe',
    ])
    expect(photoOpportunity(seedConfig, state, 20)?.id).toBe('cafe')
    for (const slack of [null, 19, -5])
      expect(photoOpportunity(seedConfig, state, slack)).toBeNull()
    for (const stage of ['BEFORE', 'OUTBOUND', 'RETURN', 'DONE'] as const)
      expect(
        photoOpportunity(
          seedConfig,
          { ...state, plan: { ...state.plan, stage } },
          60,
        ),
      ).toBeNull()
    expect(
      photoOpportunity(
        seedConfig,
        { ...state, plan: { ...state.plan, condition: 'UNWELL' } },
        60,
      ),
    ).toBeNull()
    expect(visitedPlaces(seedConfig, { ...state, phase: 2 })).toEqual([])
  })
})
const input = (tripId = crypto.randomUUID()) => ({
  tripId,
  course: 'guryongpo' as const,
  caption: '완주했어요!',
  photo: { kind: 'DEMO' as const },
})
async function finished() {
  const id = crypto.randomUUID()
  const state = { ...initialTrip(seedConfig), created: true, phase: 3 }
  state.plan.nickname = '완주 러너'
  await db.insert(trips).values({ id, state })
  return id
}

describe('완주 사진 커뮤니티', () => {
  it('완주한 여정만 공유 가능', async () => {
    expect(await shareCompletion(db, input())).toBeNull()
    const id = crypto.randomUUID()
    await db
      .insert(trips)
      .values({ id, state: { ...initialTrip(seedConfig), created: true } })
    expect(await shareCompletion(db, input(id))).toBeNull()
  })
  it('사진을 저장하고 재시도해도 하나만 게시하며 공개 응답에는 여정 식별자를 숨김', async () => {
    const data = input(await finished())
    const first = await shareCompletion(db, data)
    const retry = await shareCompletion(db, data)
    expect(retry).toEqual(first)
    expect(await completionForTrip(db, data.tripId)).toEqual(first)
    expect(await completionForTrip(db, crypto.randomUUID())).toBeNull()
    const feed = await listCommunity(db)
    expect(feed.filter((p) => p.id === first!.id)).toHaveLength(1)
    expect(first).toMatchObject({
      author: '완주 러너',
      photoKind: 'DEMO',
      image: '/images/finisher-demo.png',
    })
    expect(first).not.toHaveProperty('tripId')
    expect(first).not.toHaveProperty('imageData')
  })
  it('업로드 사진은 DB에서 별도 이미지로 읽고 목록에 원본 데이터를 싣지 않음', async () => {
    const data = communityPostSchema.parse({
      ...input(await finished()),
      photo: { kind: 'UPLOAD', data: 'data:image/jpeg;base64,/9j/2Q==' },
    })
    const post = await shareCompletion(db, data)
    expect(post!.image).toBe(`/api/community/${post!.id}/image`)
    expect(await communityImage(db, post!.id)).toEqual(
      Buffer.from('/9j/2Q==', 'base64'),
    )
    expect(await communityImage(db, crypto.randomUUID())).toBeNull()
  })
  it('외부 URL, SVG, 과대 이미지와 권역 밖 게시물을 거부', async () => {
    for (const data of [
      'https://example.org/photo.jpg',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'data:image/jpeg;base64,' + '/9j/' + 'A'.repeat(1_000_000),
    ])
      expect(
        communityPostSchema.safeParse({
          ...input(),
          photo: { kind: 'UPLOAD', data },
        }).success,
      ).toBe(false)
    expect(
      communityPostSchema.safeParse({ ...input(), course: 'jukdo' }).success,
    ).toBe(false)
    const response = await parseBody(
      new Request('https://example.org', {
        method: 'POST',
        body: 'x'.repeat(1_010_001),
      }),
      communityPostSchema,
      1_010_000,
    )
    expect(response.ok).toBe(false)
    if (!response.ok) expect(response.response.status).toBe(413)
  })
})
