import type { TripConfig, Venue } from './schema'

export const courseVenues = (
  config: TripConfig,
  course: string | null,
): Venue[] => {
  if (!config.courses.some((c) => c.id === course && c.active)) return []
  return [
    ...new Map(
      config.places
        .filter((p) => p.active && p.attrs.course === course)
        .flatMap((p) => p.attrs.candidates ?? [])
        .map((v) => [v.id, v]),
    ).values(),
  ]
}

export const venueMapUrl = (venue: Venue): string => {
  if (venue.map?.kind === 'place')
    return `https://map.kakao.com/link/map/${venue.map.id}`
  if (venue.map?.kind === 'coordinate')
    return `https://map.kakao.com/link/map/${encodeURIComponent(venue.name)},${venue.map.lat},${venue.map.lng}`
  // Legacy/operator entries: search a locality and name, never append a full address.
  return `https://map.kakao.com/?q=${encodeURIComponent(`포항 ${venue.address.split(' ')[0]} ${venue.name}`)}`
}
