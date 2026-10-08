import { describe, expect, it } from 'vitest'
import type { Race, Runner } from '#/core/race'
import {
  distanceAt,
  pace,
  raceClock,
  snapshot,
  standings,
  timeAt,
} from '#/core/race'
import { race } from '#/race/mock'

const even = (bib: string, p: number, n = 2): Runner => ({
  bib,
  name: bib,
  paces: Array.from({ length: n }, () => p),
})

const small: Race = {
  distance: 2,
  me: { bib: 'me', name: '나', paces: [300, 360] },
  field: [even('fast', 240), even('slow', 400)],
  checkpoints: [
    { km: 1, label: '급수대' },
    { km: 2, label: '결승' },
  ],
}

describe('레이스 현황', () => {
  it('거리와 시간은 서로의 역함수', () => {
    const paces = [300, 360, 330]
    expect(distanceAt(paces, 480)).toBeCloseTo(1.5)
    expect(timeAt(paces, 1.5)).toBe(480)
    expect(distanceAt(paces, 5000)).toBe(3)
  })

  it('완주자는 기록순, 나머지는 거리순', () => {
    const at = standings([small.me, ...small.field], 2, 500)
    expect(at.map((s) => s.bib)).toEqual(['fast', 'me', 'slow'])
    expect(at[0].finish).toBe(480)
    expect(at[1].finish).toBeNull()
  })

  it('순위·앞 주자 거리·다음 체크포인트', () => {
    const s = snapshot(small, 450)
    expect(s.rank).toBe(2)
    expect(s.total).toBe(3)
    expect(s.distance).toBeCloseTo(1 + 150 / 360)
    expect(s.currentPace).toBe(360)
    expect(s.splits).toEqual([{ km: 1, time: 300 }])
    expect(s.gapAhead).toBeCloseTo(450 / 240 - s.distance)
    expect(s.next?.label).toBe('결승')
  })

  it('완주하면 기록이 고정되고 예상이 실제가 됨', () => {
    const s = snapshot(small, 9999)
    expect(s.finished).toBe(true)
    expect(s.projected).toBe(660)
    expect(s.gapAhead).toBeNull()
    expect(s.next).toBeNull()
  })

  it('순위표는 상위권과 내 주변을 함께 보여줌', () => {
    const s = snapshot(race, 2240)
    const bibs = s.board.map((r) => r.bib)
    expect(bibs.slice(0, 3)).toEqual(['20001', '20002', '20003'])
    expect(bibs).toContain(race.me.bib)
    expect(new Set(bibs).size).toBe(bibs.length)
  })

  it('표시 형식', () => {
    expect(pace(352)).toBe(`5'52"`)
    expect(raceClock(3506)).toBe('58:26')
    expect(raceClock(3723)).toBe('1:02:03')
    expect(raceClock(65)).toBe('1:05')
  })
})
