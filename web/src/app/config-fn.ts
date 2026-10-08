import { createServerFn } from '@tanstack/react-start'
import { getConfig } from '#/server/config'

/**
 * Server function: the runtime trip config (seed ⊕ jsonb documents ⊕ env).
 * Sent as a JSON string because config carries open-ended jsonb (`meta`,
 * extra place attributes); the client re-validates it with `configSchema`.
 */
export const fetchConfig = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { config, storage } = await getConfig()
    return { json: JSON.stringify(config), storage }
  },
)
