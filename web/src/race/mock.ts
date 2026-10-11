import type { Race } from '#/core/race'
import { event as seedEvent } from '#/core/seed/event'

export const bib = '10427'
export const category = `${seedEvent.course.distanceKm}km`

/** Only the current runner: no participant field or comparative rankings. */
export const race: Race = {
  distance: seedEvent.course.distanceKm,
  paces: [352, 345, 348, 350, 355, 358, 362, 360, 356, 340],
}
