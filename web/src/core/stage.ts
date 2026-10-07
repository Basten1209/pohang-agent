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
  ONBOARDING: ['18시 30분 기차예요', '점심이랑 카페 가고 싶어요'],
  PRE_RACE: ['포항에 도착했어요', '완주했어요'],
  CHECK_IN: [],
  PLANNING: [
    '이 코스로 갈게요',
    '16시 기차로 바뀌었어요',
    '왜 이 코스야?',
    '덜 걷고 싶어요',
  ],
  JOURNEY: ['30분 더 쉴래요', '역까지 택시 타면?', '지금도 시간 괜찮아?'],
  SAFETY: [],
  DONE: [],
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
