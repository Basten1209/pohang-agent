import { readingLine } from './live'
import type { Itinerary } from './planner'
import { canTravel } from './planner'
import { courseById, departLabel } from './route'
import type { Interest, Plan, TripConfig } from './schema'
import { duration, minutes } from './time'

/**
 * Plain-language reasons for a plan, built from the itinerary (not from the
 * model): how much time is left, what fits, what was left out and why, and
 * what the observations added. Both the AI and the rule model quote it.
 */

/** 은/는, 이/가 … by the last syllable's final consonant. */
export const josa = (word: string, withFinal: string, without: string) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return `${word}${without}`
  return `${word}${code % 28 ? withFinal : without}`
}

/** "포항역으로", "대회장으로", "구룡포로" (ㄹ-final takes 로). */
export const toward = (word: string) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return `${word}(으)로`
  const final = code % 28
  return `${word}${final && final !== 8 ? '으로' : '로'}`
}

export const interestNoun: Record<Interest, string> = {
  food: '식사',
  walk: '산책',
  view: '전망 장소',
  indoor: '실내 볼거리',
  cafe: '카페',
}

/** Why a place was left out, phrased as a cause. */
const because = (config: TripConfig, reason: string) => {
  const c = config.policy.copy
  if (reason === c.excludedByUser) return '직접 빼 달라고 하셔서'
  if (reason === c.excludedByInterest) return '고른 활동이 아니라서'
  if (reason === c.excludedOutdoor) return '대기 조건 때문에'
  if (reason === c.excludedStairs) return '계단이 있어 지금 컨디션엔 무리라서'
  return '시간이나 걷기 조건이 맞지 않아'
}

export const explainPlan = (
  config: TripConfig,
  plan: Plan,
  it: Itinerary,
  obs?: Parameters<typeof readingLine>[0],
): string => {
  if (!canTravel(it)) return it.reasons.join(' ')
  if (plan.agentPlan)
    return [
      ...it.reasons,
      `계산한 총 보행은 ${it.walking}분, 도착 목표 대비 여유는 ${it.slack}분이에요.`,
    ].join(' ')
  const course = courseById(config, it.course)
  const name = (id: string) =>
    config.places.find((p) => p.id === id)?.attrs.short ?? id
  const left = minutes(plan.departTime) - it.start
  const lines = [
    `${departLabel(config, plan)}까지 ${duration(Math.max(0, left))} 남아 ${course?.area ?? '코스'}에서 ${it.stops.length}곳을 넣었어요.`,
    `걷는 시간은 ${it.walking}분으로 상한 ${plan.walkingLimit}분 안이에요.`,
    ...it.excluded
      .slice(0, 2)
      .map(
        (e) =>
          `${josa(name(e.id), '은', '는')} ${because(config, e.reason)} 뺐어요.`,
      ),
    ...(it.trafficReserve > 0 && obs
      ? [
          `${readingLine(obs, 'congestion', '교통 혼잡', '%')} 기준으로 도로 구간의 여유 합계 ${it.trafficReserve}분을 시간표에 반영했어요.`,
        ]
      : []),
  ]
  return lines.join(' ')
}
