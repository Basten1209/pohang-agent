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
  it('귀가 방법 → 시각 → 코스 → 하고 싶은 일 → 출발 장소 순서로 묻고, 다 답하면 여정 생성', () => {
    let s = fresh()
    const asked: string[] = []
    for (const [slot, value] of [
      ['departMode', 'BUS'],
      ['departTime', '17:00'],
      ['course', 'homigot'],
      ['interests', ['food']],
      ['origin', 'RACE'],
    ] as const) {
      asked.push(pendingSlot(seedConfig, s)!)
      s = replay(s, fillSlots(seedConfig, s, { [slot]: value }))
    }
    expect(asked).toEqual([
      'departMode',
      'departTime',
      'course',
      'interests',
      'origin',
    ])
    expect(s.created).toBe(true)
    expect(s.plan).toMatchObject({
      departMode: 'BUS',
      departTime: '17:00',
      course: 'homigot',
    })
    expect(pendingSlot(seedConfig, s)).toBeNull()
  })

  it('첫 질문은 서울행 열차가 아니라 귀가 방법이고, 버튼은 설정의 방법들', () => {
    const p = promptFor(seedConfig, fresh())!
    expect(p.question).not.toContain('서울')
    expect(p.choices.map((c) => c.value)).toEqual([
      'TRAIN',
      'BUS',
      'FLIGHT',
      'CAR',
      'LOCAL',
    ])
  })

  it('시각 질문과 버튼은 고른 귀가 방법에 맞춰짐', () => {
    const local = replay(
      fresh(),
      fillSlots(seedConfig, fresh(), { departMode: 'LOCAL' }),
    )
    const p = promptFor(seedConfig, local)!
    expect(p.question).toBe('몇 시까지 돌아오면 돼요?')
    expect(p.choices.at(-1)?.reply).toContain('까지 돌아오는 걸로')
    const flight = replay(
      fresh(),
      fillSlots(seedConfig, fresh(), { departMode: 'FLIGHT' }),
    )
    expect(promptFor(seedConfig, flight)!.choices[0].say).toContain('비행기')
  })

  it('코스 버튼은 코스 설정에서, 하고 싶은 일 버튼은 활동 설정에서 만들어짐', () => {
    let s = replay(
      fresh(),
      fillSlots(seedConfig, fresh(), {
        departMode: 'TRAIN',
        departTime: '18:30',
      }),
    )
    expect(promptFor(seedConfig, s)?.choices.map((c) => c.value)).toEqual([
      'guryongpo',
      'homigot',
      'auto',
    ])
    s = replay(s, fillSlots(seedConfig, s, { course: 'auto' }))
    expect(promptFor(seedConfig, s)?.choices.map((c) => c.value)).toEqual([
      'food',
      'walk',
      'view',
      'indoor',
      'cafe',
    ])
  })

  it('질문 순서와 문구는 설정만 바꿔도 달라짐', () => {
    const config = configSchema.parse(
      deepMerge(seedConfig, {
        conversation: { onboarding: ['origin', 'departTime'] },
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
  const courses = seedConfig.courses.map((c) => ({
    id: c.id,
    area: c.area,
    title: c.title,
  }))
  const read = (text: string, stage = 'ONBOARDING') =>
    detailsFromText(text, { stage, readyTime: '10:40', courses })

  it('코스 이름과 추천 요청을 읽음', () => {
    expect(read('호미곶 가 보고 싶어요').course).toBe('homigot')
    expect(read('스페이스워크 있는 영일대요').course).toBe('yeongildae')
    expect(read('알아서 추천해 줘요').course).toBe('auto')
  })

  it.each([
    ['18시 30분 기차예요', { departTime: '18:30' }],
    ['오후 4시 기차', { departTime: '16:00' }],
    ['점심이랑 카페 가고 싶어요', { interests: ['food', 'cafe'] }],
    ['다 좋아요', { interests: ['food', 'walk', 'view', 'indoor', 'cafe'] }],
    ['KTX 타고 서울 가요', { departMode: 'TRAIN' }],
    ['고속버스 타요', { departMode: 'BUS' }],
    ['김포 가는 비행기예요', { departMode: 'FLIGHT' }],
    ['차 가지고 왔어요', { departMode: 'CAR' }],
    ['저 포항 살아요', { departMode: 'LOCAL' }],
    ['열차로 가요', { departMode: 'TRAIN' }],
    ['관광 없이 바로 서울 갈래요', { interests: [] }],
    ['숙소에서 짐 찾고 갈게요', { origin: 'HOTEL' }],
  ])('%s', (text, expected) => {
    expect(read(text)).toMatchObject(expected)
  })

  it('오전/오후 없는 "4시"는 열차로 저장하지 않음', () => {
    expect(read('4시 기차예요').departTime).toBeNull()
  })

  it('완주 후에는 시각을 출발 준비 시각으로 읽음', () => {
    expect(read('30분 쉬고 갈게요', 'CHECK_IN').readyTime).toBe('11:10')
    expect(read('11시 30분에 출발할게요', 'CHECK_IN')).toMatchObject({
      readyTime: '11:30',
      departTime: null,
    })
    expect(read('조금 지쳤어요', 'CHECK_IN').condition).toBe('TIRED')
  })
})
