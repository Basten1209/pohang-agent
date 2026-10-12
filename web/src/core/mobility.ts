import type {
  Course,
  HubId,
  Plan,
  TripConfig,
  TransportEstimate,
} from './schema'
import { pointOf } from './links'

export type TravelMode = 'TRANSIT' | 'TAXI' | 'WALK'
export const transportLabel: Record<TravelMode, string> = {
  TRANSIT: '버스',
  TAXI: '택시',
  WALK: '도보',
}
export type LegOption = TransportEstimate & {
  mode: TravelMode
  baseMin: number
  bufferMin: number
  totalMin: number
}
export type TravelLeg = LegOption & {
  id: string
  kind: 'OUTBOUND' | 'WALK' | 'TRANSFER' | 'RETURN'
  from: string
  to: string
  label: string
  start: number
  end: number
  basis: string
  reason: string
  options: LegOption[]
}

const option = (
  mode: TravelMode,
  estimate: TransportEstimate,
  reserve: number,
): LegOption => {
  const baseMin = estimate.rideMin + estimate.waitMin + estimate.walkMin
  const bufferMin = estimate.trafficScope ? reserve : 0
  return {
    ...estimate,
    mode,
    baseMin,
    bufferMin,
    totalMin: baseMin + bufferMin,
  }
}

/** Stable per-route overrides do not leak from one course or hub to another. */
export const legId = (course: Course, from: string, to: string) =>
  `${course.id}:${from}:${to}`

export const roadOptions = (
  course: Course,
  direction: 'OUTBOUND' | 'RETURN',
  hub: HubId,
  reserve: number,
): LegOption[] => {
  const profiles =
    direction === 'OUTBOUND'
      ? course.transport?.outbound
      : course.transport?.return[hub]
  // Missing routes stay missing, even if an obsolete profile remains in the catalogue.
  const legacy =
    direction === 'OUTBOUND'
      ? course.outbound.minutes
      : course.return.minutes[hub]
  if (legacy == null) return []
  if (profiles)
    return (['TRANSIT', 'TAXI'] as const).flatMap((mode) =>
      profiles[mode] ? [option(mode, profiles[mode], reserve)] : [],
    )
  const leg = direction === 'OUTBOUND' ? course.outbound : course.return
  return [
    option(
      'TRANSIT',
      {
        rideMin: Math.max(0, legacy - leg.accessWalk),
        waitMin: 0,
        walkMin: leg.accessWalk,
        via: leg.via,
        trafficScope:
          course.meta[
            direction === 'OUTBOUND' ? 'trafficOutbound' : 'trafficReturn'
          ] === true,
      },
      reserve,
    ),
  ]
}

/** Nearby places use walking, not fabricated intra-neighbourhood bus routes. */
export const localOptions = (
  config: TripConfig,
  course: Course,
  from: string,
  to: string,
  reserve: number,
): LegOption[] => {
  const a = pointOf(config, course.id)(from)
  const b = pointOf(config, course.id)(to)
  let walk = config.policy.local.firstApproach
  if (a && b) {
    const dy = (a.lat - b.lat) * 111_320
    const dx = (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180)
    // Representative area coordinates, 25% detour, 70m/min; no actual pedestrian route claim.
    walk = Math.max(3, Math.ceil((Math.hypot(dx, dy) * 1.25) / 70))
  }
  const options = [
    option(
      'WALK',
      {
        rideMin: 0,
        waitMin: 0,
        walkMin: walk,
        via: '장소 대표 좌표 기준 도보 추정',
        trafficScope: false,
      },
      0,
    ),
  ]
  if (walk >= 8)
    options.push(
      option(
        'TAXI',
        {
          rideMin: Math.max(3, Math.ceil(walk / 4)),
          waitMin: 5,
          walkMin: 2,
          via: '근거리 택시 시연 추정 · 승하차 위치 확인',
          trafficScope: course.id === 'guryongpo',
        },
        reserve,
      ),
    )
  return options
}

export const preferredRoadModes = (
  plan: Plan,
): Array<['TRANSIT' | 'TAXI', 'TRANSIT' | 'TAXI']> =>
  plan.localTransport === 'TRANSIT'
    ? [['TRANSIT', 'TRANSIT']]
    : plan.localTransport === 'TAXI'
      ? [['TAXI', 'TAXI']]
      : plan.condition === 'TIRED' || plan.walkingLimit <= 15
        ? [
            ['TAXI', 'TAXI'],
            ['TRANSIT', 'TAXI'],
            ['TAXI', 'TRANSIT'],
            ['TRANSIT', 'TRANSIT'],
          ]
        : [
            ['TRANSIT', 'TRANSIT'],
            ['TRANSIT', 'TAXI'],
            ['TAXI', 'TRANSIT'],
            ['TAXI', 'TAXI'],
          ]

export const makeLeg = (
  config: TripConfig,
  course: Course,
  plan: Plan,
  from: string,
  to: string,
  kind: TravelLeg['kind'],
  start: number,
  options: LegOption[],
  preferred: TravelMode,
  reason: string,
): TravelLeg | null => {
  const id = legId(course, from, to)
  const override = plan.transportOverrides?.[id]
  const chosen = options.find((o) => o.mode === (override ?? preferred))
  if (!chosen) return null
  const point = pointOf(config, course.id)
  return {
    ...chosen,
    id,
    from,
    to,
    kind: chosen.mode === 'WALK' ? 'WALK' : kind,
    label: `${point(from)?.name ?? from} → ${point(to)?.name ?? to}`,
    start,
    end: start + chosen.totalMin,
    options,
    reason: override ? '이 구간에서 직접 선택한 이동수단이에요.' : reason,
    basis: `${chosen.via} · 시연 추정${chosen.trafficScope ? ' · 구룡포 도로만 혼잡 여유 반영' : ' · 구룡포 혼잡 여유 미적용'}`,
  }
}
