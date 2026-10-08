import { describe, expect, it } from 'vitest'
import { seedConfig } from '#/core/defaults'
import { interpret } from '#/core/intents'
import { planner } from '#/core/planner'
import { preview } from '#/core/preview'
import {
  accept,
  advance,
  applyPreview,
  createTrip,
  initialTrip,
  navigate,
  replay,
  runScenario,
  startReturn,
} from '#/core/trip'
import type { TripState } from '#/core/trip'

const config = seedConfig
const calc = planner(config)
const fold = (
  s: TripState,
  ...cmds: { events: Parameters<typeof replay>[1] }[]
) => cmds.reduce((acc, c) => replay(acc, c.events), s)

describe('이벤트 소싱', () => {
  it('계획 변경만 revision을 올리고 화면 이동은 올리지 않음', () => {
    const s0 = initialTrip(config)
    const s1 = replay(s0, [{ type: 'screen.changed', screen: 'day' }])
    expect(s1.plan.revision).toBe(0)
    const s2 = replay(s1, [
      { type: 'plan.patched', patch: { departTime: '16:00' } },
    ])
    expect(s2.plan.revision).toBe(1)
  })
  it('하루 만들기는 관심 활동을 그대로 두고 여정을 만듦', () => {
    const s: TripState = {
      ...initialTrip(config),
      plan: { ...config.defaults.plan, interests: ['food', 'walk'] },
    }
    const next = fold(s, createTrip(config, s))
    expect(next.plan.excluded).toEqual([])
    expect(next.created).toBe(true)
    expect(next.screen).toBe('day')
    // Interests decide the stops: no cafe in the plan.
    const it = calc(
      { ...next.plan, condition: 'OK', course: 'guryongpo' },
      next.observations,
    )
    expect(it.stops.map((x) => x.id)).toEqual(['food', 'street'])
  })
  it('대회 시작 뒤 도착이면 하루를 만들지 않음', () => {
    const s: TripState = {
      ...initialTrip(config),
      plan: {
        ...config.defaults.plan,
        arrivalAt: `${config.event.date}T09:00`,
      },
    }
    expect(createTrip(config, s).events).toEqual([])
  })
  it('하루를 만들기 전에는 다른 화면으로 가지 않음', () => {
    const cmd = navigate(initialTrip(config), 'course')
    expect(cmd.events).toEqual([])
    expect(cmd.notice).toBeTruthy()
  })
  it('도착·완료·복귀를 순서대로 확인하며 역 도착까지 진행', () => {
    let s = fold(
      initialTrip(config),
      runScenario(config, initialTrip(config), 'base'),
    )
    s = fold(s, accept(s, calc(s.plan, s.observations)))
    expect(s.plan.stage).toBe('OUTBOUND')
    s = fold(s, advance(s, calc(s.plan, s.observations)))
    expect(s.plan).toMatchObject({
      stage: 'LOCAL',
      currentPlace: 'COURSE',
      currentTime: '12:10',
    })
    s = fold(s, advance(s, calc(s.plan, s.observations)))
    expect(s.plan.completed).toEqual(['food'])
    s = fold(s, startReturn(s, calc(s.plan, s.observations)))
    expect(s.plan.stage).toBe('RETURN')
    s = fold(s, advance(s, calc(s.plan, s.observations)))
    expect(s.plan).toMatchObject({ stage: 'DONE', currentPlace: 'STATION' })
  })
  it('미리보기는 같은 revision에서만 적용됨 (늦은 응답 폐기)', () => {
    const s = fold(
      initialTrip(config),
      runScenario(config, initialTrip(config), 'base'),
    )
    const p = preview(config, s.plan, s.observations, {
      departTime: '16:00',
      course: null,
      walkingLimit: null,
      extraRestMin: null,
      excludePlaces: null,
      dropInterests: null,
    })
    const moved = replay(s, [
      { type: 'plan.patched', patch: { walkingLimit: 15 } },
    ])
    expect(applyPreview(moved, p).events).toEqual([])
    expect(fold(s, applyPreview(s, p)).plan.departTime).toBe('16:00')
  })
  it('D03: 혼잡 시나리오는 사용자 조건을 유지하고 관측만 바꿈', () => {
    let s = fold(
      initialTrip(config),
      runScenario(config, initialTrip(config), 'early'),
    )
    s = fold(s, runScenario(config, s, 'traffic'))
    expect(s.plan.departTime).toBe('16:00')
    expect(s.observations.readings.congestion).toBe(82)
    expect(calc(s.plan, s.observations).stops.map((x) => x.id)).toEqual([
      'food',
    ])
  })
})

describe('결정적 의도 해석', () => {
  it('설명 질문과 모호한 시각은 변경으로 해석하지 않음', () => {
    expect(interpret('왜 카페가 빠졌어?').kind).toBe('CONTEXT')
    expect(interpret('4시 기차로 바꿨어').kind).toBe('CLARIFY')
    expect(interpret('25시로 변경').kind).toBe('CLARIFY')
    expect(interpret('오후 4시 기차로 바꿨어')).toMatchObject({
      kind: 'CHANGE',
      changes: { departTime: '16:00' },
    })
  })
  it('여러 조건을 한 문장에서 추출', () => {
    expect(
      interpret('16시 기차로 바꿨어. 카페는 빼줘, 15분만 걸을래'),
    ).toMatchObject({
      kind: 'CHANGE',
      changes: {
        departTime: '16:00',
        dropInterests: ['cafe'],
        walkingLimit: 15,
      },
    })
  })
  it('코스 바꾸기와 추천 요청', () => {
    const courses = config.courses.map((c) => ({ id: c.id, area: c.area }))
    expect(interpret('호미곶으로 바꿔줘', courses)).toMatchObject({
      kind: 'CHANGE',
      changes: { course: 'homigot' },
    })
    expect(interpret('다른 데 추천해서 바꿔줘', courses)).toMatchObject({
      kind: 'CHANGE',
      changes: { course: 'auto' },
    })
  })
})

describe('추천 코스로 출발하면 코스가 고정됨', () => {
  it('auto 코스는 출발할 때 계산된 코스로 바뀜', () => {
    const s: TripState = {
      ...initialTrip(config),
      created: true,
      plan: { ...config.defaults.plan, condition: 'OK', course: 'auto' },
    }
    const it = calc(s.plan, s.observations)
    const next = fold(s, accept(s, it))
    expect(next.plan.course).toBe(it.course)
    expect(next.plan.course).not.toBe('auto')
  })
})
