import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import { mapUrl } from '#/core/links'
import { planner } from '#/core/planner'
import type { TripConfig } from '#/core/schema'
import type { Command, TripEvent, TripState } from '#/core/trip'
import { initialTrip, replay, tripStateSchema } from '#/core/trip'

/**
 * Client trip store.
 *
 * - State is `replay(state, events)`; the UI dispatches commands (pure
 *   functions returning events), never mutations.
 * - The latest state is kept in localStorage for offline use and expires
 *   after 7 days.
 * - Events are forwarded to the server log in small batches, best effort.
 */

const STATE_KEY = 'run2-guryongpo-v2'
const TRIP_KEY = 'run2-guryongpo-trip'
const TTL_MS = 7 * 86_400_000

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn()
  } catch {
    return fallback
  }
}

const load = (config: TripConfig): TripState =>
  safe(() => {
    const saved = JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null')
    if (!saved || Date.now() - saved.savedAt > TTL_MS)
      return initialTrip(config)
    const parsed = tripStateSchema.safeParse(saved.state)
    return parsed.success ? parsed.data : initialTrip(config)
  }, initialTrip(config))

const tripId = () =>
  safe(() => {
    const existing = localStorage.getItem(TRIP_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(TRIP_KEY, id)
    return id
  }, crypto.randomUUID())

export const useTrip = (config: TripConfig) => {
  const [state, dispatch] = useReducer(replay, config, load)
  const latest = useRef(state)
  latest.current = state
  const outbox = useRef<TripEvent[]>([])
  const [storageOk, setStorageOk] = useState(true)

  useEffect(() => {
    setStorageOk(
      safe(() => {
        localStorage.setItem(
          STATE_KEY,
          JSON.stringify({ state, savedAt: Date.now() }),
        )
        return true
      }, false),
    )
  }, [state])

  // Ship queued events to the server log, best effort.
  useEffect(() => {
    if (!outbox.current.length) return
    const timer = setTimeout(() => {
      const events = outbox.current.splice(0, 50)
      fetch(`/api/trips/${tripId()}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events, state: latest.current }),
        keepalive: true,
      }).catch(() => undefined)
    }, 1500)
    return () => clearTimeout(timer)
  }, [state])

  const run = useCallback(
    (command: Command) => {
      if (command.events.length) {
        outbox.current.push(...command.events)
        dispatch(command.events)
      }
      if (command.notice) toast(command.notice)
      if (command.open)
        window.open(
          mapUrl(config)(command.open),
          '_blank',
          'noopener,noreferrer',
        )
    },
    [config],
  )

  const itinerary = useMemo(
    () => planner(config)(state.plan, state.observations),
    [config, state.plan, state.observations],
  )

  return { state, latest, itinerary, run, storageOk }
}

export type TripStore = ReturnType<typeof useTrip>
