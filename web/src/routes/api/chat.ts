import { createFileRoute } from '@tanstack/react-router'
import { createUIMessageStreamResponse } from 'ai'
import { z } from 'zod'
import { observationsSchema, planSchema } from '#/core/schema'
import type { AgentUIMessage } from '#/server/agent/agent'
import { respond } from '#/server/agent/agent'
import { modelFor } from '#/server/agent/model'
import { getConfig } from '#/server/config'
import { parseBody } from '#/server/http'
import { observeAll } from '#/server/sources/observe'

const bodySchema = z.object({
  messages: z
    .array(
      z
        .object({
          id: z.string(),
          role: z.enum(['user', 'assistant', 'system']),
          parts: z.array(z.object({ type: z.string() }).passthrough()),
        })
        .passthrough(),
    )
    .min(1)
    .max(20),
  plan: planSchema,
  observations: observationsSchema,
})

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await parseBody(request, bodySchema)
        if (!body.ok) return body.response
        const { config } = await getConfig()
        const stream = respond(
          {
            config,
            plan: body.data.plan,
            observations: body.data.observations,
            messages: body.data.messages.filter(
              (m) => m.role !== 'system',
            ) as unknown as AgentUIMessage[],
          },
          { model: modelFor(config), observe: () => observeAll(config) },
        )
        return createUIMessageStreamResponse({
          stream,
          headers: { 'Cache-Control': 'no-store' },
        })
      },
    },
  },
})
