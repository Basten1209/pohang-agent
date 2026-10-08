import type { AnchorId, TripConfig } from './schema'

type Point = { name: string; lat: number; lng: number }

/** Resolve an anchor (station, race, …) or a place id to a named point. */
export const pointOf =
  (config: TripConfig) =>
  (target: AnchorId | string): Point | undefined => {
    const anchor = config.anchors.find((a) => a.id === target)
    if (anchor) return { name: anchor.name, ...anchor.geo }
    const place = config.places.find((p) => p.id === target)
    return place ? { name: place.attrs.short, ...place.attrs.geo } : undefined
  }

const segment = (p: Point) => `${encodeURIComponent(p.name)},${p.lat},${p.lng}`

/** Kakao Map directions link. The origin is inferred from where the leg starts. */
export const mapUrl =
  (config: TripConfig) =>
  (destination: AnchorId | string, mode: 'traffic' | 'walk' = 'traffic') => {
    const at = pointOf(config)
    const origin =
      destination === 'STATION' || mode === 'walk'
        ? at('GURYONGPO')
        : destination === 'HOTEL' || destination === 'RACE'
          ? at('STATION')
          : at('RACE')
    const target = at(destination)
    if (!origin || !target) return 'https://map.kakao.com/'
    return `https://map.kakao.com/link/by/${mode}/${segment(origin)}/${segment(target)}`
  }
