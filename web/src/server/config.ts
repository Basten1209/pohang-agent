import { seedConfig } from '#/core/defaults'
import type { TripConfig } from '#/core/schema'
import type { ConfigIssue } from '#/core/config'
import { getDb } from './db/client'
import { readConfig, seed } from './db/repo'
import { applyDemoQaData } from './db/demo-qa'
import { refreshVenueCatalog } from './db/refresh-venues'
import { applyVenueCatalog } from './db/venue-catalog'
import { removeRequestedCommunityPost } from './db/community-cleanup'

/**
 * Runtime configuration = seed ⊕ database documents ⊕ environment.
 * Cached briefly so serverless instances pick up DB edits without a redeploy.
 */
const TTL_MS = 30_000
let cache: { at: number; value: Promise<LoadedConfig> } | undefined

export type LoadedConfig = {
  config: TripConfig
  issues: ConfigIssue[]
  storage: 'postgres' | 'pglite' | 'seed-only'
}

/** The verified device is a local proxy, not a city-wide air-quality guarantee. */
export const withEnv = (
  config: TripConfig,
  env: Record<string, string | undefined> = process.env,
): TripConfig => ({
  ...config,
  sources: config.sources.map((s) =>
    s.id === 'INT_S01_012' || s.id === 'INT_S01_004'
      ? {
          ...s,
          decision:
            s.id === 'INT_S01_012' &&
            env.EUM_AIR_VERIFIED === 'true' &&
            env.EUM_AIR_DEVICE_ID === '8',
          meta: {
            ...s.meta,
            scope:
              env.EUM_AIR_DEVICE_ID === '8'
                ? '구룡포 시장·가옥거리 인근 · 수협 위판장 장비 8'
                : `구룡포 대기 장비 ${env.EUM_AIR_DEVICE_ID || '미지정'} · 적용 범위 미확인`,
          },
        }
      : s,
  ),
  agent: {
    ...config.agent,
    model: env.OPENAI_MODEL || config.agent.model,
  },
})

const load = async (): Promise<LoadedConfig> => {
  const storage = process.env.DATABASE_URL ? 'postgres' : 'pglite'
  try {
    const db = await getDb()
    await seed(db, seedConfig)
    await applyDemoQaData(db)
    await removeRequestedCommunityPost(db)
    await applyVenueCatalog(db)
    await refreshVenueCatalog(db)
    const { config, issues } = await readConfig(db, seedConfig)
    return { config: withEnv(config), issues, storage }
  } catch (error) {
    const cause = (error as Error & { cause?: unknown }).cause
    console.error(
      '[config] database unavailable, using seed config:',
      (error as Error).message.split('\n')[0],
      cause ?? '',
    )
    return { config: withEnv(seedConfig), issues: [], storage: 'seed-only' }
  }
}

export const getConfig = (): Promise<LoadedConfig> => {
  const now = Date.now()
  if (!cache || now - cache.at > TTL_MS) cache = { at: now, value: load() }
  return cache.value
}

export const invalidateConfig = () => {
  cache = undefined
}
