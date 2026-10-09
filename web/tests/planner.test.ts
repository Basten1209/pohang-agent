import { describe, expect, it } from 'vitest'
import { seedConfig } from '#/core/defaults'
import { planEveryCourse } from '#/core/planner'
import { planner } from '#/core/planner'
import type { Observations, Plan, TripConfig } from '#/core/schema'
import { planSchema } from '#/core/schema'
import { clock } from '#/core/time'
import { mapUrl } from '#/core/links'
import { interpret } from '#/core/intents'

const calculate = planner(seedConfig)
const plan: Plan = {
  ...seedConfig.defaults.plan,
  condition: 'TIRED',
  course: 'guryongpo',
}
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
    const r = calculate({ ...plan, departTime: '16:00' }, obs)
    expect(r.decision).toBe('SHORTEN')
    expect(clock(r.stationEta!)).toBe('15:15')
    expect(r.stops.map((x) => x.id)).toEqual(['food', 'street'])
    expect(r.slack).toBe(15)
    expect(r.walking).toBe(25)
  })
  it('D03: 혼잡만 82로 올리면 식사만 남고 교통 여유를 한 번 반영', () => {
    const r = calculate(
      { ...plan, departTime: '16:00' },
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
      { ...plan, departTime: '16:00', readyTime: '10:50' },
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
      calculate({ ...plan, departTime: '14:00' }, withReadings({ pm25: 60 }))
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
        currentPlace: 'COURSE',
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
        currentPlace: 'COURSE',
        currentTime: '13:05',
        completed: ['food'],
        departTime: '16:00',
      },
      withReadings({ congestion: 82 }),
    )
    expect(clock(r.stationEta!)).toBe('15:10')
    expect(clock(r.planningArrival!)).toBe('15:30')
  })
  it('입력 시각과 휴식 범위를 검증', () => {
    expect(planSchema.safeParse({ ...plan, departTime: '26:00' }).success).toBe(
      false,
    )
    expect(planSchema.safeParse({ ...plan, restMin: -1 }).success).toBe(false)
  })
  it('지도 링크에 이동수단과 양쪽 좌표를 구분해 전달', () => {
    const url = mapUrl(seedConfig, 'guryongpo')('STATION')
    expect(url).toContain('/link/by/traffic/')
    expect(url).toContain(',35.9868,129.5528/')
    expect(url).toContain(',36.0714,129.3418')
  })
})

describe('설정이 곧 정책 (jsonb 확장)', () => {
  it('정책 수치를 설정만으로 바꾸면 코드 변경 없이 결과가 바뀜', () => {
    const relaxed: TripConfig = {
      ...seedConfig,
      modes: seedConfig.modes.map((m) =>
        m.id === 'TRAIN' ? { ...m, bufferMin: 10 } : m,
      ),
    }
    const r = planner(relaxed)({ ...plan, departTime: '16:00' }, obs)
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
    // Only the indoor place is left out, for not being a chosen activity.
    expect(r.excluded.map((e) => e.id)).toEqual(['gp-museum'])
  })
})

describe('열차 시각 읽기', () => {
  it.each([
    ['18시 30분 기차예요', '18:30'],
    ['18시30분 열차', '18:30'],
    ['오후 6시 반 기차', '18:30'],
    ['18:05 기차로 바뀌었어', '18:05'],
    ['16시 기차로 바뀌었어요', '16:00'],
  ])('%s → %s', (text, time) => {
    const intent = interpret(text)
    expect(intent.kind).toBe('CHANGE')
    if (intent.kind === 'CHANGE') expect(intent.changes.departTime).toBe(time)
  })
})

describe('계단 있는 장소', () => {
  it('지쳤거나 15분만 걸으면 계단 오르는 과메기문화관은 빼고 이유를 남김', () => {
    const r = calculate(
      { ...plan, condition: 'TIRED', interests: ['food', 'indoor'] },
      obs,
    )
    expect(r.stops.map((s) => s.id)).toEqual(['food'])
    expect(r.excluded.find((e) => e.id === 'gp-museum')?.reason).toBe(
      '계단 있는 동선이라 제외',
    )
    const ok = calculate(
      { ...plan, condition: 'OK', interests: ['food', 'indoor'] },
      obs,
    )
    expect(ok.stops.map((s) => s.id)).toContain('gp-museum')
  })
})

describe('코스 다변화와 귀가 방식', () => {
  const auto: Plan = { ...plan, course: 'auto' }

  it('추천(auto)이고 구룡포가 가능하면 구룡포를 고름 (단축이어도)', () => {
    const r = calculate({ ...auto, departTime: '16:00' }, obs)
    expect(r.course).toBe('guryongpo')
    expect(r.decision).toBe('SHORTEN')
    // Other feasible courses are offered, never the chosen one.
    expect(r.alternatives.length).toBeGreaterThan(0)
    expect(r.alternatives).not.toContain('guryongpo')
    expect(r.alternatives.length).toBeLessThanOrEqual(3)
  })
  it('추천(auto)인데 구룡포가 귀가 시각 때문에 불가능하면 다른 코스와 이유', () => {
    const r = calculate({ ...auto, departTime: '14:00' }, obs)
    expect(r.course).not.toBe('guryongpo')
    expect(['GO', 'SHORTEN', 'INDOOR']).toContain(r.decision)
    expect(r.reasons[0]).toContain('구룡포는 지금 조건으로 다녀오기 어려워')
  })
  it('코스를 직접 고르면 그 코스, 다른 가능한 코스는 대안으로', () => {
    const r = calculate(
      { ...plan, course: 'homigot', interests: ['food', 'view'] },
      obs,
    )
    expect(r.course).toBe('homigot')
    expect(r.alternatives).not.toContain('homigot')
  })
  it('모든 활성 코스를 한 번에 비교', () => {
    const all = planEveryCourse(seedConfig, auto, obs)
    expect(all.map((i) => i.course)).toEqual([
      'guryongpo',
      'homigot',
      'yeongildae',
      'jukdo',
    ])
  })
  it('하고 싶은 일이 고른 장소를 정함', () => {
    const r = calculate(
      { ...plan, course: 'homigot', interests: ['view', 'indoor'] },
      obs,
    )
    expect(r.stops.map((s) => s.id)).toEqual(['hm-hand', 'hm-museum'])
    expect(r.excluded.find((e) => e.id === 'hm-food')?.reason).toBe(
      '고른 활동이 아님',
    )
  })
  it('버스로 가면 터미널과 20분 여유를 기준으로 계산', () => {
    const r = calculate(
      { ...plan, departMode: 'BUS', departTime: '17:00' },
      obs,
    )
    expect(r.hub).toBe('TERMINAL')
    expect(r.stationTarget).toBe(17 * 60 - 20)
  })
  it('포항 주민은 여유 없이 돌아올 시각까지 계산하고 문구도 바뀜', () => {
    const r = calculate(
      { ...plan, departMode: 'LOCAL', departTime: '17:00' },
      obs,
    )
    expect(r.stationTarget).toBe(17 * 60)
    expect(r.reasons.join(' ')).toContain('17:00까지')
  })
  it('귀가 거점으로 가는 경로가 없으면 추측하지 않음', () => {
    const noAirport: TripConfig = {
      ...seedConfig,
      courses: seedConfig.courses.map((c) =>
        c.id === 'guryongpo'
          ? {
              ...c,
              return: {
                ...c.return,
                minutes: { STATION: 120, TERMINAL: 110, PARKING: 110 },
              },
            }
          : c,
      ),
    }
    const r = planner(noAirport)({ ...plan, departMode: 'FLIGHT' }, obs)
    expect(r.decision).toBe('NEEDS_DATA')
    expect(r.stationEta).toBeNull()
  })
  it('관심 활동이 하나도 없는 코스는 이유를 말함', () => {
    const r = calculate(
      { ...plan, interests: ['indoor'], course: 'jukdo' },
      {
        ...obs,
      },
    )
    expect(r.stops.map((s) => s.id)).toEqual(['jd-canalhall'])
    const none = calculate(
      {
        ...plan,
        course: 'guryongpo',
        interests: ['view'],
      },
      obs,
    )
    expect(none.decision).toBe('CANCEL')
    expect(none.reasons.at(-1)).toContain('고른 활동에 맞는 장소가 없어요')
  })
})
