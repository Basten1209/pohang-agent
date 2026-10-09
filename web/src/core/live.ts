import type { Evidence } from './evidence'
import type { Observations, ReadingSource, TripConfig } from './schema'
import type { TripEvent } from './trip'

/**
 * Live observations → the plan, as a pure function of the evidence.
 *
 * For each source marked `decision` (today: E-UM traffic congestion), a LIVE
 * and FRESH value replaces the reading the planner uses, recorded as an
 * `observations.patched` event with its provenance. A failed or stale call
 * puts a previously live reading back to the simulated default, so an old
 * value is never presented as current. Demo-scenario readings are left alone.
 */
export const liveObservationEvents = (
  config: TripConfig,
  obs: Observations,
  evidence: ReadonlyArray<Evidence>,
): TripEvent[] => {
  const readings: Observations['readings'] = {}
  const sources: Record<string, ReadingSource> = {}
  for (const source of config.sources.filter((s) => s.enabled && s.decision)) {
    const name = source.reading
    const current = obs.sources[name]
    if (current?.provenance === 'DEMO') continue
    const e = evidence.find((x) => x.sourceId === source.id)
    if (e?.status === 'LIVE' && e.freshness === 'FRESH' && e.value !== null) {
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
      }
    } else if (current?.provenance === 'LIVE') {
      readings[name] = config.defaults.observations.readings[name] ?? null
      sources[name] = {
        provenance: 'SIMULATED',
        sourceId: source.id,
        observedAt: null,
        fetchedAt: e?.fetchedAt ?? null,
        note: '최신 관측 확인 불가',
      }
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
    src?.provenance === 'LIVE'
      ? `${at ?? '시각 미상'} 관측 · LIVE`
      : src?.provenance === 'DEMO'
        ? '시연 조건'
        : src?.note
          ? `${src.note} · 시연값`
          : '시연값'
  return value === null || value === undefined
    ? `${label} 관측 없음 (${origin})`
    : `${label} ${value}${unit} (${origin})`
}
