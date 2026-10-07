import { createFileRoute } from '@tanstack/react-router'
import { App } from '#/app/app'
import { fetchConfig } from '#/app/config-fn'
import { seedConfig } from '#/core/defaults'
import { configSchema } from '#/core/schema'

const CACHE_KEY = 'run2-guryongpo-config'

/**
 * Config comes from the server (seed ⊕ jsonb ⊕ env). Offline, the PWA uses
 * the last config it saw, and failing that the bundled seed.
 */
const loadConfig = async () => {
  try {
    const remote = await fetchConfig()
    const config = configSchema.parse(JSON.parse(remote.json))
    try {
      localStorage.setItem(CACHE_KEY, remote.json)
    } catch {
      /* storage unavailable: still usable */
    }
    return { config, storage: remote.storage }
  } catch {
    try {
      const cached = configSchema.safeParse(
        JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null'),
      )
      if (cached.success)
        return { config: cached.data, storage: 'offline-cache' }
    } catch {
      /* fall through */
    }
    return { config: seedConfig, storage: 'offline-seed' }
  }
}

export const Route = createFileRoute('/')({
  // The trip lives in this device's storage, so render on the client only.
  ssr: false,
  loader: loadConfig,
  pendingComponent: () => (
    <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">
      불러오는 중…
    </div>
  ),
  component: Home,
})

function Home() {
  const { config, storage } = Route.useLoaderData()
  return <App config={config} storage={storage} />
}
