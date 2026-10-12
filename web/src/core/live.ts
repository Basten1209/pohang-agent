import type { Evidence } from './evidence'
import type { Observations, ReadingSource, TripConfig } from './schema'
import type { TripEvent } from './trip'

/**
 * Live observations → the plan, as a pure function of the evidence.
 *
 * For each source marked `decision` (today: E-UM traffic congestion), a LIVE
 * and FRESH value replaces the reading the planner uses, recorded as an
 * `observations.patched` event with its provenance. A failed or stale call
 * clears the planning reading while keeping the failed/stale evidence for
 * display. No simulated observation is introduced on a live path. Demo-scenario readings are left alone.
 */
export const liveObservationEvents = (
  config: TripConfig,
  obs: Observations,
  evidence: ReadonlyArray<Evidence>,
): TripEvent[] => {
  const readings: Observations['readings'] = {}
  const sources: Record<string, ReadingSource> = {}
  for (const source of config.sources.filter((s) => s.enabled)) {
    const name = source.reading
    const current = obs.sources[name]
    if (current?.provenance === 'DEMO') continue
    const e = evidence.find((x) => x.sourceId === source.id)
    if (
      source.decision &&
      e?.status === 'LIVE' &&
      e.freshness === 'FRESH' &&
      e.value !== null
    ) {
      if (
        obs.readings[name] === e.value &&
        current?.provenance === 'LIVE' &&
        current.observedAt === e.observedAt
      )
        continue
      readings[name] = e.value
      sources[name] = {
        provenance: 'LIVE',
        sourceId: source.id,
        observedAt: e.observedAt,
        fetchedAt: e.fetchedAt,
        note: null,
        freshness: e.freshness,
        unit: e.unit,
        value: e.value,
        eligible: true,
        scope: String(source.meta.scope ?? '구룡포'),
      }
    } else {
      readings[name] = null
      sources[name] = {
        provenance:
          e?.status === 'LIVE'
            ? 'LIVE'
            : e?.status === 'SNAPSHOT'
              ? 'SNAPSHOT'
              : 'SIMULATED',
        sourceId: source.id,
        observedAt: e?.observedAt ?? null,
        fetchedAt: e?.fetchedAt ?? null,
        note:
          !source.decision && e?.status === 'LIVE'
            ? '단위·장비 검증 전 · 추천 미반영'
            : e?.message || '최신 관측 확인 불가',
        freshness: e?.freshness ?? 'UNKNOWN',
        unit: e?.unit ?? source.unit,
        value: e?.value ?? null,
        eligible: false,
        scope: String(source.meta.scope ?? '구룡포'),
      }
    }
  }
  for (const name of Object.keys(sources)) {
    if (
      obs.readings[name] === readings[name] &&
      JSON.stringify(obs.sources[name]) === JSON.stringify(sources[name])
    ) {
      delete readings[name]
      delete sources[name]
    }
  }
  if (!Object.keys(sources).length) return []
  const merged = { ...obs.sources, ...sources }
  return [
    {
      type: 'observations.patched',
      patch: {
        readings: { ...obs.readings, ...readings },
        sources: merged,
        provenance: Object.values(merged).some((s) => s.provenance === 'LIVE')
          ? 'LIVE'
          : 'SIMULATED',
        observedAt:
          Object.values(merged).find((s) => s.provenance === 'LIVE')
            ?.observedAt ?? null,
      },
    },
  ]
}

/** One line for a reading: value, time and where it came from. */
export const readingLine = (
  obs: Observations,
  name: string,
  label: string,
  unit: string,
) => {
  const value = obs.readings[name]
  const src = obs.sources[name]
  const at = src?.observedAt
    ? new Date(Date.parse(src.observedAt) + 9 * 3600_000)
        .toISOString()
        .slice(11, 16)
    : null
  const origin =
    src?.provenance === 'LIVE' && src.eligible !== false
      ? `${at ?? '시각 미상'} 관측 · LIVE`
      : src?.provenance === 'DEMO'
        ? '시연 조건'
        : src?.note
          ? src.note
          : '시연값'
  return value === null || value === undefined
    ? `${label} 관측 없음 (${origin})`
    : `${label} ${value}${unit} (${origin})`
}
