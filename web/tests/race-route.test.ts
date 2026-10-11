import { describe, expect, it } from 'vitest'
import { demoRoute, routeAt } from '#/core/race-route'
import { snapshot, timeAt } from '#/core/race'
import {
  advanceRace,
  elapsedAt,
  freshRace,
  restoreRace,
} from '#/core/race-session'
import { race } from '#/race/mock'

describe('가상 GPS 이동 경로', () => {
  it('출발점에서 시작하고 절반에 반환해 완주 때 출발점으로 돌아옴', () => {
    expect(routeAt(0).trail).toEqual([demoRoute[0]])
    const halfway = routeAt(0.5).position
    const turn = demoRoute[(demoRoute.length - 1) / 2]
    expect(halfway[0]).toBeCloseTo(turn[0], 10)
    expect(halfway[1]).toBeCloseTo(turn[1], 10)
    expect(routeAt(1).trail).toEqual(demoRoute)
    expect(routeAt(1).position).toEqual(demoRoute[0])
  })

  it('경로가 시간에 따라 쌓이고 현재 위치는 경로 끝점과 일치', () => {
    let previous = routeAt(0)
    for (let i = 1; i <= 100; i++) {
      const next = routeAt(i / 100)
      expect(next.position).toEqual(next.trail.at(-1))
      expect(next.trail.length).toBeGreaterThanOrEqual(previous.trail.length)
      expect(next.trail.slice(0, previous.trail.length - 1)).toEqual(
        previous.trail.slice(0, -1),
      )
      previous = next
    }
    // Equal outbound/return fractions pass the same point on this out-and-back.
    expect(routeAt(0.25).position[0]).toBeCloseTo(routeAt(0.75).position[0], 10)
    expect(routeAt(0.25).position[1]).toBeCloseTo(routeAt(0.75).position[1], 10)
  })

  it('범위를 벗어나거나 잘못된 진행률은 안전한 시작/끝으로 제한', () => {
    for (const progress of [-1, NaN, Infinity])
      expect(routeAt(progress)).toEqual(routeAt(0))
    expect(routeAt(2)).toEqual(routeAt(1))
  })

  it('일시정지·저장 복원·배속·마지막 1km 이동·완주가 지도와 기록에 같이 적용', () => {
    const total = timeAt(race.paces, race.distance)
    const act = (
      s: ReturnType<typeof freshRace>,
      action: Parameters<typeof advanceRace>[1],
      at: number,
    ) => advanceRace(s, action, at, total, race.paces.at(-1)!)
    const frame = (s: ReturnType<typeof freshRace>, at: number) => {
      const metrics = snapshot(race, elapsedAt(s, at, total))
      return { metrics, route: routeAt(metrics.distance / race.distance) }
    }
    let session = act(freshRace(), 'START', 1000)
    session = act(session, 60, 2000)
    session = act(session, 'PAUSE', 12000)
    const paused = frame(session, 12000)
    session = restoreRace(JSON.stringify(session), 60000, total)
    expect(frame(session, 60000)).toEqual(paused)
    session = act(session, 'RESUME', 60000)
    expect(frame(session, 61000).route.position).not.toEqual(
      paused.route.position,
    )
    session = act(session, 'FINAL_KM', 62000)
    expect(frame(session, 62000).metrics.distance).toBeCloseTo(9)
    session = act(session, 'FINISH', 63000)
    expect(frame(session, 63000).route).toEqual(routeAt(1))
    expect(frame(session, 63000).metrics.elapsed).toBe(total)
  })
})
