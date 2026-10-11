import { beforeAll, describe, expect, it } from 'vitest'
import { communityPostSchema } from '#/core/community'
import { seedConfig } from '#/core/defaults'
import { initialTrip } from '#/core/trip'
import {
  communityImage,
  completionForTrip,
  listCommunity,
  shareCompletion,
} from '#/server/community'
import { memoryDb, type Db } from '#/server/db/client'
import { trips } from '#/server/db/schema'
import { parseBody } from '#/server/http'

let db: Db
beforeAll(async () => {
  db = await memoryDb()
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
