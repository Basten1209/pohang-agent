import type { Evidence } from '#/core/evidence'
import { blankEvidence, interpretBody, hourlyAirBody } from '#/core/evidence'
import type { Source, TripConfig } from '#/core/schema'
import { getDb } from '../db/client'
import { latestLiveSnapshot, saveSnapshot } from '../db/repo'

/**
 * The portal shows the key both URL-encoded (`…%2B…%3D`) and decoded.
 * Accept either: `searchParams` encodes it once more on the way out.
 */
export const decodedKey = (key: string) => {
  if (!/%[0-9A-Fa-f]{2}/.test(key)) return key
  try {
    return decodeURIComponent(key)
  } catch {
    return key
  }
}

/**
 * Fetch one configured source. The service key comes only from the server
 * environment and is never logged, returned, or stored.
 */
export const fetchSource = async (
  source: Source,
  env: Record<string, string | undefined> = process.env,
  now = () => Date.now(),
): Promise<Evidence> => {
  const fetchedAt = new Date(now()).toISOString()
  const blank = blankEvidence(source, fetchedAt)
  const key = env.EUM_SERVICE_KEY
  const missing = [
    ...(key ? [] : ['EUM_SERVICE_KEY']),
    ...Object.values(source.params).flatMap((p) =>
      'env' in p && !env[p.env] ? [p.env] : [],
    ),
  ]
  if (!key || missing.length)
    return {
      ...blank,
      status: 'NOT_CONFIGURED',
      message: `설정 필요: ${missing.join(', ')}`,
    }
  const url = new URL(source.url)
  url.searchParams.set('serviceKey', decodedKey(key))
  const date = new Date(now() + 9 * 3600_000).toISOString().slice(0, 10)
  for (const [name, p] of Object.entries(source.params))
    url.searchParams.set(
      name,
      'env' in p ? env[p.env]! : 'clock' in p ? date : p.value,
    )
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(source.timeoutMs),
    })
    if (!response.ok)
      return {
        ...blank,
        status: 'ERROR',
        message:
          response.status === 401
            ? 'E-UM 인증키 확인 필요 · 추천 미반영'
            : `HTTP ${response.status} · 연결 확인 필요`,
      }
    const body: unknown = await response.json()
    return interpretBody(
      source,
      source.id === 'INT_S01_012'
        ? hourlyAirBody(body, date, env.EUM_AIR_DEVICE_ID, now())
        : body,
      fetchedAt,
      now(),
    )
  } catch {
    return {
      ...blank,
      status: 'ERROR',
      message:
        '응답 시간 초과 또는 연결 오류. 시연값으로 실응답을 대체하지 않았어요.',
    }
  }
}

/**
 * Fetch every enabled source, record each attempt as a jsonb snapshot, and
 * fall back to the last successful snapshot (clearly labelled) on failure.
 */
export const observeAll = async (config: TripConfig): Promise<Evidence[]> => {
  const live = await Promise.all(
    config.sources.filter((s) => s.enabled).map((s) => fetchSource(s)),
  )
  const db = await getDb().catch(() => undefined)
  if (!db) return live
  return Promise.all(
    live.map(async (evidence) => {
      await saveSnapshot(db, {
        sourceId: evidence.sourceId,
        status: evidence.status,
        observedAt: evidence.observedAt,
        fetchedAt: evidence.fetchedAt,
        payload: { value: evidence.value, values: evidence.values },
        meta: { message: evidence.message, unit: evidence.unit },
      }).catch(() => undefined)
      if (evidence.status !== 'ERROR') return evidence
      const [last] = await latestLiveSnapshot(db, evidence.sourceId).catch(
        () => [],
      )
      if (!last) return evidence
      const payload = last.payload as {
        value?: number
        values?: Evidence['values']
      }
      return {
        ...evidence,
        status: 'SNAPSHOT' as const,
        observedAt: last.observedAt?.toISOString() ?? null,
        value: payload.value ?? null,
        values: payload.values ?? {},
        freshness: 'STALE' as const,
        message: `실시간 조회 실패 · ${last.fetchedAt.toISOString()}에 저장한 실응답을 표시해요.`,
      }
    }),
  )
}
