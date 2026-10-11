import type { Monoid } from './fp'
import { foldMap } from './fp'
import type { Observations, Policy, Signal } from './schema'

/**
 * Observation signals → planning effects.
 *
 * Each signal kind has an interpreter (data-directed dispatch). Effects form a
 * monoid, so any number of signals combine by folding: the largest reserve
 * wins, any outdoor block blocks, any uncertainty marks the result partial.
 * Adding a signal (e.g. UV index) is a config entry plus, if the kind is new,
 * one interpreter below.
 */
export type Effect = {
  reserveMin: number
  outdoorBlocked: boolean
  uncertain: boolean
  reasons: string[]
}

export const effectMonoid: Monoid<Effect> = {
  empty: {
    reserveMin: 0,
    outdoorBlocked: false,
    uncertain: false,
    reasons: [],
  },
  concat: (a, b) => ({
    reserveMin: Math.max(a.reserveMin, b.reserveMin),
    outdoorBlocked: a.outdoorBlocked || b.outdoorBlocked,
    uncertain: a.uncertain || b.uncertain,
    reasons: [...a.reasons, ...b.reasons],
  }),
}

/** `{name}` placeholders are filled from `vars`. */
export const fill = (
  template: string,
  vars: Record<string, string | number> = {},
) => template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`))

/** A reading is usable only when fresh and present. Stale or null never becomes 0. */
export const usableReading = (obs: Observations, name: string) =>
  obs.freshness === 'FRESH' &&
  (obs.sources[name]?.freshness ?? 'FRESH') === 'FRESH' &&
  obs.sources[name]?.eligible !== false
    ? (obs.readings[name] ?? null)
    : null

type Interpreter<S extends Signal> = (
  signal: S,
  obs: Observations,
  copy: Policy['copy'],
) => Effect

const reason = (
  text: string | undefined,
  vars?: Record<string, string | number>,
) => (text ? [fill(text, vars)] : [])

const interpreters: {
  [K in Signal['kind']]: Interpreter<Extract<Signal, { kind: K }>>
} = {
  'reserve-by-band': (signal, obs, copy) => {
    const value = usableReading(obs, signal.reading)
    if (value === null)
      return {
        ...effectMonoid.empty,
        uncertain: true,
        reserveMin: signal.unknownReserveMin,
        reasons: signal.unknownReserveMin
          ? reason(copy.reserveUnknown, { reserve: signal.unknownReserveMin })
          : [],
      }
    const band = [...signal.bands]
      .sort((a, b) => b.gte - a.gte)
      .find((b) => value >= b.gte)
    const reserve = band?.reserveMin ?? 0
    return {
      ...effectMonoid.empty,
      reserveMin: reserve,
      reasons: reserve
        ? reason(copy.reserveBand, { label: signal.label, reserve })
        : [],
    }
  },
  'outdoor-limit': (signal, obs, copy) => {
    const value = usableReading(obs, signal.reading)
    if (value === null)
      return {
        ...effectMonoid.empty,
        uncertain: true,
        outdoorBlocked: false,
        reasons: reason(copy.outdoorUnknown),
      }
    return value >= signal.limit
      ? {
          ...effectMonoid.empty,
          outdoorBlocked: true,
          reasons: reason(copy.outdoorLimit, { label: signal.label }),
        }
      : effectMonoid.empty
  },
}

const interpret =
  (obs: Observations, copy: Policy['copy']) =>
  (signal: Signal): Effect => {
    const interpreter = interpreters[signal.kind] as
      Interpreter<Signal> | undefined
    return interpreter ? interpreter(signal, obs, copy) : effectMonoid.empty
  }

/** Fold every configured signal into one effect. */
export const assessSignals = (policy: Policy, obs: Observations): Effect =>
  foldMap(effectMonoid, interpret(obs, policy.copy))(policy.signals)
