/** Personal demo metrics, derived only from this runner's simulation clock. */
export type Race = {
  distance: number
  /** Seconds per km, one entry per km of the demo course. */
  paces: readonly number[]
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0)

export const timeAt = (paces: readonly number[], km: number) => {
  const whole = Math.floor(km)
  const part = km - whole
  return sum(paces.slice(0, whole)) + (part > 0 ? part * paces[whole] : 0)
}

/** Kilometres covered after `t` seconds, capped at the course length. */
export const distanceAt = (paces: readonly number[], t: number) => {
  let left = Math.max(0, t)
  for (let km = 0; km < paces.length; km++) {
    if (left < paces[km]) return km + left / paces[km]
    left -= paces[km]
  }
  return paces.length
}

export const snapshot = (race: Race, t: number) => {
  const total = timeAt(race.paces, race.distance)
  const elapsed = Math.min(total, Math.max(0, t))
  const distance = distanceAt(race.paces, elapsed)
  const finished = elapsed >= total
  const avgPace = distance > 0 ? elapsed / distance : null
  return {
    elapsed,
    distance,
    finished,
    avgPace,
    projected: finished
      ? total
      : avgPace === null
        ? null
        : Math.round(avgPace * race.distance),
  }
}

/** 352 → 5'52" */
export const pace = (sec: number) => {
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"`
}

/** 3506 → 58:26, 3723 → 1:02:03 */
export const raceClock = (sec: number) => {
  const s = Math.floor(sec)
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
