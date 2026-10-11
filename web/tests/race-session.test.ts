import { describe, expect, it } from 'vitest'
import {
  advanceRace,
  elapsedAt,
  freshRace,
  restoreRace,
} from '#/core/race-session'
const total = 3526
const action = (
  s: ReturnType<typeof freshRace>,
  a: Parameters<typeof advanceRace>[1],
  t: number,
) => advanceRace(s, a, t, total, 340)
describe('trip-scoped race simulation clock', () => {
  it('does not advance until explicitly started; reload preserves elapsed wall time', () => {
    expect(elapsedAt(freshRace(), 1000000, total)).toBe(0)
    const started = action(freshRace(), 'START', 1000)
    const restored = restoreRace(JSON.stringify(started), 11000, total)
    expect(restored.status).toBe('RUNNING')
    expect(elapsedAt(restored, 11000, total)).toBe(10)
    expect(action(started, 'START', 5000)).toEqual(started)
  })
  it('freezes paused time and resumes without counting the pause', () => {
    let s = action(freshRace(), 'START', 1000)
    s = action(s, 'PAUSE', 11000)
    expect(elapsedAt(s, 50000, total)).toBe(10)
    s = restoreRace(JSON.stringify(s), 50000, total)
    s = action(s, 'RESUME', 50000)
    expect(elapsedAt(s, 53000, total)).toBe(13)
  })
  it('speed changes preserve elapsed progress, never multiply previous time', () => {
    let s = action(freshRace(), 'START', 1000)
    s = action(s, 60, 11000)
    expect(elapsedAt(s, 12000, total)).toBe(70)
    s = action(s, 1, 12000)
    expect(elapsedAt(s, 22000, total)).toBe(80)
  })
  it('jump only works after start and never rewinds; finishing is permanent', () => {
    expect(action(freshRace(), 'FINAL_KM', 1000)).toEqual(freshRace())
    let s = action(freshRace(), 'START', 1000)
    s = action(s, 'FINAL_KM', 2000)
    expect(elapsedAt(s, 2000, total)).toBe(total - 340)
    s = action(s, 'FINAL_KM', 3000)
    expect(elapsedAt(s, 3000, total)).toBe(total - 339)
    s = action(s, 'FINISH', 4000)
    expect(elapsedAt(s, 50000, total)).toBe(total)
    expect(action(s, 'START', 60000)).toEqual(s)
  })
  it('finishes after suspended tabs resume and rejects invalid storage', () => {
    const started = action(freshRace(), 'START', 1000)
    expect(restoreRace(JSON.stringify(started), 4000000, total).status).toBe(
      'FINISHED',
    )
    for (const value of [
      null,
      'invalid',
      '{}',
      JSON.stringify({ ...started, speed: 999 }),
      JSON.stringify({ ...started, elapsed: -10 }),
      JSON.stringify({ ...started, anchor: 50000 }),
    ])
      expect(restoreRace(value, 10000, total)).toEqual(freshRace())
  })
})
