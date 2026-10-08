import { createFileRoute } from '@tanstack/react-router'
import { getConfig } from '#/server/config'
import { json } from '#/server/http'

export const Route = createFileRoute('/api/config')({
  server: {
    handlers: {
      GET: async () => {
        const { config, issues, storage } = await getConfig()
        return json({ config, issues, storage })
      },
    },
  },
})
