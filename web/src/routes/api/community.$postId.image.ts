import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { communityImage } from '#/server/community'
import { getDb } from '#/server/db/client'

export const Route = createFileRoute('/api/community/$postId/image')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!z.uuid().safeParse(params.postId).success)
          return new Response(null, { status: 404 })
        const bytes = await communityImage(await getDb(), params.postId)
        return bytes
          ? new Response(new Uint8Array(bytes), {
              headers: {
                'Content-Type': 'image/jpeg',
                'X-Content-Type-Options': 'nosniff',
                'Cache-Control': 'public, max-age=3600',
              },
            })
          : new Response(null, { status: 404 })
      },
    },
  },
})
