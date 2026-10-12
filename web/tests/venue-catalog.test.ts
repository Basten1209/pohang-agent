import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { seedConfig } from '#/core/defaults'
import { courseVenues } from '#/core/venues'
import { knowledgeOf, searchKnowledge } from '#/core/knowledge'
import { venueSchema } from '#/core/schema'
import { venueCandidates } from '#/core/seed/venues'
import { memoryDb } from '#/server/db/client'
import { seed, readConfig } from '#/server/db/repo'
import { places } from '#/server/db/schema'
import { applyVenueCatalog } from '#/server/db/venue-catalog'

describe('공식 관광 자료의 실제 후보', () => {
  it('음식·카페·볼거리 후보에 출처가 있고 활성 코스 권역을 섞지 않는다', () => {
    const gp = courseVenues(seedConfig, 'guryongpo')
    const hm = courseVenues(seedConfig, 'homigot')
    expect(gp.length + hm.length).toBe(18)
    for (const v of [...gp, ...hm]) {
      expect(venueSchema.safeParse(v).success).toBe(true)
      expect(new URL(v.source.url).hostname).toMatch(
        /pohang\.go\.kr|korean\.visitkorea\.or\.kr|place\.map\.kakao\.com/,
      )
    }
    expect(gp.every((v) => v.address.startsWith('구룡포읍'))).toBe(true)
    expect(hm.every((v) => v.address.startsWith('호미곶면'))).toBe(true)
    expect(courseVenues(seedConfig, 'yeongildae')).toEqual([])
    expect(courseVenues(seedConfig, null)).toEqual([])
    expect(gp.find((v) => v.id === 'kkakkune')?.tenTaste).toBe('모리국수')
    expect(gp.find((v) => v.id === 'cheolgyu')?.tenTaste).toBeUndefined()
    expect(gp.find((v) => v.id === 'default-coffee')?.detour).toBe(true)
  })
  it('식당과 카페 검색에서 실제 이름과 출처를 찾는다', () => {
    const docs = knowledgeOf(seedConfig)
    expect(
      searchKnowledge(docs, '구룡포 모리국수', 5).some(
        (d) => d.title.includes('까꾸네') && !!d.source,
      ),
    ).toBe(true)
    expect(
      searchKnowledge(docs, '구룡포 카페', 4).some(
        (d) => d.title.includes('커피311') && !!d.source,
      ),
    ).toBe(true)
    expect(
      searchKnowledge(docs, '호미곶 카페', 4).some(
        (d) => d.title.includes('오핑') && !!d.source,
      ),
    ).toBe(true)
  })
  it('기존 DB에는 후보만 추가하고 운영자 편집·일정 필드·재실행을 보존한다', async () => {
    const db = await memoryDb()
    await seed(db, seedConfig)
    const original = seedConfig.places.find((p) => p.id === 'food')!
    const attrs = {
      ...original.attrs,
      title: '운영자 식사 제목',
      candidates: [],
    }
    await db.update(places).set({ attrs }).where(eq(places.id, 'food'))
    const custom = [{ ...venueCandidates.cafe[0], name: '운영자 카페' }]
    await db
      .update(places)
      .set({
        attrs: {
          ...seedConfig.places.find((p) => p.id === 'cafe')!.attrs,
          candidates: custom,
        },
      })
      .where(eq(places.id, 'cafe'))
    await applyVenueCatalog(db)
    const first = (await readConfig(db, seedConfig)).config
    expect(first.places.find((p) => p.id === 'food')?.attrs).toEqual({
      ...attrs,
      candidates: venueCandidates.food,
    })
    expect(first.places.find((p) => p.id === 'cafe')?.attrs.candidates).toEqual(
      custom,
    )
    await applyVenueCatalog(db)
    expect((await readConfig(db, seedConfig)).config).toEqual(first)
  })
})
