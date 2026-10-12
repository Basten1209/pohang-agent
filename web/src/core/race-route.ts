export type RoutePoint = [lat: number, lng: number]

import { raceOutbound as outbound } from './seed/race-route'

export const demoRoute: readonly RoutePoint[] = [
  ...outbound,
  ...outbound.slice(0, -1).reverse(),
]

export const distanceMeters = (a: RoutePoint, b: RoutePoint): number => {
  const rad = Math.PI / 180
  const h =
    Math.sin(((b[0] - a[0]) * rad) / 2) ** 2 +
    Math.cos(a[0] * rad) *
      Math.cos(b[0] * rad) *
      Math.sin(((b[1] - a[1]) * rad) / 2) ** 2
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}
const lengths = demoRoute
  .slice(1)
  .map((point, i) => distanceMeters(demoRoute[i], point))
export const routeDistanceMeters = lengths.reduce((sum, n) => sum + n, 0)
const length = lengths.reduce((sum, n) => sum + n, 0)

/** The visited polyline and marker always share exactly the same endpoint. */
export const routeAt = (fraction: number) => {
  const progress = Number.isFinite(fraction)
    ? Math.min(1, Math.max(0, fraction))
    : 0
  let remaining = progress * length
  const trail: RoutePoint[] = [demoRoute[0]]
  if (progress === 1) {
    return { trail: [...demoRoute], position: demoRoute[demoRoute.length - 1] }
  }
  for (let i = 0; i < lengths.length; i++) {
    const next = demoRoute[i + 1]
    if (remaining > lengths[i]) {
      trail.push(next)
      remaining -= lengths[i]
      continue
    }
    const prev = demoRoute[i]
    const ratio = remaining / lengths[i]
    const position: RoutePoint = [
      prev[0] + (next[0] - prev[0]) * ratio,
      prev[1] + (next[1] - prev[1]) * ratio,
    ]
    if (ratio > 0) trail.push(position)
    return { trail, position }
  }
  return { trail, position: trail[trail.length - 1] }
}
