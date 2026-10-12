import { createFileRoute } from '@tanstack/react-router'
import { captionInputSchema } from '#/core/community'
import { CaptionError, createCaption } from '#/server/caption'
import { getConfig } from '#/server/config'
import { getDb } from '#/server/db/client'
import { json, parseBody } from '#/server/http'

export const Route = createFileRoute('/api/community/caption')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await parseBody(request, captionInputSchema, 1_010_000)
        if (!body.ok) return body.response
        try {
          const [{ config }, db] = await Promise.all([getConfig(), getDb()])
          return json(await createCaption(db, config, body.data))
        } catch (error) {
          return json(
            {
              error:
                error instanceof CaptionError
                  ? error.code
                  : 'CAPTION_UNAVAILABLE',
            },
            { status: error instanceof CaptionError ? error.status : 503 },
          )
        }
      },
    },
  },
})
