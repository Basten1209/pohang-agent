import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { tripStateSchema } from '#/core/trip'
import type { TripEvent } from '#/core/trip'
import { getDb } from '#/server/db/client'
import { appendEvents } from '#/server/db/repo'
import { json, parseBody } from '#/server/http'

/**
 * Append trip events (best effort from the client). Events are JSON and are
 * stored verbatim as jsonb; the folded state is cached alongside.
 * Free-text chat is never sent here.
 */
const bodySchema = z.object({
  events: z
    .array(z.object({ type: z.string().max(40) }).passthrough())
    .min(1)
    .max(50),
  state: tripStateSchema,
})

export const Route = createFileRoute('/api/trips/$tripId/events')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!z.uuid().safeParse(params.tripId).success)
          return json({ error: 'INVALID_TRIP' }, { status: 400 })
        const body = await parseBody(request, bodySchema)
        if (!body.ok) return body.response
        const db = await getDb()
        const count = await appendEvents(
          db,
          params.tripId,
          body.data.events as unknown as TripEvent[],
          body.data.state,
          { client: 'web' },
        )
        return json({ stored: count })
      },
    },
  },
})
