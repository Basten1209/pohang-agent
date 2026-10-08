import type { Race, Runner } from '#/core/race'
import { event as seedEvent } from '#/core/seed/event'

/**
 * Demo data for the live race tab: the runner's bib and a made-up field.
 * The event itself (name, schedule, checkpoints) comes from config.
 */

export const bib = '10427'
export const category = `${seedEvent.course.distanceKm}km`
const checkpoints = seedEvent.course.checkpoints

/** A slightly positive-split 5'50" runner with a kick in the last km. */
const me: Runner = {
  bib: bib,
  name: '나',
  paces: [352, 345, 348, 350, 355, 358, 362, 360, 356, 340],
}

const named = ['박○준', '김○현', '최○아', '정○우', '한○민']

/** Deterministic field: even-paced runners from ~3'30" to ~9'00" per km. */
const field: Runner[] = Array.from({ length: 1239 }, (_, i) => {
  const q = (i + 0.5) / 1239
  const p = Math.round(208 + 332 * q ** 0.75)
  return {
    bib: String(20001 + i),
    name: named[i] ?? `참가자 ${20001 + i}`,
    paces: Array.from({ length: 10 }, () => p),
  }
})

export const race: Race = { distance: 10, me, field, checkpoints }

/** Where the demo clock starts: just past 6 km. */
export const demoStart = 2240
