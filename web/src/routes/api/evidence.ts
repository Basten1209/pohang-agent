import { createFileRoute } from '@tanstack/react-router'
import { getConfig } from '#/server/config'
import { json } from '#/server/http'
import { observeAll } from '#/server/sources/observe'

export const Route = createFileRoute('/api/evidence')({
  server: {
    handlers: {
      GET: async () => {
        const { config } = await getConfig()
        return json({ evidence: await observeAll(config) })
      },
    },
  },
})
