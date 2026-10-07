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
      { type: 'plan.patched', patch: { trainTime: '16:00' } },
    ])
    expect(s2.plan.revision).toBe(1)
  })
  it('관심 없는 장소는 하루 만들기에서 제외됨', () => {
    const s = {
      ...initialTrip(config),
      plan: { ...config.defaults.plan, interests: ['food', 'street'] },
    }
    const next = fold(s, createTrip(config, s))
    expect(next.plan.excluded).toEqual(['cafe'])
    expect(next.created).toBe(true)
    expect(next.screen).toBe('day')
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
    s = fold(s, advance(config, s, calc(s.plan, s.observations)))
    expect(s.plan).toMatchObject({
      stage: 'LOCAL',
      currentPlace: 'GURYONGPO',
      currentTime: '12:10',
    })
    s = fold(s, advance(config, s, calc(s.plan, s.observations)))
    expect(s.plan.completed).toEqual(['food'])
    s = fold(s, startReturn(s))
    expect(s.plan.stage).toBe('RETURN')
    s = fold(s, advance(config, s, calc(s.plan, s.observations)))
    expect(s.plan).toMatchObject({ stage: 'DONE', currentPlace: 'STATION' })
  })
  it('미리보기는 같은 revision에서만 적용됨 (늦은 응답 폐기)', () => {
    const s = fold(
      initialTrip(config),
      runScenario(config, initialTrip(config), 'base'),
    )
    const p = preview(config, s.plan, s.observations, {
      trainTime: '16:00',
      walkingLimit: null,
      extraRestMin: null,
      excludePlaces: null,
    })
    const moved = replay(s, [
      { type: 'plan.patched', patch: { walkingLimit: 15 } },
    ])
    expect(applyPreview(moved, p).events).toEqual([])
    expect(fold(s, applyPreview(s, p)).plan.trainTime).toBe('16:00')
  })
  it('D03: 혼잡 시나리오는 사용자 조건을 유지하고 관측만 바꿈', () => {
    let s = fold(
      initialTrip(config),
      runScenario(config, initialTrip(config), 'early'),
    )
    s = fold(s, runScenario(config, s, 'traffic'))
    expect(s.plan.trainTime).toBe('16:00')
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
      changes: { trainTime: '16:00' },
    })
  })
  it('여러 조건을 한 문장에서 추출', () => {
    expect(
      interpret('16시 기차로 바꿨어. 카페는 빼줘, 15분만 걸을래'),
    ).toMatchObject({
      kind: 'CHANGE',
      changes: {
        trainTime: '16:00',
        excludePlaces: ['cafe'],
        walkingLimit: 15,
      },
    })
  })
})
