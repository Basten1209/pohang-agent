import { describe, expect, it } from 'vitest'
import { seedConfig } from '#/core/defaults'
import type { Evidence } from '#/core/evidence'
import { liveObservationEvents, readingLine } from '#/core/live'
import { planner } from '#/core/planner'
import type { Plan } from '#/core/schema'
import { initialTrip, replay, runScenario } from '#/core/trip'

const config = seedConfig
const plan: Plan = {
  ...config.defaults.plan,
  condition: 'OK',
  course: 'guryongpo',
}

const congestion = (over: Partial<Evidence> = {}): Evidence => ({
  sourceId: 'INT_S07_005',
  label: 'E-UM 시간대별 교통 혼잡율',
  reading: 'congestion',
  status: 'LIVE',
  observedAt: '2026-10-25T05:00:00.000Z',
  fetchedAt: '2026-10-25T05:10:00.000Z',
  freshness: 'FRESH',
  value: 82,
  unit: '%',
  values: {},
  message: '',
  ...over,
})
const pm25 = (value: number): Evidence => ({
  ...congestion(),
  sourceId: 'INT_S01_004',
  reading: 'pm25',
  value,
})

const fold = (evidence: Evidence[], s = initialTrip(config)) =>
  replay(s, liveObservationEvents(config, s.observations, evidence))

describe('E-UM 실측을 판단에 연결', () => {
  it('LIVE·FRESH 교통 혼잡은 판단 관측이 되고 교통 여유가 바뀜', () => {
    const before = planner(config)(plan, config.defaults.observations)
    const s = fold([congestion()])
    expect(s.observations.readings.congestion).toBe(82)
    expect(s.observations.sources.congestion).toMatchObject({
      provenance: 'LIVE',
      sourceId: 'INT_S07_005',
      observedAt: '2026-10-25T05:00:00.000Z',
    })
    const after = planner(config)(plan, s.observations)
    expect(before.trafficReserve).toBe(0)
    expect(after.trafficReserve).toBe(20)
    expect(readingLine(s.observations, 'congestion', '교통 혼잡', '%')).toBe(
      '교통 혼잡 82% (14:00 관측 · LIVE)',
    )
  })

  it('STALE·ERROR 응답은 반영하지 않음', () => {
    for (const e of [
      congestion({ freshness: 'STALE' }),
      congestion({ freshness: 'UNKNOWN' }),
      congestion({ status: 'ERROR', value: null }),
      congestion({ status: 'SNAPSHOT' }),
    ])
      expect(
        liveObservationEvents(config, config.defaults.observations, [e]),
      ).toEqual([])
  })

  it('반영했던 실측을 다시 확인하지 못하면 시연값으로 돌리고 그렇게 표시', () => {
    const live = fold([congestion()])
    const lost = fold([congestion({ status: 'ERROR', value: null })], live)
    expect(lost.observations.readings.congestion).toBe(42)
    expect(lost.observations.sources.congestion).toMatchObject({
      provenance: 'SIMULATED',
      note: '최신 관측 확인 불가',
    })
    expect(
      readingLine(lost.observations, 'congestion', '교통 혼잡', '%'),
    ).toContain('최신 관측 확인 불가')
  })

  it('대기(pm25)는 단위 확인 전이라 판단에 반영하지 않음', () => {
    const s = fold([pm25(90)])
    expect(s.observations.readings.pm25).toBe(10)
    expect(s.observations.sources.pm25).toBeUndefined()
  })

  it('같은 관측을 다시 받으면 이벤트를 만들지 않음', () => {
    const s = fold([congestion()])
    expect(
      liveObservationEvents(config, s.observations, [congestion()]),
    ).toEqual([])
  })

  it('시연 시나리오는 DEMO로 표시되고 실측이 덮어쓰지 않음', () => {
    const s0 = initialTrip(config)
    const demo = replay(s0, runScenario(config, s0, 'traffic').events)
    expect(demo.observations.sources.congestion?.provenance).toBe('DEMO')
    const after = fold([congestion({ value: 30 })], demo)
    expect(after.observations.readings.congestion).toBe(82)
    expect(
      readingLine(after.observations, 'congestion', '교통 혼잡', '%'),
    ).toBe('교통 혼잡 82% (시연 조건)')
  })
})
