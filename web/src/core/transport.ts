import type { Itinerary } from './planner'
import { canTravel } from './planner'
import type { Observations, Plan } from './schema'
import { usableReading } from './signals'

export const KAKAO_T_URL =
  'https://service.kakaomobility.com/launch/kakaot/?ref=KM_homepage_a'

/** A preference recommendation, never a taxi ETA or a route guarantee. */
export const recommendTransport = (
  plan: Plan,
  obs: Observations,
  it: Itinerary,
) => {
  if (plan.agentPlan && !canTravel(it))
    return {
      mode: null,
      title: '일정을 다시 검토해요',
      reasons: it.reasons,
      urgent: true,
      congestion: null,
      taxiMinutes: null,
      taxiFare: null,
      url: KAKAO_T_URL,
    }
  const congestion =
    it.legs.some((leg) => leg.trafficScope) || it.course === 'guryongpo'
      ? usableReading(obs, 'congestion')
      : null
  const reasons: string[] = []
  const constrained = plan.condition === 'TIRED' || plan.walkingLimit <= 15
  const urgent =
    it.decision === 'CANCEL' || (it.slack !== null && it.slack < 20)
  const used = new Set(
    it.legs.filter((l) => l.mode !== 'WALK').map((l) => l.mode),
  )
  const mode =
    used.size > 1
      ? ('MIXED' as const)
      : used.has('TAXI')
        ? ('TAXI' as const)
        : used.has('TRANSIT')
          ? ('TRANSIT' as const)
          : constrained || urgent
            ? ('TAXI' as const)
            : ('TRANSIT' as const)
  if (plan.condition === 'UNWELL')
    return {
      mode: null,
      title: '이동보다 현장 도움을 먼저 받아요',
      reasons: ['의료부스나 운영요원에게 도움을 요청해 주세요.'],
      urgent: true,
      congestion,
      taxiMinutes: null,
      taxiFare: null,
      url: KAKAO_T_URL,
    }
  reasons.push(
    plan.agentPlan
      ? plan.agentPlan.proposal.reasons.join(' ')
      : mode === 'MIXED'
        ? '가는 길과 돌아오는 길, 장소 사이의 걷기 부담을 따로 계산해 버스와 택시를 섞었어요.'
        : mode === 'TAXI'
          ? '피로·걷기 한도·귀가 여유와 선택한 조건을 고려한 택시 일정이에요.'
          : '컨디션과 귀가 여유에 맞춰 버스를 우선한 일정이에요.',
  )
  if (congestion !== null && congestion >= 50)
    reasons.push(
      `${obs.sources.congestion?.provenance === 'DEMO' ? '시연 조건의 ' : ''}구룡포 혼잡도 ${congestion}%예요. 버스와 택시 모두 지연될 수 있어요.`,
    )
  if (it.course === 'guryongpo' && congestion === null)
    reasons.push(
      '구룡포의 최신 혼잡도를 확인하지 못했어요. 실제 이동시간을 확인해 주세요.',
    )
  if (urgent)
    reasons.push(
      '귀가까지 시간이 빠듯해요. 관광 추가보다 귀가 경로 확인이 먼저예요.',
    )
  reasons.push(
    '버스·택시 시간은 승차·대기·도보를 나눈 시연 추정이에요. 실제 시간·노선은 지도, 택시 배차·요금은 카카오T에서 확인해 주세요.',
  )
  return {
    mode,
    title: urgent
      ? '귀가 경로부터 확인해요'
      : mode === 'MIXED'
        ? '구간에 맞게 버스와 택시를 섞었어요'
        : mode === 'TAXI'
          ? '걷기를 줄이는 택시를 제안해요'
          : '대중교통을 제안해요',
    reasons,
    urgent,
    congestion,
    taxiMinutes: null,
    taxiFare: null,
    url: KAKAO_T_URL,
  }
}
