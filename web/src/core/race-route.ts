export type RoutePoint = [lat: number, lng: number]

/**
 * Illustrative out-and-back near Yeongildae, NOT a surveyed race course.
 * The demo's 10km clock is mapped proportionally onto this sketch. These
 * coordinates are fixture data; we never read or store a device location.
 */
const outbound: RoutePoint[] = [
  [36.0565, 129.378],
  [36.0548, 129.3762],
  [36.0522, 129.3752],
  [36.0494, 129.3741],
  [36.0466, 129.3725],
  [36.0439, 129.3701],
  [36.0415, 129.3691],
  [36.0381, 129.3685],
  [36.0359, 129.3691],
  [36.0331, 129.3705],
  [36.0307, 129.3731],
  [36.0276, 129.3754],
  [36.0249, 129.3782],
  [36.0228, 129.3801],
  [36.0201, 129.3815],
  [36.0176, 129.3826],
]
export const demoRoute: readonly RoutePoint[] = [
  ...outbound,
  ...outbound.slice(0, -1).reverse(),
]

// Local equirectangular lengths suffice for interpolation over this small area.
const lengths = demoRoute.slice(1).map((point, i) => {
  const prev = demoRoute[i]
  const cosLat = Math.cos(((prev[0] + point[0]) / 2) * (Math.PI / 180))
  return Math.hypot(point[0] - prev[0], (point[1] - prev[1]) * cosLat)
})
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
