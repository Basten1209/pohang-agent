import { describe, expect, it } from 'vitest'
import { seedConfig } from '#/core/defaults'
import { hourlyAirBody, interpretBody } from '#/core/evidence'
import { planner } from '#/core/planner'
import { recommendTransport } from '#/core/transport'
import { initialTrip, replay, advance } from '#/core/trip'
import { mergeForecastHours } from '#/core/weather'
import { withEnv } from '#/server/config'
import { kmaBase } from '#/server/sources/datagokr'
import type { Observations, Plan } from '#/core/schema'

const plan: Plan = {
  ...seedConfig.defaults.plan,
  condition: 'OK',
  course: 'guryongpo',
}
const obs = (traffic: number | null, pm25 = 10, uvIndex = 2): Observations => ({
  ...seedConfig.defaults.observations,
  sources: {},
  readings: { congestion: traffic, pm25, uvIndex },
})
const calculate = planner(seedConfig)

describe('발표일과 실시간 관측의 분리', () => {
  it('오전 대회와 17시 발표가 같은 날이며 도착 기본값은 전날', () => {
    expect(seedConfig.event.date).toBe('2026-10-13')
    expect(seedConfig.event.dateLabel).toContain('화')
    expect(seedConfig.event.gun).toBe('08:30')
    expect(seedConfig.event.meta.presentationAt).toBe(
      '2026-10-13T17:00:00+09:00',
    )
    expect(seedConfig.defaults.plan.arrivalAt).toBe('2026-10-12T17:00')
    expect(seedConfig.defaults.observations.readings).toEqual({
      congestion: null,
      pm25: null,
      uvIndex: null,
    })
  })
  it('KST 자정에도 예보 발표시각은 전날 23시', () => {
    expect(kmaBase(new Date('2026-10-12T15:01:00Z'))).toEqual({
      date: '20261012',
      time: '2300',
    })
  })
})

describe('구간별 여유와 시간 보존', () => {
  it.each([
    [49.9, 0],
    [50, 5],
    [74.9, 5],
    [75, 10],
    [100, 10],
    [null, 10],
  ])('혼잡 %s의 도로 구간당 여유는 %s분', (value, reserve) => {
    const it = calculate(plan, obs(value))
    const roads = it.legs.filter((l) => l.kind !== 'WALK')
    expect(roads).toHaveLength(2)
    expect(roads.every((l) => l.bufferMin === reserve)).toBe(true)
    expect(it.trafficReserve).toBe(Number(reserve) * 2)
    expect(it.planningArrival).toBe(it.legs.at(-1)?.end)
    expect(it.stationTarget - it.planningArrival!).toBe(it.slack)
    expect(it.stops[0].start).toBe(
      it.legs.find((l) => l.to === it.stops[0].id)!.end,
    )
    expect(
      it.legs.filter((l) => l.kind === 'WALK').every((l) => l.bufferMin === 0),
    ).toBe(true)
  })
  it('다른 권역에는 구룡포 관측을 적용하지 않는다', () => {
    // A separate configuration keeps the generic planner's area boundary covered.
    const calculate = planner({
      ...seedConfig,
      courses: seedConfig.courses.map((c) => ({ ...c, active: true })),
    })
    for (const course of ['yeongildae', 'jukdo']) {
      const quiet = calculate({ ...plan, course }, obs(0))
      const bad = calculate({ ...plan, course }, obs(100, 90, 10))
      expect(bad.planningArrival).toBe(quiet.planningArrival)
      expect(bad.trafficReserve).toBe(0)
      expect(bad.stops).toEqual(quiet.stops)
    }
  })
  it('호미곶은 구룡포 환승이 명시된 출발 구간만 여유를 준다', () => {
    const result = calculate(
      { ...plan, course: 'homigot', interests: ['food', 'view', 'cafe'] },
      obs(102.71, 90, 10),
    )
    expect(result.legs.find((l) => l.kind === 'OUTBOUND')?.bufferMin).toBe(10)
    expect(result.legs.find((l) => l.kind === 'RETURN')?.bufferMin).toBe(0)
    expect(result.stops.some((s) => s.id === 'hm-hand')).toBe(true)
  })
  it('100%를 초과하는 실제 혼잡율도 최근 관측으로 해석한다', () => {
    const source = seedConfig.sources.find((s) => s.id === 'INT_S07_005')!
    const at = '2026-10-11T08:30:00Z'
    const e = interpretBody(
      source,
      { data: [{ hour: '2026-10-11 17:00:00.0', cntPerc: 102.71 }] },
      at,
      Date.parse(at),
    )
    expect(e.value).toBe(102.71)
    expect(e.freshness).toBe('FRESH')
  })
  it('복귀 중에는 이미 소비한 출발 구간 여유를 다시 붙이지 않는다', () => {
    const it = calculate(
      {
        ...plan,
        stage: 'RETURN',
        currentPlace: 'COURSE',
        currentTime: '14:00',
      },
      obs(82),
    )
    expect(it.trafficReserve).toBe(10)
    expect(it.legs).toHaveLength(1)
    expect(it.planningArrival).toBe(14 * 60 + 70 + 20 + 5 + 10)
  })
  it('구간 도착 보고도 여유가 반영된 동일 시각으로 진행한다', () => {
    const state = {
      ...initialTrip(seedConfig),
      plan: { ...plan, stage: 'OUTBOUND' as const },
      observations: obs(82),
    }
    const it = calculate(state.plan, state.observations)
    const next = replay(state, advance(state, it).events)
    expect(next.plan.currentTime).toBe('12:10')
  })
})

describe('교통수단은 실제 일정과 일치하는 시연 추천', () => {
  it('피로·보행 제한·귀가 여유를 반영하며 혼잡을 택시 우위로 설명하지 않음', () => {
    const it = calculate(plan, obs(82))
    expect(recommendTransport(plan, obs(82), it).mode).toBe('TRANSIT')
    for (const p of [
      { ...plan, condition: 'TIRED' as const },
      { ...plan, walkingLimit: 15 },
    ]) {
      expect(recommendTransport(p, obs(82), calculate(p, obs(82))).mode).toBe(
        'TAXI',
      )
    }
    expect(recommendTransport(plan, obs(82), { ...it, slack: 19 }).urgent).toBe(
      true,
    )
    expect(recommendTransport(plan, obs(82), { ...it, slack: 20 }).urgent).toBe(
      false,
    )
    expect(recommendTransport(plan, obs(82), it).reasons.join()).toContain(
      '버스와 택시 모두',
    )
  })
  it('택시 선택은 별도 시연 시간표로 바뀌고 실제 ETA·요금은 주장하지 않는다', () => {
    const before = calculate(plan, obs(82))
    const taxi = calculate({ ...plan, localTransport: 'TAXI' }, obs(82))
    expect(taxi.planningArrival!).toBeLessThan(before.planningArrival!)
    expect(
      taxi.legs
        .filter((l) => l.mode !== 'WALK')
        .every((l) => l.mode === 'TAXI'),
    ).toBe(true)
    expect(recommendTransport(plan, obs(82), taxi).taxiMinutes).toBeNull()
    expect(recommendTransport(plan, obs(82), taxi).taxiFare).toBeNull()
  })
})

describe('대기·자외선의 검증 경계', () => {
  it('검증 플래그만으로 임의의 장비를 추천에 반영할 수 없다', () => {
    const enabled = (id: string, verified: string) =>
      withEnv(seedConfig, {
        EUM_AIR_DEVICE_ID: id,
        EUM_AIR_VERIFIED: verified,
      }).sources.find((s) => s.id === 'INT_S01_012')!.decision
    expect(enabled('1', 'true')).toBe(false)
    expect(enabled('8', 'false')).toBe(false)
    expect(enabled('8', 'true')).toBe(true)
  })
  const source = seedConfig.sources.find((s) => s.id === 'INT_S01_012')!
  const now = Date.parse('2026-10-13T05:30:00Z')
  const body = {
    data: [
      { hours: 14, devId: 2, type: 'PM25', value: 150, unit: '㎍/㎥' },
      { hours: 13, devId: 1, type: 'PM25', value: 36, unit: '㎍/㎥' },
      { hours: 23, devId: 1, type: 'PM25', value: 0, unit: '㎍/㎥' },
      { hours: 14, devId: 1, type: 'PM10', value: 170, unit: '㎍/㎥' },
    ],
  }
  it('요청 날짜와 지정 장비만 사용하고 pm10을 pm25로 오인하지 않는다', () => {
    const e = interpretBody(
      source,
      hourlyAirBody(body, '2026-10-13', '1', now),
      new Date(now).toISOString(),
      now,
    )
    expect(e.value).toBe(36)
    expect(e.observedAt).toBe('2026-10-13T04:00:00.000Z')
    expect(e.freshness).toBe('FRESH')
  })
  it('단위·장비를 확인하지 못하면 판단할 값을 만들지 않는다', () => {
    for (const b of [
      hourlyAirBody(body, '2026-10-13'),
      hourlyAirBody(
        {
          data: [{ hours: 13, devId: 1, type: 'PM25', value: 90, unit: 'PPM' }],
        },
        '2026-10-13',
        '1',
      ),
    ])
      expect(
        interpretBody(source, b, new Date(now).toISOString(), now).value,
      ).toBeNull()
  })
  it('최신 교통 데이터가 오래된 대기값을 정상으로 만들지 않는다', () => {
    const observations = obs(30, 90)
    observations.sources.pm25 = {
      provenance: 'SNAPSHOT',
      sourceId: 'INT_S01_012',
      observedAt: null,
      fetchedAt: null,
      note: null,
      freshness: 'STALE',
      eligible: false,
    }
    expect(
      calculate(plan, observations).stops.some((s) => s.id === 'street'),
    ).toBe(true)
    expect(calculate(plan, observations).calculationStatus).toBe('PARTIAL')
  })
  it.each([
    [35, 7, false],
    [36, 2, true],
    [10, 8, true],
  ])('PM2.5 %s / UV %s의 실내 우선=%s', (pm25, uv, blocked) => {
    const it = calculate(plan, obs(0, Number(pm25), Number(uv)))
    expect(it.stops.some((s) => s.id === 'street')).toBe(!blocked)
    if (blocked) expect(it.stops.some((s) => s.id === 'gp-museum')).toBe(true)
  })
})

describe('발표 시점의 저장된 오전 예보', () => {
  it('오전 예보는 원래 발표시각을 유지하고 새 예보와 구분한다', () => {
    const h = {
      date: '2026-10-13',
      time: '08:00',
      tempC: 20,
      sky: '맑음',
      precip: '',
      popPct: 10,
      windMs: 2,
      issuedAt: '2026-10-12T23:00:00+09:00',
    }
    const merged = mergeForecastHours(
      '2026-10-13',
      [h],
      [{ ...h, time: '18:00', issuedAt: '2026-10-13T17:00:00+09:00' }],
    )
    expect(merged[0]).toMatchObject({
      provenance: 'SNAPSHOT',
      issuedAt: h.issuedAt,
    })
    expect(merged[1].provenance).toBe('LIVE')
    expect(mergeForecastHours('2026-10-14', [h], [])).toEqual([])
  })
})
