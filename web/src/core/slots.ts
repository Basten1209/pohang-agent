import { z } from 'zod'
import { activeCourses, courseById, modeOf } from './route'
import type { Choice, Interest, Plan, SlotId, TripConfig } from './schema'
import {
  AUTO_COURSE,
  courseIdSchema,
  departModeSchema,
  interestSchema,
  timeSchema,
} from './schema'
import { fill } from './signals'
import type { Stage } from './stage'
import { stageOf } from './stage'
import { clock, minutes } from './time'
import type { TripEvent, TripState } from './trip'

/**
 * Slot filling: the chat asks for trip details one question at a time.
 *
 *   pendingSlot   state → the next unanswered question (or null)
 *   promptFor     state → that question with its reply chips
 *   fillSlots     state, details → events (pure)
 *
 * Questions, order and fixed chips are config (`conversation`, jsonb).
 * Chips that depend on the trip (places, ready times) are computed here.
 */

/** Every detail the chat can collect; `null` = not mentioned. */
export const detailsSchema = z
  .object({
    departMode: departModeSchema
      .nullable()
      .describe(
        '포항을 떠나는 방법: TRAIN(기차) BUS(고속·시외버스) FLIGHT(비행기) CAR(자가용) LOCAL(포항 주민)',
      ),
    departTime: timeSchema
      .nullable()
      .describe(
        '열차·버스·비행기 출발 시각, 자가용은 출발 시각, 주민은 돌아올 시각. HH:mm (24시간)',
      ),
    course: courseIdSchema
      .nullable()
      .describe('가고 싶은 코스 id. 추천을 원하면 auto'),
    interests: z
      .array(interestSchema)
      .nullable()
      .describe(
        '하고 싶은 활동: food(식사) walk(산책·골목) view(바다 전망·사진) indoor(실내 볼거리) cafe(카페). 관광 없이 바로 간다면 []',
      ),
    origin: z
      .enum(['RACE', 'HOTEL'])
      .nullable()
      .describe(
        '관광 출발 장소: 대회장에서 바로(RACE) 또는 숙소에 들렀다(HOTEL)',
      ),
    arrivalAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
      .nullable()
      .describe('포항 도착 일시 YYYY-MM-DDTHH:mm'),
    readyTime: timeSchema
      .nullable()
      .describe('완주 후 출발 준비가 끝나는 시각 HH:mm'),
    condition: z
      .enum(['OK', 'TIRED', 'UNWELL'])
      .nullable()
      .describe('완주 후 컨디션'),
    walkingLimit: z
      .union([z.literal(15), z.literal(30)])
      .nullable()
      .describe('걷기 상한(분)'),
    baggageCollected: z
      .boolean()
      .nullable()
      .describe('출발 전에 짐을 챙길 수 있는지'),
  })
  .strict()
export type Details = z.infer<typeof detailsSchema>

export const noDetails: Details = {
  departMode: null,
  departTime: null,
  course: null,
  interests: null,
  origin: null,
  arrivalAt: null,
  readyTime: null,
  condition: null,
  walkingLimit: null,
  baggageCollected: null,
}

const askedIn: Partial<Record<Stage, 'onboarding' | 'checkIn'>> = {
  ONBOARDING: 'onboarding',
  CHECK_IN: 'checkIn',
}

/** The next question the chat should ask, if any. */
export const pendingSlot = (
  config: TripConfig,
  state: TripState,
): SlotId | null => {
  const list = askedIn[stageOf(state)]
  if (!list) return null
  return (
    config.conversation[list].find((id) => !state.answered.includes(id)) ?? null
  )
}

export type ChoicePrompt = {
  slot: SlotId
  question: string
  hint: string
  multiple: boolean
  choices: Choice[]
}

/** Chips computed from the trip, for slots whose options are not fixed. */
const dynamicChoices: Partial<
  Record<SlotId, (config: TripConfig, state: TripState) => Choice[]>
> = {
  departMode: (config) =>
    config.modes.map((m) => ({ label: m.label, say: m.say, value: m.id })),
  departTime: (config, state) => {
    const mode = modeOf(config, state.plan)
    return [
      ...mode.times.map((t) => ({
        label: t,
        say: `${t} ${mode.noun}예요`,
        value: t,
      })),
      {
        label: '아직 몰라요',
        say: '아직 몰라요',
        value: null,
        reply: fill(mode.unknownReply, { time: state.plan.departTime }),
      },
    ]
  },
  course: (config) =>
    activeCourses(config).map((c) => ({
      label: c.title,
      say: `${c.area} 가 보고 싶어요`,
      value: c.id,
    })),
  readyTime: (_config, state) => {
    const at = (offset: number) => clock(minutes(state.plan.readyTime) + offset)
    return [
      {
        label: `지금 바로 (${at(0)})`,
        say: '지금 바로 출발할 수 있어요',
        value: at(0),
      },
      {
        label: `30분 쉬고 (${at(30)})`,
        say: '30분 쉬고 갈게요',
        value: at(30),
      },
      {
        label: `1시간 쉬고 (${at(60)})`,
        say: '1시간 쉬고 갈게요',
        value: at(60),
      },
    ]
  },
}

export const promptFor = (
  config: TripConfig,
  state: TripState,
  slot: SlotId | null = pendingSlot(config, state),
): ChoicePrompt | null => {
  const spec = slot && config.conversation.slots[slot]
  if (!slot || !spec) return null
  // The time question is worded for the way home ("몇 시 열차", "몇 시까지").
  const mode = slot === 'departTime' ? modeOf(config, state.plan) : null
  return {
    slot,
    question: mode?.question ?? spec.question,
    hint: mode?.hint ?? spec.hint,
    multiple: spec.multiple,
    choices: [
      ...(dynamicChoices[slot]?.(config, state) ?? []),
      ...spec.choices,
    ],
  }
}

/** Validate one chip answer for a slot. Arrays come from multiple-choice chips. */
export const choiceValue = (
  slot: SlotId,
  value: unknown,
): { ok: true; details: Partial<Details> } | { ok: false } => {
  if (value === null) return { ok: true, details: {} }
  const parsed = detailsSchema.shape[slot].safeParse(value)
  return parsed.success && parsed.data !== null
    ? { ok: true, details: { [slot]: parsed.data } }
    : { ok: false }
}

/** Pure: details → the plan patch they imply. */
const toPatch = (
  config: TripConfig,
  state: TripState,
  d: Partial<Details>,
): Partial<Plan> => {
  const before = state.plan.stage === 'BEFORE'
  const course =
    d.course === AUTO_COURSE || courseById(config, d.course) ? d.course : null
  return {
    ...(d.departMode != null && { departMode: d.departMode }),
    ...(d.departTime != null && { departTime: d.departTime }),
    ...(course != null && before && { course }),
    ...(d.arrivalAt != null && { arrivalAt: d.arrivalAt }),
    ...(d.interests != null && { interests: [...new Set(d.interests)] }),
    ...(d.origin != null && {
      origin: d.origin,
      ...(before && { currentPlace: d.origin }),
    }),
    ...(d.readyTime != null && {
      readyTime: d.readyTime,
      ...(before && { currentTime: d.readyTime }),
    }),
    ...(d.condition != null && { condition: d.condition }),
    ...(d.walkingLimit != null && { walkingLimit: d.walkingLimit }),
    ...(d.baggageCollected != null && { baggageCollected: d.baggageCollected }),
  }
}

/**
 * Pure: record answers. `slots` lists what was answered (a chip answered
 * with "모르겠어요" is answered but changes nothing). Creates the trip once
 * every onboarding question is answered, and marks the race finished once
 * the condition is known.
 */
export const fillSlots = (
  config: TripConfig,
  state: TripState,
  details: Partial<Details>,
  slots: SlotId[] = (Object.keys(details) as SlotId[]).filter(
    (k) => details[k] !== null && details[k] !== undefined,
  ),
): TripEvent[] => {
  if (!slots.length) return []
  const patch = toPatch(config, state, details)
  const answered = [...state.answered, ...slots]
  const onboarded = config.conversation.onboarding.every((id) =>
    answered.includes(id),
  )
  return [
    { type: 'slots.filled', patch, slots },
    ...(!state.created && onboarded ? [{ type: 'trip.created' as const }] : []),
    ...(patch.condition && state.phase < 3
      ? [{ type: 'day.advanced' as const, phase: 3 }]
      : []),
  ]
}

/** Short Korean labels of what was saved, for the reply. */
export const describeDetails = (
  config: TripConfig,
  d: Partial<Details>,
): string[] => {
  const interest = (id: string) =>
    config.conversation.slots.interests?.choices.find((c) => c.value === id)
      ?.label ?? id
  const mode = d.departMode && config.modes.find((m) => m.id === d.departMode)
  const course =
    d.course === AUTO_COURSE
      ? '코스는 추천으로'
      : d.course && courseById(config, d.course)?.title
  const condition = {
    OK: '컨디션 괜찮음',
    TIRED: '조금 지침',
    UNWELL: '몸이 안 좋음',
  }
  return [
    mode && mode.label,
    d.departTime &&
      `${d.departTime} ${(mode || modeOf(config, { departMode: 'TRAIN' })).noun}`,
    course,
    d.interests &&
      (d.interests.length
        ? d.interests.map(interest).join('·')
        : '관광 없이 귀가'),
    d.origin &&
      (d.origin === 'RACE' ? '대회장에서 바로 출발' : '숙소 들렀다 출발'),
    d.arrivalAt &&
      `${d.arrivalAt.slice(5, 10).replace('-', '/')} ${d.arrivalAt.slice(11)} 도착`,
    d.readyTime && `${d.readyTime} 출발 준비`,
    d.condition && condition[d.condition],
    d.walkingLimit && `걷기 ${d.walkingLimit}분 이내`,
    d.baggageCollected != null && (d.baggageCollected ? '짐 챙김' : '짐 아직'),
  ].filter((x): x is string => typeof x === 'string')
}

// ── Reading details from free text (rule-based interpreter) ─────────────

const interestWords: [RegExp, Interest][] = [
  [/점심|식사|밥|먹|맛집|맛있|한\s*끼|물회|회\s/, 'food'],
  [/구경|골목|가옥|산책|걷/, 'walk'],
  [/바다|전망|사진|풍경|뷰/, 'view'],
  [/실내|박물관|미술관|전시/, 'indoor'],
  [/카페|커피|디저트/, 'cafe'],
]

const modeWords: [RegExp, Details['departMode']][] = [
  [/포항\s*(?:에\s*)?(?:살|주민|사람)|집이\s*포항|현지인/, 'LOCAL'],
  [/비행기|공항|항공|김포|제주/, 'FLIGHT'],
  [/버스|터미널/, 'BUS'],
  // Before CAR: "기차를", "열차로" also end in 차.
  [/기차|열차|KTX|SRT|ktx|srt|코레일/, 'TRAIN'],
  [/자가용|운전|차\s*(?:로|를|가지고|가져)|주차/, 'CAR'],
]

/** Course words, read from config so new courses need no code. */
const courseIn = (
  text: string,
  courses: { id: string; area: string; title: string }[],
) =>
  /추천|알아서|아무\s*데|골라/.test(text)
    ? AUTO_COURSE
    : (courses.find(
        (c) => text.includes(c.area) || text.includes(c.title.split('·')[0]),
      )?.id ?? null)

const hourMinute = (text: string): { h: number; m: number } | null => {
  const m = text.match(/(\d{1,2})(?:시\s*(?:(\d{1,2})분|(반))?|:(\d{2}))/)
  if (!m) return null
  let h = Number(m[1])
  if (/오후|저녁|밤/.test(text) && h < 12) h += 12
  const min = m[2] ? Number(m[2]) : m[3] ? 30 : m[4] ? Number(m[4]) : 0
  return h <= 23 && min <= 59 ? { h, m: min } : null
}
const hhmm = ({ h, m }: { h: number; m: number }) =>
  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

/**
 * What a sentence says about the trip, read with simple rules. Used by the
 * rule-based model; a real model fills the same schema itself.
 */
export const detailsFromText = (
  text: string,
  ctx: {
    stage: Stage | string
    readyTime: string
    courses?: { id: string; area: string; title: string }[]
  },
): Details => {
  const d: Details = { ...noDetails }
  const time = hourMinute(text)
  const checkIn = ctx.stage === 'CHECK_IN'

  if (time && !checkIn) {
    // "4시" without 오전/오후 is ambiguous for a train; leave it to a question.
    const explicit = time.h > 12 || /오전|오후|저녁|아침|밤/.test(text)
    if (explicit) d.departTime = hhmm(time)
  }
  if (checkIn) {
    if (time) d.readyTime = hhmm(time)
    const rest = text.match(/(\d+)\s*분\s*(?:뒤|후|쉬|있다)/)
    if (rest) d.readyTime = clock(minutes(ctx.readyTime) + Number(rest[1]))
    else if (/한\s*시간|1시간/.test(text))
      d.readyTime = clock(minutes(ctx.readyTime) + 60)
    else if (/지금|바로/.test(text)) d.readyTime = ctx.readyTime
    if (/괜찮|멀쩡|쌩쌩|좋아요|좋아/.test(text)) d.condition = 'OK'
    if (/지쳤|지쳐|피곤|힘들/.test(text)) d.condition = 'TIRED'
    if (/아파|안\s*좋|불편/.test(text)) d.condition = 'UNWELL'
  }

  if (!checkIn) {
    d.departMode = modeWords.find(([re]) => re.test(text))?.[1] ?? null
    d.course = courseIn(text, ctx.courses ?? [])
    if (/바로\s*(귀가|집|서울)|관광\s*(안|없이)/.test(text)) d.interests = []
    else if (/다\s*좋|전부|모두/.test(text))
      d.interests = interestWords.map(([, id]) => id)
    else {
      const picked = interestWords.flatMap(([re, id]) =>
        re.test(text) ? [id] : [],
      )
      if (picked.length) d.interests = picked
    }
    if (/숙소|호텔/.test(text)) d.origin = 'HOTEL'
    else if (/대회장/.test(text)) d.origin = 'RACE'
  }

  if (/걷|걸(?:어|을|으)/.test(text)) {
    const w = text.match(/(15|30)\s*분/)
    if (w) d.walkingLimit = Number(w[1]) as 15 | 30
  }
  if (/짐/.test(text)) {
    if (/아직|못|안\s*챙/.test(text)) d.baggageCollected = false
    else if (/챙|찾았|있어/.test(text)) d.baggageCollected = true
  }
  return d
}
