import type { Race } from '#/core/race'
import { routeDistanceMeters } from '#/core/race-route'

export const bib = '10427'
const distanceKm = Math.round(routeDistanceMeters) / 1000
export const category = `${distanceKm}km`

/** Only the current runner: no participant field or comparative rankings. */
export const race: Race = {
  distance: distanceKm,
  paces: [352, 345, 348, 350, 355, 358, 362, 360, 356, 340],
}
