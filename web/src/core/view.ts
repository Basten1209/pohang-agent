import type { Itinerary } from './planner'
import { planner } from './planner'
import type { TripConfig } from './schema'
import type { Stage } from './stage'
import { stageOf } from './stage'
import type { TripState } from './trip'

/** What a client needs to draw a trip: the state and what follows from it. */
export type TripView = { state: TripState; itinerary: Itinerary; stage: Stage }

export const tripView = (config: TripConfig, state: TripState): TripView => ({
  state,
  itinerary: planner(config)(state.plan, state.observations),
  stage: stageOf(state),
})
