import { seedConfig } from '#/core/defaults'
import type { TripConfig } from '#/core/schema'
import type { ConfigIssue } from '#/core/config'
import { getDb } from './db/client'
import { readConfig, seed } from './db/repo'

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

const withEnv = (config: TripConfig): TripConfig => ({
  ...config,
  agent: {
    ...config.agent,
    model: process.env.OPENAI_MODEL || config.agent.model,
  },
})

const load = async (): Promise<LoadedConfig> => {
  const storage = process.env.DATABASE_URL ? 'postgres' : 'pglite'
  try {
    const db = await getDb()
    await seed(db, seedConfig)
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
