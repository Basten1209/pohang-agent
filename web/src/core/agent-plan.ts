import type { Itinerary } from './planner'
import type { Observations, Plan, TripConfig } from './schema'
import { activeCourses, courseById, hubOf, isHub } from './route'
import { localOptions, makeLeg, roadOptions } from './mobility'
import type { LegOption, TravelLeg, TravelMode } from './mobility'
import { clock, minutes, within } from './time'

/** Preferences affect the recommendation; ordinary visit progress does not. */
export const preferencesKey = (plan: Plan) =>
  JSON.stringify({
    interests: [...plan.interests].sort(),
    condition: plan.condition,
    walkingLimit: plan.walkingLimit,
    departMode: plan.departMode,
    departTime: plan.departTime,
    origin: plan.origin,
    readyTime: plan.readyTime,
  })

/** Poll timestamps do not change the evidence; new readings and observation times do. */
export const observationsKey = (obs: Observations) =>
  JSON.stringify({
    freshness: obs.freshness,
    routeAvailable: obs.routeAvailable,
    readings: Object.entries(obs.readings).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
    sources: Object.entries(obs.sources)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, source]) => [
        id,
        {
          provenance: source.provenance,
          sourceId: source.sourceId ?? null,
          observedAt: source.observedAt ?? null,
          freshness: source.freshness ?? obs.freshness,
          eligible: source.eligible ?? null,
          unit: source.unit ?? null,
          scope: source.scope ?? null,
          value: source.value ?? null,
          note: source.note ?? null,
        },
      ]),
  })

/** Facts and available actions, without a rule-selected recommendation. */
export const planningContext = (
  config: TripConfig,
  plan: Plan,
  obs: Observations,
) => {
  const hub = hubOf(config, plan)
  return {
    revision: plan.revision,
    plan,
    start: clock(
      Math.max(minutes(plan.readyTime), minutes(plan.currentTime)) +
        plan.restMin,
    ),
    arrivalDeadline: clock(minutes(plan.departTime) - hub.mode.bufferMin),
    hub: { id: hub.id, name: hub.name },
    observations: obs,
    observationNote:
      'eligible=false 또는 오래된 값은 현재 상황 판단에 사용하지 않는다. 관측 범위를 지키고 시연값을 실측으로 표현하지 않는다.',
    travelTimeSource:
      'DEMO_POLICY: 아래 시간은 앱의 시연 추정이다. E-UM ETA·실제 요금·배차 정보가 아니다. 혼잡 여유는 아직 더하지 않았다.',
    courses: activeCourses(config).map((course) => {
      const places = config.places.filter(
        (p) => p.active && p.attrs.course === course.id,
      )
      const origins = ['COURSE', ...places.map((p) => p.id)]
      return {
        id: course.id,
        title: course.title,
        description: course.desc,
        outboundWindow: course.outbound.window,
        returnWindow: course.return.window,
        outbound: roadOptions(course, 'OUTBOUND', hub.id, 0),
        return: roadOptions(course, 'RETURN', hub.id, 0),
        places: places.map((p) => ({
          id: p.id,
          name: p.attrs.short,
          description: p.attrs.desc,
          interest: p.attrs.interest,
          outdoor: p.attrs.outdoor,
          stairs: p.attrs.stairs === true,
          suggestedDwell: p.attrs.defaultDwell,
          candidates: p.attrs.candidates ?? [],
          onsiteWalkMin: onsiteWalk(config, course.id, p.id),
          excluded: plan.excluded.includes(p.id),
          completed: plan.completed.includes(p.id),
        })),
        transfers: origins.flatMap((from) =>
          places
            .filter((p) => p.id !== from)
            .map((p) => ({
              from,
              to: p.id,
              options: localOptions(config, course, from, p.id, 0),
            })),
        ),
      }
    }),
    instructions:
      '장소·순서·체류시간·구간 이동수단·구룡포 도로의 추가 여유를 직접 선택해 plan_course.proposal로 제출한다. contextRevision은 revision이다. 서버 검증 오류를 받으면 대안을 수정해 재제출한다. 환경값으로 장소를 자동 제외하거나 피로만으로 택시를 고르는 규칙은 없다. 사용자 의도와 관측 근거를 reasons에 짧게 설명한다.',
  }
}

const onsiteWalk = (config: TripConfig, course: string, place: string) =>
  Math.max(
    0,
    ...(courseById(config, course)?.variants.flatMap((v) =>
      v.stops.filter((s) => s.place === place).map((s) => s.walk),
    ) ?? []),
  )

/** Recompute only arithmetic for the saved choices. Never search for a replacement plan. */
export const evaluateAgentPlan = (
  config: TripConfig,
  plan: Plan,
  obs: Observations,
  base: Itinerary,
): Itinerary => {
  const saved = plan.agentPlan!
  const proposal = saved.proposal
  const course = courseById(config, proposal.course)
  const review =
    saved.observationsKey !== observationsKey(obs) ||
    saved.preferencesKey !== preferencesKey(plan)
  const result: Itinerary = {
    ...base,
    course: proposal.course,
    variant: 'agent',
    alternatives: [],
    planningSource: 'OPENAI',
    needsReview: review,
    reasons: [...proposal.reasons],
  }
  const reject = (...errors: string[]): Itinerary => ({
    ...result,
    decision: 'NEEDS_DATA',
    calculationStatus: 'NEEDS_DATA',
    stops: [],
    legs: [],
    planningArrival: null,
    stationEta: null,
    validationErrors: errors,
    reasons: errors,
  })
  if (!course?.active) return reject('선택한 코스가 현재 제공되지 않아요.')
  if (plan.condition === 'UNWELL')
    return {
      ...result,
      decision: 'MEDICAL_FIRST',
      calculationStatus: 'NOT_RUN',
      reasons: [config.policy.copy.medical],
    }
  if (plan.condition === 'UNANSWERED' || !plan.baggageCollected)
    return {
      ...result,
      decision: 'INCOMPLETE',
      calculationStatus: 'NOT_RUN',
      reasons: [config.policy.copy.incomplete],
    }
  if (isHub(plan.currentPlace) || plan.stage === 'DONE') {
    const at = minutes(plan.currentTime)
    return {
      ...result,
      decision: 'GO',
      calculationStatus: 'READY',
      outbound: 0,
      returnMin: 0,
      stationEta: at,
      planningArrival: at,
      slack: base.stationTarget - at,
      needsReview: false,
    }
  }
  if (!obs.routeAvailable) return reject('현재 경로 자료를 확인할 수 없어요.')
  if (plan.course !== 'auto' && plan.course !== course.id)
    return reject(
      '선택한 권역이 바뀌었어요. 새 권역으로 일정을 다시 제안해 주세요.',
    )
  const ids = proposal.stops.map((s) => s.place)
  if (new Set(ids).size !== ids.length)
    return reject('같은 장소를 중복 방문하는 제안이에요.')
  if (
    ids.some(
      (id) =>
        !config.places.some(
          (p) => p.id === id && p.active && p.attrs.course === course.id,
        ),
    )
  )
    return reject('이 권역에 없는 장소가 포함되어 있어요.')
  const selected =
    plan.stage === 'RETURN'
      ? []
      : proposal.stops.filter(
          (s) =>
            !plan.completed.includes(s.place) &&
            !plan.excluded.includes(s.place),
        )
  if (
    !selected.length &&
    plan.currentPlace !== 'COURSE' &&
    plan.stage !== 'RETURN' &&
    !plan.completed.length
  )
    return reject(
      '출발지에서 바로 귀가하는 경로 자료가 없어요. 길찾기로 직접 귀가 경로를 확인해 주세요.',
    )
  const legs: TravelLeg[] = []
  const stops: Itinerary['stops'] = []
  let cursor = base.start
  let from = plan.completed.at(-1) ?? 'COURSE'
  let outbound = 0
  const add = (
    to: string,
    kind: TravelLeg['kind'],
    options: LegOption[],
    mode: TravelMode,
    reason: string,
  ) => {
    const leg = makeLeg(
      config,
      course,
      plan,
      from,
      to,
      kind,
      cursor,
      options,
      mode,
      reason,
    )
    if (!leg) return false
    legs.push(leg)
    cursor = leg.end
    from = to
    return true
  }
  const roadMode = (mode: 'TRANSIT' | 'TAXI') =>
    plan.localTransport && plan.localTransport !== 'AUTO'
      ? plan.localTransport
      : mode
  const buffer = proposal.trafficBufferMin
  if (
    plan.currentPlace !== 'COURSE' &&
    plan.stage !== 'RETURN' &&
    !plan.completed.length
  ) {
    if (!within(course.outbound.window)(cursor))
      return reject('출발 시각이 등록된 경로의 시간 범위 밖이에요.')
    from = plan.origin
    if (
      !add(
        'COURSE',
        'OUTBOUND',
        roadOptions(course, 'OUTBOUND', base.hub, buffer),
        roadMode(proposal.outboundMode),
        proposal.reasons[0],
      )
    )
      return reject('선택한 출발 이동수단의 경로 자료가 없어요.')
    outbound = legs.at(-1)!.totalMin
  }
  const localStart = cursor
  for (const stop of selected) {
    if (
      !add(
        stop.place,
        'TRANSFER',
        localOptions(config, course, from, stop.place, buffer),
        stop.travelMode,
        stop.reason,
      )
    )
      return reject(
        `${stop.place}까지 선택한 이동수단을 사용할 수 없어요. 제공된 구간 옵션에서 골라 주세요.`,
      )
    stops.push({
      id: stop.place,
      start: cursor,
      end: cursor + stop.dwell,
      dwell: stop.dwell,
    })
    cursor += stop.dwell
  }
  const localMin = cursor - localStart
  const returnDeparture = cursor
  if (!within(course.return.window)(cursor))
    return reject('귀가 출발이 등록된 경로의 시간 범위 밖이에요.')
  if (
    !add(
      base.hub,
      'RETURN',
      roadOptions(course, 'RETURN', base.hub, buffer),
      roadMode(proposal.returnMode),
      proposal.reasons.at(-1)!,
    )
  )
    return reject('선택한 귀가 이동수단의 경로 자료가 없어요.')
  const walking =
    legs.reduce((n, l) => n + l.walkMin, 0) +
    selected.reduce((n, s) => n + onsiteWalk(config, course.id, s.place), 0)
  const errors = []
  if (cursor > base.stationTarget)
    errors.push(
      `도착 목표보다 ${cursor - base.stationTarget}분 늦어요. 체류시간·장소·이동수단을 조정해 주세요.`,
    )
  if (walking > plan.walkingLimit)
    errors.push(
      `총 보행 ${walking}분이 한도 ${plan.walkingLimit}분을 넘어요. 동선을 조정해 주세요.`,
    )
  if (errors.length) return reject(...errors)
  return {
    ...result,
    decision: 'GO',
    calculationStatus: review ? 'PARTIAL' : 'READY',
    stops,
    legs,
    outbound,
    walking,
    localMin,
    returnDeparture,
    returnMin: legs.at(-1)!.totalMin,
    trafficReserve: legs.reduce((n, l) => n + l.bufferMin, 0),
    stationEta: cursor,
    planningArrival: cursor,
    slack: base.stationTarget - cursor,
    reasons: [
      ...proposal.reasons,
      ...(review
        ? [
            '관측이 갱신되었어요. 이전 제안을 유지하며 새 관측에 맞는지 재검토가 필요해요.',
          ]
        : []),
    ],
    excluded: config.places
      .filter(
        (p) =>
          p.active &&
          p.attrs.course === course.id &&
          !ids.includes(p.id) &&
          !plan.completed.includes(p.id),
      )
      .map((p) => ({
        id: p.id,
        reason: plan.excluded.includes(p.id)
          ? '직접 제외한 장소'
          : '에이전트가 이번 일정에서 선택하지 않은 장소',
      })),
  }
}
