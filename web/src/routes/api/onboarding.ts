import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { knowledgeOf } from '#/core/knowledge'
import { tripStateSchema } from '#/core/trip'
import { getConfig } from '#/server/config'
import { getDb } from '#/server/db/client'
import { trips } from '#/server/db/schema'
import { json, parseBody } from '#/server/http'

export const Route = createFileRoute('/api/onboarding')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await parseBody(
          request,
          z.object({ tripId: z.uuid(), part: z.enum(['event', 'guide']) }),
        )
        if (!body.ok) return body.response
        const [{ config }, db] = await Promise.all([getConfig(), getDb()])
        const [trip] = await db
          .select({ state: trips.state })
          .from(trips)
          .where(eq(trips.id, body.data.tripId))
        const state = tripStateSchema.safeParse(trip?.state)
        if (!state.success || !state.data.created)
          return json({ error: 'PROFILE_REQUIRED' }, { status: 422 })
        const course =
          state.data.plan.course === 'auto'
            ? config.policy.featuredCourse
            : state.data.plan.course
        const ids = new Set(
          config.places
            .filter((p) => p.active && p.attrs.course === course)
            .map((p) => p.id),
        )
        const documents = knowledgeOf(config).filter((d) =>
          body.data.part === 'event'
            ? d.kind === 'race'
            : (d.kind === 'course' && d.ref === course) ||
              (d.kind === 'place' && ids.has(d.ref ?? '')),
        )
        return json({ documents })
      },
    },
  },
})
