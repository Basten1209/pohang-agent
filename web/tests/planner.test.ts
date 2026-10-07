import { describe, expect, it } from 'vitest'
import { seedConfig } from '#/core/defaults'
import { deepMerge } from '#/core/fp'
import { planner } from '#/core/planner'
import type { Observations, Plan, TripConfig } from '#/core/schema'
import { planSchema } from '#/core/schema'
import { clock } from '#/core/time'
import { mapUrl } from '#/core/links'

const calculate = planner(seedConfig)
const plan: Plan = { ...seedConfig.defaults.plan, condition: 'TIRED' }
const obs = seedConfig.defaults.observations
const withReadings = (readings: Observations['readings']): Observations => ({
  ...obs,
  readings: { ...obs.readings, ...readings },
})

describe('명세 D01–D08', () => {
  it('D01: 18:30 열차, 16:20 도착, 100분 여유', () => {
    const r = calculate(plan, obs)
    expect(r.decision).toBe('GO')
    expect(clock(r.stationEta!)).toBe('16:20')
    expect(r.slack).toBe(100)
    expect(r.localMin).toBe(130)
    expect(r.stops).toHaveLength(3)
  })
  it('D02: 16시 열차이면 카페 제외, 구경 5분, 역 15:15', () => {
    const r = calculate({ ...plan, trainTime: '16:00' }, obs)
    expect(r.decision).toBe('SHORTEN')
    expect(clock(r.stationEta!)).toBe('15:15')
    expect(r.stops.map((x) => x.id)).toEqual(['food', 'street'])
    expect(r.slack).toBe(15)
    expect(r.walking).toBe(25)
  })
  it('D03: 혼잡만 82로 올리면 식사만 남고 교통 여유를 한 번 반영', () => {
    const r = calculate(
      { ...plan, trainTime: '16:00' },
      withReadings({ congestion: 82 }),
    )
    expect(r.stops.map((x) => x.id)).toEqual(['food'])
    expect(clock(r.stationEta!)).toBe('15:10')
    expect(clock(r.planningArrival!)).toBe('15:30')
    expect(r.slack).toBe(0)
  })
  it('D04: pm25 60이면 야외 20분 제외, 16:00 역 도착', () => {
    const r = calculate(plan, withReadings({ pm25: 60 }))
    expect(r.decision).toBe('INDOOR')
    expect(clock(r.stationEta!)).toBe('16:00')
    expect(r.localMin).toBe(110)
  })
  it('D05: 준비 완료가 10분 늦어지면 최소 코스도 불가', () => {
    const r = calculate(
      { ...plan, trainTime: '16:00', readyTime: '10:50' },
      withReadings({ congestion: 82 }),
    )
    expect(r.decision).toBe('CANCEL')
    expect(r.stationEta).toBeNull()
  })
  it('D06: 몸이 안 좋으면 관광 계산을 중단', () => {
    const r = calculate({ ...plan, condition: 'UNWELL' }, obs)
    expect(r.decision).toBe('MEDICAL_FIRST')
    expect(r.calculationStatus).toBe('NOT_RUN')
  })
  it('D07: 복귀 경로 누락 또는 시간대 이탈 시 임의 ETA 없음', () => {
    expect(calculate(plan, { ...obs, routeAvailable: false }).decision).toBe(
      'NEEDS_DATA',
    )
    expect(
      calculate({ ...plan, readyTime: '14:00' }, obs).stationEta,
    ).toBeNull()
  })
})

describe('예외와 상태 변화', () => {
  it('대기 제한보다 귀가 불가능이 우선', () =>
    expect(
      calculate({ ...plan, trainTime: '14:00' }, withReadings({ pm25: 60 }))
        .decision,
    ).toBe('CANCEL'))
  it('STALE과 null을 정상 관측으로 취급하지 않음', () => {
    for (const o of [
      { ...obs, freshness: 'STALE' as const },
      withReadings({ pm25: null, congestion: null }),
      { ...obs, readings: {} },
    ]) {
      const r = calculate(plan, o)
      expect(r.calculationStatus).toBe('PARTIAL')
      expect(r.stops.some((x) => x.id === 'street')).toBe(false)
      expect(r.trafficReserve).toBe(20)
    }
  })
  it('걷기 상한에 정류장 도보가 포함됨', () =>
    expect(calculate({ ...plan, walkingLimit: 15 }, obs).decision).toBe(
      'CANCEL',
    ))
  it('완료한 식사와 이미 지난 시간을 다시 더하지 않음', () => {
    const r = calculate(
      {
        ...plan,
        stage: 'LOCAL',
        currentPlace: 'GURYONGPO',
        currentTime: '13:15',
        completed: ['food'],
      },
      obs,
    )
    expect(r.outbound).toBe(0)
    expect(r.stops.some((x) => x.id === 'food')).toBe(false)
    expect(r.stationEta).toBeLessThanOrEqual(980)
  })
  it('더 쉬면 남은 코스와 역 도착이 재계산됨', () => {
    const normal = calculate(plan, obs)
    const rest = calculate({ ...plan, restMin: 30 }, obs)
    expect(rest.stationEta! - normal.stationEta!).toBe(30)
  })
  it('역 복귀에도 정류장 접근을 한 번 포함', () => {
    const r = calculate(
      {
        ...plan,
        stage: 'RETURN',
        currentPlace: 'GURYONGPO',
        currentTime: '13:05',
        completed: ['food'],
        trainTime: '16:00',
      },
      withReadings({ congestion: 82 }),
    )
    expect(clock(r.stationEta!)).toBe('15:10')
    expect(clock(r.planningArrival!)).toBe('15:30')
  })
  it('입력 시각과 휴식 범위를 검증', () => {
    expect(planSchema.safeParse({ ...plan, trainTime: '26:00' }).success).toBe(
      false,
    )
    expect(planSchema.safeParse({ ...plan, restMin: -1 }).success).toBe(false)
  })
  it('지도 링크에 이동수단과 양쪽 좌표를 구분해 전달', () => {
    const url = mapUrl(seedConfig)('STATION')
    expect(url).toContain('/link/by/traffic/')
    expect(url).toContain(',35.9868,129.5528/')
    expect(url).toContain(',36.0714,129.3418')
  })
})

describe('설정이 곧 정책 (jsonb 확장)', () => {
  it('정책 수치를 설정만으로 바꾸면 코드 변경 없이 결과가 바뀜', () => {
    const relaxed = deepMerge(seedConfig, {
      policy: { stationBufferMin: 10 },
    }) as TripConfig
    const r = planner(relaxed)({ ...plan, trainTime: '16:00' }, obs)
    expect(r.stationTarget).toBe(950)
    expect(r.decision).toBe('SHORTEN')
    expect(r.slack).toBe(35)
  })
  it('새 관측 신호(자외선)를 설정에 추가하면 야외 장소가 빠짐', () => {
    const withUv: TripConfig = {
      ...seedConfig,
      policy: {
        ...seedConfig.policy,
        signals: [
          ...seedConfig.policy.signals,
          {
            kind: 'outdoor-limit',
            reading: 'uvIndex',
            label: '자외선',
            limit: 8,
          },
        ],
      },
    }
    const r = planner(withUv)(plan, withReadings({ uvIndex: 9 }))
    expect(r.decision).toBe('INDOOR')
    expect(r.stops.some((s) => s.id === 'street')).toBe(false)
  })
  it('비활성 장소는 코스와 제외 목록 모두에서 빠짐', () => {
    const noCafe: TripConfig = {
      ...seedConfig,
      places: seedConfig.places.map((p) =>
        p.id === 'cafe' ? { ...p, active: false } : p,
      ),
    }
    const r = planner(noCafe)(plan, obs)
    expect(r.stops.map((s) => s.id)).toEqual(['food', 'street'])
    expect(r.excluded).toEqual([])
  })
})
