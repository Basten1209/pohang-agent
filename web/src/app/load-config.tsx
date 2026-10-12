import { useEffect, useState } from 'react'
import { GullPose } from '#/brand/brand'
import { seedConfig } from '#/core/defaults'
import { configSchema } from '#/core/schema'
import { useI18n } from '#/i18n/react'
import { fetchConfig } from './config-fn'

const CACHE_KEY = `run2-guryongpo-config-v${seedConfig.version}`

/**
 * Config comes from the server (seed ⊕ jsonb ⊕ env). Offline, the PWA uses
 * the last config it saw, and failing that the bundled seed.
 */
export const loadConfig = async () => {
  try {
    const remote = await fetchConfig({ signal: AbortSignal.timeout(12_000) })
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

export const Loading = () => {
  const [slow, setSlow] = useState(false)
  const { t } = useI18n()
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(id)
  }, [])
  return (
    <div className="grid min-h-dvh place-items-center launch-sea p-6">
      <div
        role="status"
        aria-live="polite"
        className="flex max-w-xs flex-col items-center gap-4 text-center"
      >
        <h1 className="brand-heading text-4xl">RUN2구룡포</h1>
        <p className="text-lg text-foreground">{t('load.tagline')}</p>
        <GullPose className="brand-pulse w-56 sm:w-64" />
        <span className="text-xs font-semibold tracking-[.25em] text-primary">
          RUN2 GURYONGPO
        </span>
        <span className="sr-only">{t('load.status')}</span>
        <p className="text-sm text-muted-foreground">
          {slow ? t('load.slow') : t('load.wait')}
        </p>
        {slow && (
          <button
            className="rounded-md border px-4 py-2 text-sm"
            onClick={() => location.reload()}
          >
            {t('common.retry')}
          </button>
        )}
      </div>
    </div>
  )
}
