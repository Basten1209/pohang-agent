import { createFileRoute } from '@tanstack/react-router'
import { communityPostSchema } from '#/core/community'
import { z } from 'zod'
import {
  completionForTrip,
  listCommunity,
  shareCompletion,
  shareVisit,
  visitForTrip,
  visitsForTrip,
} from '#/server/community'
import { getConfig } from '#/server/config'
import { placeIdSchema } from '#/core/schema'
import { getDb } from '#/server/db/client'
import { json, parseBody } from '#/server/http'

export const Route = createFileRoute('/api/community')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams
        const tripId = params.get('tripId')
        if (tripId) {
          if (!z.uuid().safeParse(tripId).success)
            return json({ error: 'INVALID_TRIP' }, { status: 400 })
          const placeId = params.get('placeId')
          if (placeId && !placeIdSchema.safeParse(placeId).success)
            return json({ error: 'INVALID_PLACE' }, { status: 400 })
          const db = await getDb()
          if (params.get('visits') === '1')
            return json({ posts: await visitsForTrip(db, tripId) })
          return json({
            post: placeId
              ? await visitForTrip(db, tripId, placeId)
              : await completionForTrip(db, tripId),
          })
        }
        return json({ posts: await listCommunity(await getDb()) })
      },
      POST: async ({ request }) => {
        const body = await parseBody(request, communityPostSchema, 1_010_000)
        if (!body.ok) return body.response
        const db = await getDb()
        const post = body.data.placeId
          ? await shareVisit(db, (await getConfig()).config, body.data)
          : await shareCompletion(db, body.data)
        return post
          ? json({ post }, { status: 201 })
          : json(
              {
                error: body.data.placeId
                  ? 'CONFIRMED_VISIT_REQUIRED'
                  : 'FINISHED_TRIP_REQUIRED',
              },
              { status: 422 },
            )
      },
    },
  },
})
