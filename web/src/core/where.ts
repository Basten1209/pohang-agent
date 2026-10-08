import { courseById } from './route'
import type { Plan, TripConfig } from './schema'
import { AUTO_COURSE } from './schema'

export type Point = { name: string; lat: number; lng: number }

const norm = (s: string) => s.replace(/\s+/g, '').replace(/역$|터미널$/, '')

/**
 * Turn what the agent (or the user) calls a place into coordinates:
 * `HERE` (where the trip is now), an anchor id (STATION, RACE, …), `COURSE`,
 * a course id or area, a place id or name, or a guide note with a location.
 * Returns undefined instead of guessing.
 */
export const resolvePoint = (
  config: TripConfig,
  plan: Plan,
  name: string,
  courseId: string | null = plan.course === AUTO_COURSE ? null : plan.course,
): Point | undefined => {
  const raw = name.trim()
  if (!raw) return undefined
  if (raw.toUpperCase() === 'HERE')
    return resolvePoint(config, plan, plan.currentPlace, courseId)
  if (raw.toUpperCase() === 'COURSE') {
    const c = courseById(config, courseId)
    return c ? { name: c.area, ...c.geo } : undefined
  }
  const anchor = config.anchors.find(
    (a) => a.id === raw.toUpperCase() || norm(a.name) === norm(raw),
  )
  if (anchor) return { name: anchor.name, ...anchor.geo }
  const course = config.courses.find(
    (c) => c.id === raw || norm(c.area) === norm(raw) || c.title === raw,
  )
  if (course) return { name: course.area, ...course.geo }
  const place = config.places.find(
    (p) =>
      p.id === raw ||
      norm(p.attrs.short) === norm(raw) ||
      norm(p.attrs.short).includes(norm(raw)),
  )
  if (place) return { name: place.attrs.short, ...place.attrs.geo }
  const note = config.guide.find(
    (g) => g.geo && (norm(g.title).includes(norm(raw)) || g.tags.includes(raw)),
  )
  if (note?.geo) return { name: note.title, ...note.geo }
  return undefined
}

/** Names the agent can pass to location tools, for tool descriptions. */
export const knownPointNames = (config: TripConfig) => [
  'HERE',
  'COURSE',
  ...config.anchors.map((a) => a.name),
  ...config.courses.filter((c) => c.active).map((c) => c.area),
  ...config.places.filter((p) => p.active).map((p) => p.attrs.short),
]
