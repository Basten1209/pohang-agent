import { describe, expect, it } from 'vitest'
import { initialTrip } from '#/core/trip'
import { seedConfig } from '#/core/defaults'
import { requestsVisitPhoto, visitPhotoOffer } from '#/core/visit-photo'

const state = () => {
  const s = initialTrip(seedConfig)
  s.created = true
  s.phase = 3
  s.plan.condition = 'OK'
  s.plan.stage = 'LOCAL'
  s.plan.completed = ['street', 'cafe']
  return s
}

describe('사진 요청과 장소 확인', () => {
  it('자연어 공유 요청만 열고 촬영 추천·거절과 혼동하지 않는다', () => {
    for (const text of [
      '여기서 찍은 사진 올릴래',
      '관광 사진 업로드할래요',
      '사진을 커뮤니티에 남기고 싶어',
      'Share this photo',
    ])
      expect(requestsVisitPhoto(text), text).toBe(true)
    for (const text of [
      '사진 찍기 좋은 곳 알려줘',
      '사진은 나중에 공유할래',
      '사진 공유 안 할래',
      '사진 공유하지 마',
      '사진을 올리지 않을래',
      '택시로 갈래',
    ])
      expect(requestsVisitPhoto(text), text).toBe(false)
  })
  it('명시한 방문 장소와 마지막 방문 기록을 연결하고 모호하면 선택하게 한다', () => {
    const s = state()
    expect(
      visitPhotoOffer(seedConfig, s, '가옥거리에서 찍은 사진 올릴래'),
    ).toMatchObject({ selectedId: 'street', placeIds: ['street', 'cafe'] })
    expect(visitPhotoOffer(seedConfig, s, '여기 사진 올릴래')).toMatchObject({
      selectedId: 'cafe',
    })
    expect(visitPhotoOffer(seedConfig, s, '사진 공유할래')).toMatchObject({
      selectedId: null,
    })
    expect(
      visitPhotoOffer(seedConfig, s, '모르는 장소에서 찍은 사진 올릴래'),
    ).toMatchObject({ selectedId: null })
  })
  it('예정 장소·비활성 지역·미완주를 방문으로 바꾸지 않는다', () => {
    const s = state()
    const before = structuredClone(s)
    expect(
      visitPhotoOffer(seedConfig, s, '과메기문화관 사진 올릴래'),
    ).toMatchObject({ placeIds: [], selectedId: null })
    expect(
      visitPhotoOffer(seedConfig, { ...s, phase: 2 }, '사진 공유'),
    ).toMatchObject({ placeIds: [] })
    const config = {
      ...seedConfig,
      courses: seedConfig.courses.map((c) => ({ ...c, active: false })),
    }
    expect(visitPhotoOffer(config, s, '사진 공유')).toMatchObject({
      placeIds: [],
    })
    expect(s).toEqual(before)
  })
  it('귀가 후에도 직접 요청으로 공유하지만 안전 단계에서는 카드를 열지 않는다', () => {
    const s = state()
    s.plan.stage = 'DONE'
    expect(visitPhotoOffer(seedConfig, s, '사진 공유').placeIds).toEqual([
      'street',
      'cafe',
    ])
    s.plan.condition = 'UNWELL'
    expect(visitPhotoOffer(seedConfig, s, '사진 공유').placeIds).toEqual([])
  })
})
