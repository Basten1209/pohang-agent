import type { Itinerary } from './planner'
import type { TripState } from './trip'

/**
 * The conversational stage of a trip, derived from state (never stored).
 * Each stage decides which agent tools exist and what the agent is told.
 */
export type Stage =
  | 'ONBOARDING'
  | 'PRE_RACE'
  | 'CHECK_IN'
  | 'PLANNING'
  | 'JOURNEY'
  | 'SAFETY'
  | 'DONE'

export const stageOf = (s: TripState): Stage => {
  if (!s.created) return 'ONBOARDING'
  if (s.plan.condition === 'UNWELL') return 'SAFETY'
  if (s.plan.stage === 'DONE') return 'DONE'
  if (s.plan.stage !== 'BEFORE') return 'JOURNEY'
  if (s.plan.condition === 'UNANSWERED')
    return s.phase >= 3 ? 'CHECK_IN' : 'PRE_RACE'
  return 'PLANNING'
}

/** Quick replies shown above the composer, per stage. */
export const suggestionsFor: Record<Stage, string[]> = {
  // While details are collected, the open question brings its own chips.
  ONBOARDING: [],
  PRE_RACE: [
    '완주했어요',
    '대회 코스 알려줘',
    '준비물 뭐야?',
    '대회날 날씨 어때?',
  ],
  CHECK_IN: [],
  PLANNING: [
    '이 코스로 갈게요',
    '다른 코스도 보여줘',
    '왜 이 코스야?',
    '카페는 빼 줘',
  ],
  JOURNEY: [
    '버스 언제 와?',
    '근처 맛집 알려줘',
    '30분 더 쉴래요',
    '지금도 시간 괜찮아?',
  ],
  DONE: ['열차 시간표 보여줘'],
  SAFETY: [],
}

/** What the user can report next while travelling (the next-action card). */
export type Progress =
  'ARRIVED' | 'STOP_DONE' | 'SKIP' | 'REST' | 'START_RETURN' | 'AT_STATION'

export const progressOptions = (
  state: TripState,
  it: Itinerary,
): Progress[] => {
  switch (state.plan.stage) {
    case 'OUTBOUND':
      return ['ARRIVED']
    case 'LOCAL':
      return it.stops.length
        ? ['STOP_DONE', 'SKIP', 'REST', 'START_RETURN']
        : ['START_RETURN']
    case 'RETURN':
      return ['AT_STATION']
    default:
      return []
  }
}
