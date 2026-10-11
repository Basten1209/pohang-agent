import { describe, expect, it } from 'vitest'
import { distanceAt, pace, raceClock, snapshot, timeAt } from '#/core/race'

const race = { distance: 2, paces: [300, 360] }

describe('개인 레이스 기록', () => {
  it('거리와 시간은 서로의 역함수', () => {
    const paces = [300, 360, 330]
    expect(distanceAt(paces, 480)).toBeCloseTo(1.5)
    expect(timeAt(paces, 1.5)).toBe(480)
    expect(distanceAt(paces, 5000)).toBe(3)
  })

  it('출발 전에는 페이스나 예상 기록을 만들어내지 않음', () => {
    expect(snapshot(race, 0)).toEqual({
      elapsed: 0,
      distance: 0,
      finished: false,
      avgPace: null,
      projected: null,
    })
    expect(snapshot(race, -1)).toEqual(snapshot(race, 0))
  })

  it('내 경과시간과 누적 거리로 평균 페이스와 총 완주시간 계산', () => {
    const s = snapshot(race, 450)
    expect(s.distance).toBeCloseTo(1 + 150 / 360)
    expect(s.avgPace).toBeCloseTo(450 / s.distance)
    expect(s.projected).toBe(Math.round((450 / s.distance) * 2))
  })

  it('완주 후 시간과 거리는 고정되고 예상이 완주 기록이 됨', () => {
    const s = snapshot(race, 9999)
    expect(s.finished).toBe(true)
    expect(s.elapsed).toBe(660)
    expect(s.distance).toBe(2)
    expect(s.avgPace).toBe(330)
    expect(s.projected).toBe(660)
  })

  it('표시 형식', () => {
    expect(pace(352)).toBe(`5'52"`)
    expect(raceClock(3506)).toBe('58:26')
    expect(raceClock(3723)).toBe('1:02:03')
    expect(raceClock(65)).toBe('1:05')
  })
})
