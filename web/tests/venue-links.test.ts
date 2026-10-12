import { expect, it } from 'vitest'
import { venueMapUrl } from '#/core/venues'
import { venueCandidates } from '#/core/seed/venues'

it('동명이인 식당은 검증한 장소 ID로 바로 연다', () => {
  expect(
    venueMapUrl(venueCandidates.food.find((v) => v.id === 'halmae-sikdang')!),
  ).toBe('https://map.kakao.com/link/map/9570020')
})
it('지도에 등록되지 않은 음식거리명은 시청 안내 좌표에 핀을 표시한다', () => {
  const url = decodeURIComponent(
    venueMapUrl(venueCandidates.food.find((v) => v.id === 'gwamegi-street')!),
  )
  expect(url).toBe(
    'https://map.kakao.com/link/map/구룡포과메기물회거리,35.9903122,129.555267',
  )
})
it('끊긴 oceang 링크와 영업 근거가 없는 촬영지 식당은 추천하지 않는다', () => {
  const candidates = Object.values(venueCandidates).flat()
  expect(candidates.some((v) => v.source.url.includes('oceang.kr'))).toBe(false)
  expect(candidates.some((v) => v.id === 'jinsu-baekban')).toBe(false)
})

import {
  refreshedVenues,
  refreshVenueCatalog,
} from '#/server/db/refresh-venues'
import legacy from '#/server/db/venue-catalog-v1.json'
import { memoryDb } from '#/server/db/client'
import { seed, readConfig } from '#/server/db/repo'
import { seedConfig } from '#/core/defaults'
import { places } from '#/server/db/schema'
import { eq } from 'drizzle-orm'
import type { Venue } from '#/core/schema'

it('옛 후보만 갱신하며 운영자 후보·개별 설명 수정은 보존한다', () => {
  const old = legacy.food as Venue[]
  const custom = { ...old[0], id: 'custom', name: '직접 추가한 가게' }
  const updated = refreshedVenues('food', [
    { ...old[0], description: '운영자 설명' },
    ...old.slice(1),
    custom,
  ])
  expect(updated[0].description).toBe('운영자 설명')
  expect(updated[0].source.url).toContain('visitkorea.or.kr')
  expect(updated.at(-1)).toEqual(custom)
  expect(
    refreshedVenues('food', [{ ...old[0], name: '운영자가 바꾼 가게' }])[0].map,
  ).toBeUndefined()
})
it('기존 DB도 수정하되 재실행·일정·다른 설정에 영향이 없다', async () => {
  const db = await memoryDb()
  await seed(db, seedConfig)
  for (const [id, candidates] of Object.entries(legacy)) {
    const original = seedConfig.places.find((p) => p.id === id)!
    await db
      .update(places)
      .set({ attrs: { ...original.attrs, candidates, title: '운영자 제목' } })
      .where(eq(places.id, id))
  }
  await refreshVenueCatalog(db)
  const result = (await readConfig(db, seedConfig)).config
  for (const [id, candidates] of Object.entries(venueCandidates)) {
    expect(result.places.find((p) => p.id === id)?.attrs.candidates).toEqual(
      candidates,
    )
    expect(result.places.find((p) => p.id === id)?.attrs.title).toBe(
      '운영자 제목',
    )
  }
  expect(result.agent).toEqual(seedConfig.agent)
  await refreshVenueCatalog(db)
  expect((await readConfig(db, seedConfig)).config).toEqual(result)
})
