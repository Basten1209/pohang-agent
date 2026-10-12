import { describe, expect, it } from 'vitest'
import { seedConfig } from '#/core/defaults'
import { planner } from '#/core/planner'
import { roadOptions } from '#/core/mobility'
import type { Plan, Observations } from '#/core/schema'
import { advance, initialTrip, replay } from '#/core/trip'

const plan: Plan = {
  ...seedConfig.defaults.plan,
  course: 'guryongpo',
  condition: 'OK',
}
const obs: Observations = {
  ...seedConfig.defaults.observations,
  readings: { congestion: 42, pm25: 10, uvIndex: 2 },
}
const calculate = planner(seedConfig)

describe('구간별 교통수단과 보존되는 일정', () => {
  it('버스와 택시는 별도 추정이며 도보·대기·여유를 한 번만 더한다', () => {
    const course = seedConfig.courses[0]
    expect(
      roadOptions(course, 'OUTBOUND', 'STATION', 0).map((o) => o.totalMin),
    ).toEqual([80, 47])
    expect(
      roadOptions(course, 'RETURN', 'STATION', 10).map((o) => o.totalMin),
    ).toEqual([105, 62])
    const bus = calculate({ ...plan, localTransport: 'TRANSIT' }, obs)
    const taxi = calculate({ ...plan, localTransport: 'TAXI' }, obs)
    expect(taxi.outbound).toBe(47)
    expect(bus.outbound).toBe(80)
    expect(taxi.planningArrival!).toBeLessThan(bus.planningArrival!)
    for (const result of [bus, taxi]) {
      const rows = [...result.legs, ...result.stops].sort(
        (a, b) => a.start - b.start,
      )
      expect(rows[0].start).toBe(result.start)
      for (let i = 1; i < rows.length; i++)
        expect(rows[i].start).toBe(rows[i - 1].end)
      expect(rows.at(-1)!.end).toBe(result.planningArrival)
      for (const leg of result.legs) {
        expect(leg.end - leg.start).toBe(
          leg.rideMin + leg.waitMin + leg.walkMin + leg.bufferMin,
        )
        expect(leg.totalMin).toBe(leg.baseMin + leg.bufferMin)
      }
    }
  })
  it('여유가 넉넉하면 버스, 귀가가 앞당겨지면 복귀만 택시로 조합', () => {
    const normal = calculate(plan, obs)
    const early = calculate({ ...plan, departTime: '16:00' }, obs)
    expect(normal.legs.find((l) => l.kind === 'OUTBOUND')?.mode).toBe('TRANSIT')
    expect(normal.legs.find((l) => l.kind === 'RETURN')?.mode).toBe('TRANSIT')
    expect(early.legs.find((l) => l.kind === 'OUTBOUND')?.mode).toBe('TRANSIT')
    expect(early.legs.find((l) => l.kind === 'RETURN')?.mode).toBe('TAXI')
    expect(early.stops.map((s) => s.id)).toEqual(['food', 'street', 'cafe'])
    expect(early.planningArrival!).toBeLessThanOrEqual(early.stationTarget)
  })
  it('혼잡은 버스와 택시 모두 지연시키고, 짧은 택시 이동 대신 도보가 나을 수 있다', () => {
    const tired = { ...plan, condition: 'TIRED' as const }
    const normal = calculate(tired, obs)
    const traffic = calculate(tired, {
      ...obs,
      readings: { ...obs.readings, congestion: 82 },
    })
    expect(
      normal.legs.find((l) => l.from === 'food' && l.to === 'street')?.mode,
    ).toBe('TAXI')
    expect(
      traffic.legs.find((l) => l.from === 'food' && l.to === 'street')?.mode,
    ).toBe('WALK')
    const road = traffic.legs.find((l) => l.kind === 'OUTBOUND')!
    expect(road.options.map((o) => o.bufferMin)).toEqual([10, 10])
    expect(traffic.trafficReserve).toBe(
      traffic.legs.reduce((n, l) => n + l.bufferMin, 0),
    )
  })
  it('구간 선택은 해당 구간만 바꾸고 재계산·다음 진행에도 같은 시각을 쓴다', () => {
    const before = calculate(plan, obs)
    const out = before.legs.find((l) => l.kind === 'OUTBOUND')!
    const selected = {
      ...plan,
      transportOverrides: { [out.id]: 'TAXI' as const },
    }
    const after = calculate(selected, obs)
    expect(after.legs.find((l) => l.kind === 'OUTBOUND')?.mode).toBe('TAXI')
    expect(after.legs.find((l) => l.kind === 'RETURN')?.mode).toBe('TRANSIT')
    const state = {
      ...initialTrip(seedConfig),
      plan: { ...selected, stage: 'OUTBOUND' as const },
      observations: obs,
    }
    const arrived = replay(state, advance(state, after).events)
    expect(calculate(arrived.plan, obs).outbound).toBe(0)
    expect(calculate(arrived.plan, obs).stops[0].start).toBe(
      after.stops[0].start,
    )
  })
  it('오래된 혼잡·호미곶 직접 택시·의료·경로 누락 경계를 유지한다', () => {
    const stale = calculate(plan, { ...obs, freshness: 'STALE' })
    expect(stale.calculationStatus).toBe('PARTIAL')
    expect(
      stale.legs
        .filter((l) => l.mode !== 'WALK')
        .every((l) => l.bufferMin === 10),
    ).toBe(true)
    const homigot = calculate(
      {
        ...plan,
        course: 'homigot',
        localTransport: 'TAXI',
        interests: ['food', 'view'],
      },
      obs,
    )
    expect(homigot.trafficReserve).toBe(0)
    expect(homigot.reasons.join()).not.toContain('구룡포 교통 혼잡 신호')
    expect(calculate({ ...plan, condition: 'UNWELL' }, obs).legs).toEqual([])
    expect(calculate(plan, { ...obs, routeAvailable: false }).decision).toBe(
      'NEEDS_DATA',
    )
  })
  it('완료한 장소를 제외한 다음 이동은 마지막 방문지에서 시작한다', () => {
    const result = calculate(
      {
        ...plan,
        currentPlace: 'COURSE',
        stage: 'LOCAL',
        currentTime: '13:00',
        completed: ['food'],
      },
      obs,
    )
    expect(result.legs[0].from).toBe('food')
    expect(result.legs[0].to).toBe('street')
    expect(result.stops.some((s) => s.id === 'food')).toBe(false)
  })
})
