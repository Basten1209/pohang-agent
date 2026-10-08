import type { TripView } from '#/core/view'
import type { TripEvent } from '#/core/trip'

/**
 * The trip lives on the server. This device only remembers which trip is
 * its own (an id in localStorage) and the last view it saw, for offline
 * reading.
 */

const TRIP_KEY = 'run2-trip-id'
const VIEW_KEY = 'run2-trip-view'

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export const currentTripId = (): string =>
  safe(() => {
    const existing = localStorage.getItem(TRIP_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(TRIP_KEY, id)
    return id
  }, crypto.randomUUID())

/** Start over: forget this device's trip. The old one stays on the server. */
export const newTripId = (): string => {
  const id = crypto.randomUUID()
  safe(() => {
    localStorage.setItem(TRIP_KEY, id)
    localStorage.removeItem(VIEW_KEY)
  }, undefined)
  return id
}

export const cachedView = (): TripView | null =>
  safe(
    () =>
      JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null') as TripView | null,
    null,
  )

export const cacheView = (view: TripView) =>
  safe(() => localStorage.setItem(VIEW_KEY, JSON.stringify(view)), undefined)

const call = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return (await res.json()) as T
}

export const fetchTrip = (id: string) =>
  call<{ trip: TripView; messages: unknown[] }>(`/api/trips/${id}`)

export const postEvents = (id: string, events: TripEvent[]) =>
  call<{ trip: TripView }>(`/api/trips/${id}`, {
    method: 'POST',
    body: JSON.stringify({ events }),
  })
