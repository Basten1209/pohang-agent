import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { tripEventSchema } from '#/core/trip'
import { openingFor, tripView } from '#/server/agent/harness'
import { getConfig } from '#/server/config'
import { getDb } from '#/server/db/client'
import { json, parseBody } from '#/server/http'
import { commit, openTrip } from '#/server/trips'

/**
 * GET  → the trip (created on first visit) and its conversation.
 * POST → apply validated events on the server and return the new trip.
 *        Used by the demo menu and the classic screens.
 */
const eventsSchema = z.object({
  events: z.array(tripEventSchema).min(1).max(20),
})

const load = async (tripId: string) => {
  const [{ config }, db] = await Promise.all([getConfig(), getDb()])
  return {
    config,
    db,
    record: await openTrip(db, config, tripId, openingFor(config)),
  }
}

export const Route = createFileRoute('/api/trips/$tripId')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!z.uuid().safeParse(params.tripId).success)
          return json({ error: 'INVALID_TRIP' }, { status: 400 })
        const { config, record } = await load(params.tripId)
        return json({
          trip: tripView(config, record.state),
          messages: record.messages,
        })
      },
      POST: async ({ request, params }) => {
        if (!z.uuid().safeParse(params.tripId).success)
          return json({ error: 'INVALID_TRIP' }, { status: 400 })
        const body = await parseBody(request, eventsSchema)
        if (!body.ok) return body.response
        const { config, db, record } = await load(params.tripId)
        const next = await commit(db, record, body.data.events, {
          source: 'client',
        })
        return json({ trip: tripView(config, next.state) })
      },
    },
  },
})
