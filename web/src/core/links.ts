import { courseById, isHub } from './route'
import type { AnchorId, TripConfig } from './schema'

type Point = { name: string; lat: number; lng: number }

/**
 * Resolve an anchor (station, race, …), `COURSE` (the course area) or a
 * place id to a named point.
 */
export const pointOf =
  (config: TripConfig, courseId?: string | null) =>
  (target: AnchorId | string): Point | undefined => {
    if (target === 'COURSE') {
      const course = courseById(config, courseId)
      return course ? { name: course.area, ...course.geo } : undefined
    }
    const anchor = config.anchors.find((a) => a.id === target)
    if (anchor) return { name: anchor.name, ...anchor.geo }
    const place = config.places.find((p) => p.id === target)
    return place ? { name: place.attrs.short, ...place.attrs.geo } : undefined
  }

const segment = (p: Point) => `${encodeURIComponent(p.name)},${p.lat},${p.lng}`

/**
 * Kakao Map directions link (`traffic` = public transport). The origin is
 * inferred from where the leg starts: hubs and walks start in the course
 * area, the race and hotel are reached from the station, anything else is
 * reached from the race.
 */
export const mapUrl =
  (config: TripConfig, courseId?: string | null) =>
  (destination: AnchorId | string, mode: 'traffic' | 'walk' = 'traffic') => {
    const at = pointOf(config, courseId)
    const origin =
      isHub(destination) || mode === 'walk'
        ? at('COURSE')
        : destination === 'HOTEL' || destination === 'RACE'
          ? at('STATION')
          : at('RACE')
    const target = at(destination)
    if (!origin || !target) return 'https://map.kakao.com/'
    return `https://map.kakao.com/link/by/${mode}/${segment(origin)}/${segment(target)}`
  }

/** Directions between any two points (used by the agent's route tool). */
export const directionsUrl = (
  from: Point,
  to: Point,
  mode: 'traffic' | 'walk' | 'car' = 'traffic',
) => `https://map.kakao.com/link/by/${mode}/${segment(from)}/${segment(to)}`
