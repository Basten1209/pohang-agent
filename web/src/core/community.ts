import { z } from 'zod'
import { placeIdSchema, type TripConfig } from './schema'
import type { TripState } from './trip'
import { planner, canTravel } from './planner'

export const communityPostSchema = z
  .object({
    tripId: z.uuid(),
    course: z.enum(['guryongpo', 'homigot']),
    placeId: placeIdSchema.optional(),
    caption: z.string().trim().min(1).max(300),
    photo: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('DEMO') }).strict(),
      z
        .object({
          kind: z.literal('UPLOAD'),
          // The client resizes/re-encodes images to JPEG before sending them.
          data: z
            .string()
            .max(1_000_000)
            .regex(/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/),
        })
        .strict(),
    ]),
  })
  .strict()

export type CommunityPostInput = z.infer<typeof communityPostSchema>
export type CommunityPost = {
  id: string
  course: string
  kind: 'FINISH' | 'VISIT'
  placeId: string | null
  placeName: string | null
  author: string
  caption: string
  photoKind: 'DEMO' | 'UPLOAD'
  image: string
  createdAt: string
}

/** Only user-confirmed visits are eligible; a planned stop is not an arrival. */
export const visitedPlaces = (config: TripConfig, state: TripState) =>
  !state.created || state.phase < 3
    ? []
    : state.plan.completed.flatMap((id) => {
        const place = config.places.find((p) => p.id === id && p.active)
        return place &&
          ['guryongpo', 'homigot'].includes(place.attrs.course) &&
          config.courses.some((c) => c.id === place.attrs.course && c.active)
          ? [place]
          : []
      })

/** Current stop is eligible only after arrival in the course area. Sharing never advances it. */
export const photoEligiblePlaces = (config: TripConfig, state: TripState) => {
  if (
    !state.created ||
    state.phase < 3 ||
    state.plan.condition === 'UNWELL' ||
    ['OUTBOUND', 'RETURN'].includes(state.plan.stage)
  )
    return []
  const visited = visitedPlaces(config, state)
  if (state.plan.stage !== 'LOCAL' || !config.courses.some((c) => c.active))
    return visited
  const itinerary = planner(config)(state.plan, state.observations)
  if (!canTravel(itinerary)) return visited
  const current = config.places.find(
    (p) =>
      p.id === itinerary.stops[0]?.id &&
      p.active &&
      ['guryongpo', 'homigot'].includes(p.attrs.course),
  )
  return current && !visited.some((p) => p.id === current.id)
    ? [...visited, current]
    : visited
}

export const captionInputSchema = communityPostSchema.pick({
  tripId: true,
  placeId: true,
  photo: true,
})

/** A nudge after visiting, never while unwell, rushing home or moving. */
export const photoOpportunity = (
  config: TripConfig,
  state: TripState,
  slack: number | null,
) =>
  state.plan.stage === 'LOCAL' &&
  ['OK', 'TIRED'].includes(state.plan.condition) &&
  slack !== null &&
  slack >= 20
    ? (visitedPlaces(config, state).at(-1) ?? null)
    : null
