import { z } from 'zod'
import type { Choice, Plan, SlotId, TripConfig } from './schema'
import { placeIdSchema, timeSchema } from './schema'
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
    trainTime: timeSchema
      .nullable()
      .describe('서울행 열차 출발 시각 HH:mm (24시간)'),
    interests: z
      .array(placeIdSchema)
      .nullable()
      .describe('완주 후 하고 싶은 장소 id 목록. 관광 없이 바로 간다면 []'),
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
  trainTime: null,
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
  interests: (config) => [
    ...config.places
      .filter((p) => p.active)
      .map((p) => ({
        label: p.attrs.interestLabel,
        say: p.attrs.interestLabel,
        value: p.id,
      })),
  ],
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
  return {
    slot,
    question: spec.question,
    hint: spec.hint,
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
  const active = config.places.filter((p) => p.active).map((p) => p.id)
  const before = state.plan.stage === 'BEFORE'
  return {
    ...(d.trainTime != null && { trainTime: d.trainTime }),
    ...(d.arrivalAt != null && { arrivalAt: d.arrivalAt }),
    ...(d.interests != null && {
      interests: d.interests.filter((id) => active.includes(id)),
      excluded: active.filter((id) => !d.interests!.includes(id)),
    }),
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
  const place = (id: string) =>
    config.places.find((p) => p.id === id)?.attrs.interestLabel ?? id
  const condition = {
    OK: '컨디션 괜찮음',
    TIRED: '조금 지침',
    UNWELL: '몸이 안 좋음',
  }
  return [
    d.trainTime && `${d.trainTime} 열차`,
    d.interests &&
      (d.interests.length
        ? d.interests.map(place).join('·')
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

const interestWords: [RegExp, string][] = [
  [/점심|식사|밥|먹|맛집/, 'food'],
  [/구경|골목|가옥|산책/, 'street'],
  [/카페|커피|디저트/, 'cafe'],
]

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
  ctx: { stage: Stage | string; readyTime: string },
): Details => {
  const d: Details = { ...noDetails }
  const time = hourMinute(text)
  const checkIn = ctx.stage === 'CHECK_IN'

  if (time && !checkIn) {
    // "4시" without 오전/오후 is ambiguous for a train; leave it to a question.
    const explicit = time.h > 12 || /오전|오후|저녁|아침|밤/.test(text)
    if (explicit) d.trainTime = hhmm(time)
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
