import { createFileRoute } from '@tanstack/react-router'
import { communityPostSchema } from '#/core/community'
import { z } from 'zod'
import {
  completionForTrip,
  listCommunity,
  shareCompletion,
} from '#/server/community'
import { getDb } from '#/server/db/client'
import { json, parseBody } from '#/server/http'

export const Route = createFileRoute('/api/community')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const tripId = new URL(request.url).searchParams.get('tripId')
        if (tripId) {
          if (!z.uuid().safeParse(tripId).success)
            return json({ error: 'INVALID_TRIP' }, { status: 400 })
          return json({ post: await completionForTrip(await getDb(), tripId) })
        }
        return json({ posts: await listCommunity(await getDb()) })
      },
      POST: async ({ request }) => {
        const body = await parseBody(request, communityPostSchema, 1_010_000)
        if (!body.ok) return body.response
        const post = await shareCompletion(await getDb(), body.data)
        return post
          ? json({ post }, { status: 201 })
          : json({ error: 'FINISHED_TRIP_REQUIRED' }, { status: 422 })
      },
    },
  },
})
