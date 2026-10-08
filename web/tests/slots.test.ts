import { describe, expect, it } from 'vitest'
import { seedConfig } from '#/core/defaults'
import { deepMerge } from '#/core/fp'
import { configSchema } from '#/core/schema'
import {
  detailsFromText,
  fillSlots,
  pendingSlot,
  promptFor,
} from '#/core/slots'
import { initialTrip, replay } from '#/core/trip'

const fresh = () => initialTrip(seedConfig)

describe('질문 순서와 답 버튼 (설정 데이터)', () => {
  it('열차 → 하고 싶은 일 → 출발 장소 순서로 묻고, 다 답하면 여정 생성', () => {
    let s = fresh()
    const asked: string[] = []
    for (const [slot, value] of [
      ['trainTime', '16:00'],
      ['interests', ['food']],
      ['origin', 'RACE'],
    ] as const) {
      asked.push(pendingSlot(seedConfig, s)!)
      s = replay(s, fillSlots(seedConfig, s, { [slot]: value }))
    }
    expect(asked).toEqual(['trainTime', 'interests', 'origin'])
    expect(s.created).toBe(true)
    expect(pendingSlot(seedConfig, s)).toBeNull()
  })

  it('하고 싶은 일 버튼은 장소 설정에서 만들어짐', () => {
    const s = replay(
      fresh(),
      fillSlots(seedConfig, fresh(), { trainTime: '18:30' }),
    )
    expect(promptFor(seedConfig, s)?.choices.map((c) => c.value)).toEqual([
      'food',
      'street',
      'cafe',
    ])
  })

  it('질문 순서와 문구는 설정만 바꿔도 달라짐', () => {
    const config = configSchema.parse(
      deepMerge(seedConfig, {
        conversation: { onboarding: ['origin', 'trainTime'] },
      }),
    )
    expect(pendingSlot(config, initialTrip(config))).toBe('origin')
  })

  it('컨디션을 답하면 완주 단계로 넘어감', () => {
    const s = fresh()
    const events = fillSlots(seedConfig, s, { condition: 'OK' })
    expect(events.map((e) => e.type)).toEqual(['slots.filled', 'day.advanced'])
  })
})

describe('문장에서 여정 정보 읽기 (규칙 해석기)', () => {
  const read = (text: string, stage = 'ONBOARDING') =>
    detailsFromText(text, { stage, readyTime: '10:40' })

  it.each([
    ['18시 30분 기차예요', { trainTime: '18:30' }],
    ['오후 4시 기차', { trainTime: '16:00' }],
    ['점심이랑 카페 가고 싶어요', { interests: ['food', 'cafe'] }],
    ['다 좋아요', { interests: ['food', 'street', 'cafe'] }],
    ['관광 없이 바로 서울 갈래요', { interests: [] }],
    ['숙소에서 짐 찾고 갈게요', { origin: 'HOTEL' }],
  ])('%s', (text, expected) => {
    expect(read(text)).toMatchObject(expected)
  })

  it('오전/오후 없는 "4시"는 열차로 저장하지 않음', () => {
    expect(read('4시 기차예요').trainTime).toBeNull()
  })

  it('완주 후에는 시각을 출발 준비 시각으로 읽음', () => {
    expect(read('30분 쉬고 갈게요', 'CHECK_IN').readyTime).toBe('11:10')
    expect(read('11시 30분에 출발할게요', 'CHECK_IN')).toMatchObject({
      readyTime: '11:30',
      trainTime: null,
    })
    expect(read('조금 지쳤어요', 'CHECK_IN').condition).toBe('TIRED')
  })
})
