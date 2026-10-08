import { describe, expect, it } from 'vitest'
import { seedConfig } from '#/core/defaults'
import { knowledgeOf, searchKnowledge, terms } from '#/core/knowledge'
import { resolvePoint } from '#/core/where'
import {
  call,
  errorOf,
  findStation,
  itemsOf,
  kmaBase,
  kmaGrid,
} from '#/server/sources/datagokr'

const docs = knowledgeOf(seedConfig)
/** The tool returns several results; the right one must be among the first three. */
const top3 = (q: string) => searchKnowledge(docs, q, 3).map((d) => d.id)

describe('지식 검색 (프롬프트 밖의 자료)', () => {
  it('조사를 떼고 단어를 나눔', () => {
    expect(terms('구룡포는 뭘로 유명해요?')).toContain('구룡포')
    expect(terms('물회를 먹고 싶어')).toContain('물회')
  })
  it.each([
    ['대회 코스 반환점', 'race-course'],
    ['배번 어디서 받아', 'faq-0'],
    ['과메기 제철', 'guide-food-gwamegi'],
    ['포항역 KTX SRT', 'guide-tr-station'],
    ['스페이스워크', 'place-yd-spacewalk'],
    ['호미곶 코스', 'course-homigot'],
  ])('%s → %s', (q, id) => expect(top3(q)).toContain(id))
  it('관계없는 말에는 아무것도 돌려주지 않음', () =>
    expect(searchKnowledge(docs, '양자역학')).toEqual([]))
})

describe('위치 이름 해석', () => {
  const plan = { ...seedConfig.defaults.plan, course: 'homigot' }
  it.each([
    ['STATION', '포항역'],
    ['포항역', '포항역'],
    ['COURSE', '호미곶'],
    ['죽도시장', '죽도시장'],
    ['스페이스워크', '스페이스워크'],
    ['이가리', '이가리 닻 전망대'],
  ])('%s → %s', (name, expected) =>
    expect(resolvePoint(seedConfig, plan, name)?.name).toBe(expected),
  )
  it('모르는 곳은 추측하지 않음', () =>
    expect(resolvePoint(seedConfig, plan, '화성')).toBeUndefined())
})

describe('공공데이터포털 응답 해석', () => {
  it('item이 배열·단일 객체·빈 문자열이어도 목록으로', () => {
    const wrap = (items: unknown) => ({ response: { body: { items } } })
    expect(itemsOf(wrap({ item: [{ a: 1 }, { a: 2 }] }))).toHaveLength(2)
    expect(itemsOf(wrap({ item: { a: 1 } }))).toEqual([{ a: 1 }])
    expect(itemsOf(wrap(''))).toEqual([])
  })
  it('JSON을 요청해도 오는 XML 오류와 결과 코드를 오류로 읽음', () => {
    expect(
      errorOf(
        '<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>',
      ),
    ).toBe('SERVICE_KEY_IS_NOT_REGISTERED_ERROR')
    expect(
      errorOf(
        JSON.stringify({
          response: { header: { resultCode: '03', resultMsg: 'NO_DATA' } },
        }),
      ),
    ).toBe('NO_DATA')
    expect(
      errorOf(JSON.stringify({ response: { header: { resultCode: '00' } } })),
    ).toBeNull()
    expect(
      errorOf(JSON.stringify({ response: { header: { resultCode: '0000' } } })),
    ).toBeNull()
  })
  it('키가 없으면 요청하지 않고 설정 필요로 답함', async () => {
    const r = await call('1613000/TrainInfo/GetCtyCodeList', {}, {})
    expect(r.status).toBe('NOT_CONFIGURED')
  })
  it('기상청 격자: 포항 시내는 (102, 94) 부근', () => {
    const { nx, ny } = kmaGrid(36.0565, 129.378)
    expect(nx).toBeGreaterThanOrEqual(101)
    expect(nx).toBeLessThanOrEqual(103)
    expect(ny).toBeGreaterThanOrEqual(93)
    expect(ny).toBeLessThanOrEqual(95)
    // KMA's own reference point: Seoul City Hall → (60, 127).
    expect(kmaGrid(37.5665, 126.978)).toEqual({ nx: 60, ny: 127 })
  })
  it('기상청 발표 시각: 가장 최근 발표분(KST)', () => {
    // 2026-10-08 10:30 KST → 08:00 issue.
    expect(kmaBase(new Date('2026-10-08T01:30:00Z'))).toEqual({
      date: '20261008',
      time: '0800',
    })
    // 01:00 KST → previous day's 23:00 issue.
    expect(kmaBase(new Date('2026-10-07T16:00:00Z'))).toEqual({
      date: '20261007',
      time: '2300',
    })
  })
  it('역 이름은 "역" 유무와 관계없이 찾음', () => {
    const stations = [
      { id: 'A', name: '서울' },
      { id: 'B', name: '포항' },
    ]
    expect(findStation(stations, '서울역')?.id).toBe('A')
    expect(findStation(stations, '포항')?.id).toBe('B')
  })
})
