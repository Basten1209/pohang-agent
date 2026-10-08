import type { Interest } from './schema'
import { timeSchema } from './schema'

/**
 * Deterministic interpretation of a Korean request, used when no model is
 * configured or when the model call fails. It is deliberately narrow: an
 * ambiguous request becomes CLARIFY instead of a guess.
 *
 * The same predicates also gate the model: questions and comparisons are
 * read-only, so the planning-change tool is not even offered for them.
 */

export type Changes = {
  departTime: string | null
  course: string | null
  walkingLimit: 15 | 30 | null
  extraRestMin: number | null
  excludePlaces: string[] | null
  /** Activities to drop everywhere ("카페는 빼 줘"). */
  dropInterests: Interest[] | null
}

export type Intent =
  | { kind: 'MEDICAL' }
  | { kind: 'CONTEXT' }
  | { kind: 'COMPARE' }
  | { kind: 'REFRESH' }
  | { kind: 'CLARIFY' }
  | { kind: 'CHANGE'; changes: Changes }

export const symptomPattern =
  /어지|메스꺼|통증|아파|아프|몸이\s*안\s*좋|숨이\s*차|가슴이/
const contextPattern = /왜|이유|어째서/
const comparePattern = /택시/
const refreshPattern = /최신|지금도|괜찮아|새로/

export const mentionsSymptom = (message: string) => symptomPattern.test(message)

/** A question asking for information rather than stating trip details. */
export const asksInfo = (message: string) =>
  /\?|알려|뭐|무엇|어디|언제|어떻게|얼마|있어\s*$|있나요|되나요|유명|날씨|맛집|시간표|대회\s*코스/.test(
    message,
  )

/** Questions and comparisons never change the plan. */
export const isReadOnly = (message: string) =>
  contextPattern.test(message) || comparePattern.test(message)

const emptyChanges: Changes = {
  departTime: null,
  course: null,
  walkingLimit: null,
  extraRestMin: null,
  excludePlaces: null,
  dropInterests: null,
}

/** Each extractor reads one constraint; `'CLARIFY'` means the text was ambiguous. */
type Extractor = (message: string) => Partial<Changes> | 'CLARIFY'

const departTime: Extractor = (message) => {
  // 18:30 · 18시 30분 · 18시30분 · 18시 반
  const m = message.match(/(\d{1,2})(?:시\s*(?:(\d{1,2})분|(반))?|:(\d{2}))/)
  if (!m) return {}
  const minute = m[2] ? m[2].padStart(2, '0') : m[3] ? '30' : (m[4] ?? '00')
  let hour = Number(m[1])
  if (hour <= 12 && !/오후|오전/.test(message)) return 'CLARIFY'
  if (/오후/.test(message) && hour < 12) hour += 12
  if (/오전/.test(message) && hour === 12) hour = 0
  const value = `${String(hour).padStart(2, '0')}:${minute}`
  return timeSchema.safeParse(value).success ? { departTime: value } : 'CLARIFY'
}

const dropWords: [RegExp, Interest][] = [
  [/카페|커피/, 'cafe'],
  [/박물관|미술관|전시|실내/, 'indoor'],
  [/산책|골목|구경/, 'walk'],
  [/전망|사진/, 'view'],
]
const dropInterest: Extractor = (message) => {
  if (!/빼|제외|안\s*가|건너|생략/.test(message)) return {}
  const drop = dropWords.flatMap(([re, id]) => (re.test(message) ? [id] : []))
  return drop.length ? { dropInterests: drop } : {}
}

const walking: Extractor = (message) => {
  // 걷다 conjugates irregularly: 걷기, 걸어, 걸을래, 걸으면.
  if (!/걷|걸(?:어|을|으)/.test(message)) return {}
  const m = message.match(/(15|30)분/)
  return m ? { walkingLimit: Number(m[1]) as 15 | 30 } : 'CLARIFY'
}

const rest: Extractor = (message) => {
  if (!/쉬|휴식/.test(message)) return {}
  const m = message.match(/(\d+)분/)
  return m && Number(m[1]) <= 60 ? { extraRestMin: Number(m[1]) } : 'CLARIFY'
}

type CourseName = { id: string; area: string }

/** "호미곶으로 바꿔줘", "다른 데 추천해 줘" → a course change. */
const course =
  (courses: CourseName[]): Extractor =>
  (message) => {
    if (!/바꿔|바꾸|갈래|가고\s*싶|대신|로\s*가/.test(message)) return {}
    if (/추천/.test(message)) return { course: 'auto' }
    const hit = courses.find((c) => message.includes(c.area))
    return hit ? { course: hit.id } : {}
  }

export const interpret = (
  message: string,
  courses: CourseName[] = [],
): Intent => {
  if (mentionsSymptom(message)) return { kind: 'MEDICAL' }
  if (contextPattern.test(message)) return { kind: 'CONTEXT' }
  if (comparePattern.test(message)) return { kind: 'COMPARE' }
  if (refreshPattern.test(message)) return { kind: 'REFRESH' }
  const extractors = [departTime, course(courses), dropInterest, walking, rest]
  const parts = extractors.map((extract) => extract(message))
  if (parts.includes('CLARIFY')) return { kind: 'CLARIFY' }
  const changes = Object.assign({}, emptyChanges, ...parts) as Changes
  return Object.values(changes).some((v) => v !== null)
    ? { kind: 'CHANGE', changes }
    : { kind: 'CLARIFY' }
}
