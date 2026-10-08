/**
 * Race standing as a pure function of the race clock. Every runner is a list
 * of per-km paces (seconds per km); distance, splits and rank all follow from
 * `t` (seconds since the gun), so the live tab only has to advance `t`.
 */

export type Runner = {
  bib: string
  name: string
  /** Seconds per km, one entry per km of the course. */
  paces: readonly number[]
}

export type Checkpoint = { km: number; label: string }

export type Race = {
  distance: number
  me: Runner
  field: readonly Runner[]
  checkpoints: readonly Checkpoint[]
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0)

/** Seconds a runner needs to reach `km`. */
export const timeAt = (paces: readonly number[], km: number) => {
  const whole = Math.floor(km)
  const part = km - whole
  return sum(paces.slice(0, whole)) + (part > 0 ? part * paces[whole] : 0)
}

/** Kilometres covered after `t` seconds, capped at the course length. */
export const distanceAt = (paces: readonly number[], t: number) => {
  let left = t
  for (let km = 0; km < paces.length; km++) {
    if (left < paces[km]) return km + left / paces[km]
    left -= paces[km]
  }
  return paces.length
}

export type Standing = {
  bib: string
  name: string
  distance: number
  /** Finish time in seconds, once across the line. */
  finish: number | null
  rank: number
}

/** Finished runners by finish time, then everyone else by distance. */
export const standings = (
  runners: readonly Runner[],
  distance: number,
  t: number,
): Standing[] =>
  runners
    .map((r) => {
      const total = timeAt(r.paces, distance)
      return {
        bib: r.bib,
        name: r.name,
        distance: distanceAt(r.paces, t),
        finish: total <= t ? total : null,
      }
    })
    .sort((a, b) =>
      a.finish !== null || b.finish !== null
        ? (a.finish ?? Infinity) - (b.finish ?? Infinity)
        : b.distance - a.distance,
    )
    .map((s, i) => ({ ...s, rank: i + 1 }))

export type Split = { km: number; time: number }

export type Snapshot = {
  t: number
  distance: number
  finished: boolean
  /** Pace of the km being run now (the last one once finished). */
  currentPace: number
  avgPace: number
  /** Finish time: actual once finished, else at the average pace so far. */
  projected: number
  rank: number
  total: number
  splits: Split[]
  /** Distance to the runner just ahead, if any. */
  gapAhead: number | null
  next: (Checkpoint & { inKm: number }) | null
  board: Standing[]
}

/** Top `top` runners, then the runner and their neighbours. */
const boardOf = (all: Standing[], bib: string, top: number) => {
  const i = all.findIndex((s) => s.bib === bib)
  const near = all.slice(Math.max(0, i - 1), i + 2)
  const head = all.slice(0, top)
  return [...head, ...near.filter((s) => s.rank > top)]
}

export const snapshot = (race: Race, t: number, top = 3): Snapshot => {
  const { me } = race
  const all = standings([me, ...race.field], race.distance, t)
  const mine = all.find((s) => s.bib === me.bib)!
  const distance = mine.distance
  const finished = mine.finish !== null
  const elapsed = finished ? mine.finish! : t
  const avgPace = distance > 0 ? elapsed / distance : me.paces[0]
  const ahead = all[mine.rank - 2]
  return {
    t,
    distance,
    finished,
    currentPace: me.paces[Math.min(Math.floor(distance), me.paces.length - 1)],
    avgPace,
    projected: finished ? mine.finish! : Math.round(avgPace * race.distance),
    rank: mine.rank,
    total: all.length,
    splits: me.paces
      .slice(0, Math.floor(distance))
      .map((time, i) => ({ km: i + 1, time })),
    gapAhead: ahead && !finished ? ahead.distance - distance : null,
    next:
      race.checkpoints
        .filter((c) => c.km > distance)
        .map((c) => ({ ...c, inKm: c.km - distance }))[0] ?? null,
    board: boardOf(all, me.bib, top),
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
