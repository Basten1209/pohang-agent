import { createFileRoute } from '@tanstack/react-router'
import { createUIMessageStreamResponse } from 'ai'
import { z } from 'zod'
import type { AgentUIMessage } from '#/server/agent/harness'
import { runTurn } from '#/server/agent/harness'
import { modelFor } from '#/server/agent/model'
import { getConfig } from '#/server/config'
import { getDb } from '#/server/db/client'
import { parseBody } from '#/server/http'
import { observeAll } from '#/server/sources/observe'

/**
 * The client sends only its newest message (a user message, or the last
 * assistant message updated with a card answer / approval). The server owns
 * the conversation and the trip.
 */
const bodySchema = z.object({
  tripId: z.uuid(),
  message: z
    .object({
      id: z.string().min(1).max(100),
      role: z.enum(['user', 'assistant']),
      parts: z.array(z.object({ type: z.string() }).passthrough()).max(40),
    })
    .passthrough(),
})

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await parseBody(request, bodySchema, 128_000)
        if (!body.ok) return body.response
        const [{ config }, db] = await Promise.all([getConfig(), getDb()])
        const stream = await runTurn(
          {
            config,
            db,
            model: modelFor(config),
            observe: () => observeAll(config),
          },
          {
            tripId: body.data.tripId,
            message: body.data.message as unknown as AgentUIMessage,
          },
        )
        return createUIMessageStreamResponse({
          stream,
          headers: { 'Cache-Control': 'no-store' },
        })
      },
    },
  },
})
