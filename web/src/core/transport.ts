import type { Itinerary } from './planner'
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
  const congestion =
    it.legs.some((leg) => leg.bufferMin > 0) || it.course === 'guryongpo'
      ? usableReading(obs, 'congestion')
      : null
  const reasons: string[] = []
  const constrained = plan.condition === 'TIRED' || plan.walkingLimit <= 15
  const urgent =
    it.decision === 'CANCEL' || (it.slack !== null && it.slack < 20)
  const mode = constrained || urgent ? ('TAXI' as const) : ('TRANSIT' as const)
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
  if (constrained)
    reasons.push(
      '완주 후 피로와 걷기 한도를 고려해 환승·도보 부담을 줄이는 택시를 제안해요.',
    )
  else
    reasons.push(
      '현재 컨디션과 걷기 조건으로 대중교통 경로를 먼저 확인해 볼 수 있어요.',
    )
  if (congestion !== null && congestion >= 50)
    reasons.push(
      `구룡포 혼잡도 ${congestion}%예요. 버스와 택시 모두 지연될 수 있어요.`,
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
    '일정의 이동시간은 시연 기준이에요. 택시 시간·요금·배차는 카카오T, 실제 노선은 지도에서 확인해 주세요.',
  )
  return {
    mode,
    title: urgent
      ? '귀가 경로부터 확인해요'
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
