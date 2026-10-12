import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { mapUrl } from '#/core/links'
import { planner } from '#/core/planner'
import type { TripConfig } from '#/core/schema'
import type { Command, TripState } from '#/core/trip'
import { initialTrip, replay } from '#/core/trip'
import {
  cacheView,
  cachedView,
  currentTripId,
  fetchTrip,
  postEvents,
} from './trip-client'
import { localizeDeep } from '#/i18n/phrases'
import { useI18n } from '#/i18n/react'

/**
 * Classic screens' view of the server-held trip.
 *
 * - The server owns the state. Commands (pure `state → events`) are sent to
 *   `/api/trips/:id`; the reply replaces the local state.
 * - The screen updates at once with the same events folded locally, then
 *   settles on what the server returned.
 * - Requests go out one at a time, in order.
 * - Offline, the last state seen is shown read-only.
 */
export const useTrip = (config: TripConfig) => {
  const id = useMemo(currentTripId, [])
  const [state, setState] = useState<TripState>(
    () => cachedView()?.state ?? initialTrip(config),
  )
  const [online, setOnline] = useState(true)
  const latest = useRef(state)
  latest.current = state
  // The course map links start from; kept current for `run`'s callbacks.
  const courseRef = useRef<string | null>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    fetchTrip(id)
      .then(({ trip }) => {
        cacheView(trip)
        setState(trip.state)
      })
      .catch(() => setOnline(false))
  }, [id])

  const run = useCallback(
    (command: Command) => {
      if (command.events.length) {
        if (!online) {
          toast('서버에 연결되지 않아 바꿀 수 없어요.')
        } else {
          setState((s) => replay(s, command.events))
          queue.current = queue.current.then(() =>
            postEvents(id, command.events)
              .then(({ trip }) => {
                cacheView(trip)
                setState(trip.state)
              })
              .catch(() => {
                setOnline(false)
                toast('서버에 저장하지 못했어요.')
              }),
          )
        }
      }
      if (command.notice) toast(command.notice)
      if (command.open)
        window.open(
          mapUrl(config, courseRef.current)(command.open),
          '_blank',
          'noopener,noreferrer',
        )
    },
    [config, id, online],
  )

  const itinerary = useMemo(
    () => planner(config)(state.plan, state.observations),
    [config, state.plan, state.observations],
  )
  courseRef.current = itinerary.course
  // The planner writes Korean reasons; show them in the runner's language.
  const { locale } = useI18n()
  const shown = useMemo(
    () => localizeDeep(itinerary, locale),
    [itinerary, locale],
  )

  return { state, latest, itinerary: shown, run, online }
}

export type TripStore = ReturnType<typeof useTrip>
