import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { tripEventSchema } from '#/core/trip'
import { openingFor, tripView } from '#/server/agent/harness'
import { getConfig } from '#/server/config'
import { getDb } from '#/server/db/client'
import { json, parseBody } from '#/server/http'
import { syncLive } from '#/server/live'
import { observeAll } from '#/server/sources/observe'
import { commit, openTrip, saveConversation } from '#/server/trips'

/**
 * GET  → the trip (created on first visit) and its conversation.
 *        `?live=1` refreshes live observations first (throttled to 1/min).
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
      /** `?live=1` (the 관광 tab) first pulls fresh live observations into the plan. */
      GET: async ({ params, request }) => {
        if (!z.uuid().safeParse(params.tripId).success)
          return json({ error: 'INVALID_TRIP' }, { status: 400 })
        const loaded = await load(params.tripId)
        const { config, db } = loaded
        let { record } = loaded
        if (
          new URL(request.url).searchParams.get('live') === '1' &&
          record.state.phase >= 3
        ) {
          record = (
            await syncLive(db, config, record, () => observeAll(config), {
              minIntervalMs: 60_000,
            })
          ).record
          await saveConversation(db, record)
        }
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
        // Model selections are authored and validated by server tools, never by client events.
        if (
          body.data.events.some(
            (event) =>
              ('patch' in event && 'agentPlan' in event.patch) ||
              ('plan' in event && event.plan.agentPlan != null),
          )
        )
          return json(
            { error: 'SERVER_AUTHORED_PLAN_REQUIRED' },
            { status: 422 },
          )
        const { config, db, record } = await load(params.tripId)
        const next = await commit(db, record, body.data.events, {
          source: 'client',
        })
        return json({ trip: tripView(config, next.state) })
      },
    },
  },
})
