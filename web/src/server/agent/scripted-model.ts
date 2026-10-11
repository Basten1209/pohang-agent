import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Prompt,
  LanguageModelV4StreamPart,
} from '@ai-sdk/provider'
import { asksInfo, interpret } from '#/core/intents'
import { detailsFromText } from '#/core/slots'

/**
 * A rule-based language model.
 *
 * It implements the same `LanguageModelV4` interface as OpenAI, so it runs
 * inside the very same agent loop: same tools, same stage gating, same
 * approvals, same UI. It is used when no API key is configured, when the
 * provider fails, and for safety turns where no model should be called.
 *
 * It reads the conversation the way a model would — the system prompt's
 * `stage:` line, the last user text, the last tool results — and replies
 * with one text block and/or one tool call.
 */

type Json = Record<string, unknown>
type Reply = { text?: string; call?: { name: string; input: Json } }

const usage = {
  inputTokens: {
    total: 0,
    noCache: 0,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
}

const toStream = (reply: Reply): ReadableStream<LanguageModelV4StreamPart> => {
  const parts: LanguageModelV4StreamPart[] = [
    { type: 'stream-start', warnings: [] },
  ]
  if (reply.text)
    parts.push(
      { type: 'text-start', id: 'r0' },
      { type: 'text-delta', id: 'r0', delta: reply.text },
      { type: 'text-end', id: 'r0' },
    )
  if (reply.call)
    parts.push({
      type: 'tool-call',
      toolCallId: `rule_${crypto.randomUUID()}`,
      toolName: reply.call.name,
      input: JSON.stringify(reply.call.input),
    })
  parts.push({
    type: 'finish',
    finishReason: {
      unified: reply.call ? 'tool-calls' : 'stop',
      raw: undefined,
    },
    usage,
  })
  return new ReadableStream({
    start(controller) {
      parts.forEach((p) => controller.enqueue(p))
      controller.close()
    },
  })
}

// ── Reading the prompt ──────────────────────────────────────────────────

const systemText = (prompt: LanguageModelV4Prompt) =>
  prompt.flatMap((m) => (m.role === 'system' ? [m.content] : [])).join('\n')

const stageIn = (prompt: LanguageModelV4Prompt) =>
  systemText(prompt).match(/stage: ([A-Z_]+)/)?.[1] ?? ''

const lastUserText = (prompt: LanguageModelV4Prompt) => {
  for (let i = prompt.length - 1; i >= 0; i--) {
    const m = prompt[i]
    if (m.role === 'user')
      return m.content
        .flatMap((c) => (c.type === 'text' ? [c.text] : []))
        .join(' ')
  }
  return ''
}

type ToolResult = { toolName: string; value: Json | null; denied: boolean }

/** Tool results of the trailing tool message, if the prompt ends with one. */
const trailingResults = (prompt: LanguageModelV4Prompt): ToolResult[] => {
  const last = prompt.at(-1)
  if (!last || last.role !== 'tool') return []
  return last.content.flatMap((c) =>
    c.type !== 'tool-result'
      ? []
      : [
          {
            toolName: c.toolName,
            denied: c.output.type === 'execution-denied',
            value:
              c.output.type === 'json' &&
              c.output.value &&
              typeof c.output.value === 'object'
                ? (c.output.value as Json)
                : null,
          },
        ],
  )
}

// ── Deciding ────────────────────────────────────────────────────────────

/** What the user said about the trip, read with the shared rule-based reader. */
const detailsIn = (text: string, prompt: LanguageModelV4Prompt): Json => {
  const system = systemText(prompt)
  const readyTime = system.match(/준비 시각: (\d{2}:\d{2})/)?.[1] ?? '10:40'
  const d = detailsFromText(text, {
    stage: stageIn(prompt),
    readyTime,
    courses: coursesIn(prompt),
  })
  // "카페도" adds to what was already chosen.
  const before =
    system.match(/하고 싶은 일: ([a-z, ]+) ·/)?.[1]?.split(', ') ?? []
  if (Array.isArray(d.interests) && d.interests.length && /도\s|도$/.test(text))
    d.interests = [
      ...new Set([...(before as typeof d.interests), ...d.interests]),
    ]
  return d
}
const saysSomething = (d: Json) => Object.values(d).some((v) => v !== null)

/** `코스 id: guryongpo=구룡포, …` from the snapshot. */
const coursesIn = (prompt: LanguageModelV4Prompt) =>
  (systemText(prompt).match(/코스 id: ([^\n]+)/)?.[1] ?? '')
    .split(', ')
    .map((pair) => pair.split('='))
    .filter((p) => p.length === 2)
    .map(([id, area]) => ({ id, area, title: area }))

const raceTopic = (text: string) =>
  /코스|경로|반환|급수/.test(text)
    ? 'course'
    : /준비물|챙겨|배번|기록칩/.test(text)
      ? 'kit'
      : /일정|시간표|몇\s*시|시상/.test(text)
        ? 'schedule'
        : /화장실|탈의|물품|보관|시설|의료/.test(text)
          ? 'facilities'
          : /셔틀|주차|통제|규정|이어폰/.test(text)
            ? 'rules'
            : 'overview'

/** Where a sentence points, from the course areas and a few well-known names. */
const placeIn = (text: string, prompt: LanguageModelV4Prompt) =>
  [
    ...coursesIn(prompt).map((c) => c.area),
    '포항역',
    '버스터미널',
    '터미널',
    '공항',
    '영일대',
    '대회장',
  ].find((n) => text.includes(n)) ?? null

/** An information question → the lookup tool that answers it. */
const infoCall = (
  text: string,
  stage: string,
  prompt: LanguageModelV4Prompt,
  has: (n: string) => boolean,
): Reply | null => {
  const pick = (name: string, input: Json): Reply | null =>
    has(name) ? { call: { name, input } } : null
  // "다른 코스" compares; "…로 바꿔 줘" changes (handled by plan_course).
  if (
    /다른\s*(코스|데|곳)|코스\s*비교|어디가\s*(제일|더)/.test(text) &&
    !/바꿔|바꾸/.test(text)
  )
    return pick('compare_courses', {})
  // Plan questions (why, taxi, still ok?) have their own tools.
  if (!asksInfo(text) || /왜|이유|택시|지금도|최신|이 코스로|갈게/.test(text))
    return null
  const where = placeIn(text, prompt)
  // Before the race, "코스" means the race course.
  const raceCourse =
    /코스/.test(text) && (stage === 'ONBOARDING' || stage === 'PRE_RACE')
  // Weather first: "대회날 날씨" is a weather question, not a race one.
  if (/날씨|비\s*(와|오)|바람|기온|추워|더워|예보/.test(text))
    return pick('get_weather', {
      near: where,
      date: /대회\s*날|대회일|당일/.test(text)
        ? (systemText(prompt).match(/대회일: (\d{4}-\d{2}-\d{2})/)?.[1] ?? null)
        : null,
    })
  if (
    raceCourse ||
    /대회|레이스|배번|급수|셔틀|준비물|물품보관|출발\s*시간|제한\s*시간/.test(
      text,
    )
  )
    return pick('get_race_info', { topic: raceTopic(text) })
  if (
    /기차|열차|KTX|SRT|ktx|srt/.test(text) &&
    /시간|몇\s*시|있어|막차/.test(text)
  )
    return pick('get_train_times', {
      from: null,
      to:
        text.match(/(서울|동대구|대구|부산|대전|수서|경주|울산)/)?.[1] ??
        '서울',
      date: null,
      after: null,
    })
  if (/언제\s*와|도착\s*정보|정류장/.test(text))
    return pick('get_bus_arrivals', { near: where ?? 'HERE' })
  if (/버스|어떻게\s*가|가는\s*(법|길)|길찾|얼마나\s*걸/.test(text))
    return pick('get_directions', { from: null, to: where ?? 'COURSE' })
  if (/맛집|식당|먹을\s*곳|카페|숙소|근처|주변/.test(text))
    return pick('find_nearby', {
      near: where ?? 'COURSE',
      type: /숙소/.test(text)
        ? 'stay'
        : /맛집|식당|먹|카페/.test(text)
          ? 'food'
          : null,
      keyword: null,
      radiusM: null,
    })
  return pick('search_guide', { query: text.slice(0, 60) })
}

/** One line per result list, for the rule-based reply. */
const listed = (rows: unknown[], f: (r: Json) => string, n = 4) =>
  rows
    .slice(0, n)
    .map((r) => `- ${f(r as Json)}`)
    .join('\n')

const defaultInput = (
  name: string,
  text: string,
  prompt: LanguageModelV4Prompt,
): Json => {
  if (name === 'update_trip_details') return detailsIn(text, prompt)
  if (name === 'plan_course') return { changes: null }
  if (name === 'explain_plan') return { topic: 'why_course' }
  return {}
}

const describePlan = (v: Json) => {
  const reasons = Array.isArray(v.reasons)
    ? (v.reasons as string[]).join(' ')
    : ''
  const arrival = v.planningArrival
    ? ` 계획상 ${v.hub ?? '도착지'} 도착은 ${v.planningArrival}이에요.`
    : ''
  return `${reasons}${arrival}`.trim()
}

const demoScenario = (text: string) =>
  [
    [/혼잡/, 'traffic'],
    [/대기|미세/, 'air'],
    [/지연|늦/, 'cancel'],
    [/누락|경로/, 'missing'],
    [/오래|stale/i, 'stale'],
    [/16|귀가/, 'early'],
    [/기본/, 'base'],
  ].find(([re]) => (re as RegExp).test(text))?.[1] as string | undefined

const decideFromText = (
  text: string,
  stage: string,
  has: (n: string) => boolean,
  details: Json,
  prompt: LanguageModelV4Prompt,
): Reply => {
  if (text.startsWith('/시연')) {
    const scenario = demoScenario(text)
    return scenario && has('set_demo_observation')
      ? { call: { name: 'set_demo_observation', input: { scenario } } }
      : {
          text: '시연 명령: /시연 기본 · 16시 · 혼잡 · 대기 · 지연 · 누락 · 오래된 관측',
        }
  }
  const info = infoCall(text, stage, prompt, has)
  if (info && stage !== 'SAFETY') return info
  if (stage === 'PRE_RACE') {
    if (/완주|다 뛰|끝났/.test(text))
      return {
        call: {
          name: 'record_race_progress',
          input: { milestone: 'FINISHED' },
        },
      }
    if (/도착/.test(text))
      return {
        call: {
          name: 'record_race_progress',
          input: { milestone: 'ARRIVED_POHANG' },
        },
      }
    if (/준비|출발/.test(text))
      return {
        call: { name: 'record_race_progress', input: { milestone: 'READY' } },
      }
    if (has('update_trip_details') && saysSomething(details))
      return { call: { name: 'update_trip_details', input: details } }
    return { text: '대회 전이에요. 포항에 도착하거나 완주하면 알려주세요.' }
  }
  if (stage === 'ONBOARDING' || stage === 'CHECK_IN')
    return has('update_trip_details') && saysSomething(details)
      ? { call: { name: 'update_trip_details', input: details } }
      : { text: '알겠어요.' }
  if (stage === 'PLANNING' || stage === 'JOURNEY') {
    if (/이 코스로|갈게|출발할게/.test(text) && has('start_journey'))
      return { call: { name: 'start_journey', input: {} } }
    const intent = interpret(text, coursesIn(prompt))
    if (intent.kind === 'CHANGE' && has('plan_course'))
      return {
        call: { name: 'plan_course', input: { changes: intent.changes } },
      }
    if (intent.kind === 'CONTEXT')
      return { call: { name: 'explain_plan', input: { topic: 'why_course' } } }
    if (intent.kind === 'COMPARE')
      return { call: { name: 'compare_transport', input: {} } }
    if (intent.kind === 'REFRESH')
      return { call: { name: 'check_live_conditions', input: {} } }
    const hour = text.match(/(\d{1,2})시/)
    if (hour && Number(hour[1]) <= 12 && has('ask_quick_reply')) {
      const h = Number(hour[1])
      return {
        call: {
          name: 'ask_quick_reply',
          input: {
            question: '몇 시에 출발해요?',
            options: [
              {
                id: `${String(h).padStart(2, '0')}:00 출발로 바뀌었어`,
                label: `오전 ${h}시`,
              },
              {
                id: `${String(h + 12).padStart(2, '0')}:00 출발로 바뀌었어`,
                label: `오후 ${h}시`,
              },
            ],
          },
        },
      }
    }
    return {
      text: '바꿀 조건을 알려주세요. 예: "16시로 바뀌었어", "호미곶으로 바꿔줘", "카페는 빼 줘", "30분 더 쉴래".',
    }
  }
  return { text: '알겠어요.' }
}

const decideFromResult = (
  r: ToolResult,
  stage: string,
  has: (n: string) => boolean,
  prompt: LanguageModelV4Prompt,
): Reply => {
  const v = r.value ?? {}
  if (r.denied) return { text: '기존 계획을 그대로 둘게요.' }
  switch (r.toolName) {
    case 'plan_course':
      if (typeof v.noEffect === 'string') return { text: v.noEffect }
      return v.isChange && has('apply_plan_change')
        ? {
            text: `${describePlan(v)} 적용할지 골라 주세요.`,
            call: {
              name: 'apply_plan_change',
              input: { previewId: v.previewId },
            },
          }
        : {
            text:
              describePlan(v) || '지금 조건으로는 관광 코스를 만들 수 없어요.',
          }
    case 'apply_plan_change':
      return {
        text: v.applied
          ? `반영했어요.${v.planningArrival ? ` 계획상 도착은 ${v.planningArrival}이에요.` : ''}`
          : '그사이 조건이 바뀌어서 반영하지 않았어요. 다시 요청해 주세요.',
      }
    case 'explain_plan':
      return {
        text:
          typeof v.summary === 'string'
            ? v.summary
            : Array.isArray(v.reasons)
              ? (v.reasons as string[]).join(' ')
              : '',
      }
    case 'compare_transport':
      return {
        text: `${(v.recommendation as Json)?.title ?? '이동수단을 확인해요'}. ${((v.recommendation as Json)?.reasons as string[] | undefined)?.join(' ') ?? ''} ${v.from ?? '코스'}에서 ${v.to}까지 대중교통은 시연 기준 ${(v.transit as Json)?.minutes ?? '—'}분이에요. 택시 시간·요금은 아직 연결된 데이터가 없어 카카오T 앱에서 확인해 주세요.`,
      }
    case 'check_live_conditions': {
      const verdict = (v.verdict ?? {}) as Json
      const used = (v.usedInPlan ?? {}) as Json
      const ok = ['GO', 'SHORTEN', 'INDOOR'].includes(String(verdict.decision))
      const head = ok
        ? `네, 지금 일정이면 ${verdict.hub} ${verdict.arrival} 도착이라 ${verdict.depart} 기준 여유가 ${verdict.slackMin}분 있어요.`
        : '지금 조건으로는 관광 일정을 유지하기 어려워요.'
      const basis =
        used.provenance === 'LIVE'
          ? `${used.congestion}을 반영했어요.`
          : used.provenance === 'DEMO'
            ? `시연용 관측 기준이에요(${used.congestion}).`
            : '최신 관측을 확인하지 못해 기본 여유로 계산했어요.'
      return { text: `${head} ${basis}` }
    }
    case 'record_race_progress':
      if (v.milestone === 'FINISHED') return { text: '완주 축하해요!' }
      return {
        text:
          v.milestone === 'ARRIVED_POHANG'
            ? '포항 도착을 기록했어요. 대회가 끝나면 "완주했어요"라고 알려주세요.'
            : '기록했어요. 완주하면 알려주세요.',
      }
    case 'start_journey':
      return {
        text: v.started
          ? '좋아요, 출발해요.'
          : '지금은 출발할 수 있는 코스가 없어요.',
      }
    case 'set_demo_observation':
      return has('plan_course')
        ? {
            text: '시연 조건을 적용했어요.',
            call: { name: 'plan_course', input: { changes: null } },
          }
        : { text: '시연 조건을 적용했어요.' }
    case 'summarize_trip':
      return {
        text: `오늘 ${(v.visited as string[] | undefined)?.join(', ') || '포항'}에 다녀왔어요. ${v.depart ?? ''} 잘 챙기세요.`.replace(
          '  ',
          ' ',
        ),
      }
    case 'show_safety_help':
      return { text: String(v.message ?? '') }
    case 'update_trip_details': {
      const saved = Array.isArray(v.saved) ? (v.saved as string[]) : []
      if (v.tripCreated)
        return {
          text: '일정을 저장했어요. 대회가 끝나면 "완주했어요"라고 알려주세요.',
        }
      return {
        text: saved.length
          ? `${saved.join(', ')}(으)로 적어 둘게요.`
          : '알겠어요.',
      }
    }
    case 'ask_quick_reply':
      return decideFromText(
        String(v.id ?? v.label ?? ''),
        stage,
        has,
        {},
        prompt,
      )
    case 'await_progress':
      return {
        text:
          {
            ARRIVED: '도착했어요. 첫 장소로 가요.',
            STOP_DONE: '좋아요, 다음으로 가요.',
            SKIP: '건너뛰고 남은 일정을 다시 계산했어요.',
            REST: '조금 더 쉬도록 다시 계산했어요.',
            START_RETURN: '돌아가는 길이에요. 시간 넉넉히 움직여요.',
            AT_STATION: '도착했어요.',
          }[String(v.event)] ?? '확인했어요.',
      }
    case 'get_race_info': {
      const info = (v.info ?? {}) as Json
      const [topic] = Object.keys(info)
      const body = info[topic]
      if (topic === 'overview' && body && typeof body === 'object') {
        const o = body as Json
        return {
          text: `${o.name}: ${o.date} ${o.gun} 출발, ${o.venue}. 제한시간 ${o.cutoff}.`,
        }
      }
      if (topic === 'course') {
        const c = body as Json
        return { text: `${c.summary}\n${(c.route as string[]).join(' → ')}` }
      }
      if (Array.isArray(body))
        return {
          text: listed(
            body,
            (r) =>
              typeof r === 'string'
                ? r
                : String(
                    r.time
                      ? `${r.time} ${r.label}`
                      : r.label
                        ? `${r.label}: ${r.detail}`
                        : `${r.q} ${r.a}`,
                  ),
            8,
          ),
        }
      if (topic === 'rules') {
        const r = body as { rules: string[]; notes: string[] }
        return { text: listed([...r.notes, ...r.rules], (x) => String(x), 6) }
      }
      return { text: '대회 정보를 확인했어요.' }
    }
    case 'search_guide': {
      const rows = (v.results as Json[] | undefined) ?? []
      return {
        text: rows.length
          ? listed(
              rows,
              (r) => `**${r.title}** ${String(r.text).slice(0, 140)}`,
              3,
            )
          : '앱 안내 자료에서는 찾지 못했어요. 다른 단어로 물어봐 주세요.',
      }
    }
    case 'compare_courses': {
      const rows = (v.courses as Json[] | undefined) ?? []
      return {
        text: listed(
          rows,
          (r) =>
            `${r.title}: ${r.arrival ? `${r.arrival} 도착 · ${(r.stops as string[]).join('·') || '바로 귀가'}` : String(r.reason ?? r.decision)}`,
          6,
        ),
      }
    }
    case 'find_nearby': {
      if (v.status !== 'LIVE') {
        const fb = (v.fallback as Json[] | undefined) ?? []
        return {
          text: `${v.message ?? '실시간 정보를 불러오지 못했어요.'}${fb.length ? ` 앱에 정리된 근처 장소예요:\n${listed(fb, (r) => `**${r.title}** ${String(r.text).slice(0, 80)}`, 3)}` : ''}`,
        }
      }
      const rows = (v.results as Json[] | undefined) ?? []
      return {
        text: rows.length
          ? `${v.near} 주변이에요(한국관광공사):\n${listed(rows, (r) => `${r.title} · ${r.type}${r.distanceM ? ` · ${r.distanceM}m` : ''}`, 5)}`
          : '주변에서 찾지 못했어요.',
      }
    }
    case 'get_place_detail': {
      const p = (v.place ?? {}) as Json
      const info = (p.info ?? {}) as Record<string, string>
      return {
        text:
          v.status === 'LIVE'
            ? `${p.title}: ${String(p.overview ?? '').slice(0, 160)}${
                Object.values(info).length
                  ? `\n${Object.entries(info)
                      .slice(0, 4)
                      .map(([k, x]) => `- ${k}: ${x}`)
                      .join('\n')}`
                  : ''
              }`
            : `상세 정보를 가져오지 못했어요(${v.message}).`,
      }
    }
    case 'get_directions': {
      if (v.status === 'UNKNOWN_PLACE') return { text: String(v.message) }
      const links = (v.links ?? {}) as Json
      const est = v.appEstimate as Json | null
      const stops = (v.busStops as Json[] | null) ?? []
      const first = stops[0]
      const arr = ((first?.arrivals as Json[]) ?? []).slice(0, 3)
      return {
        text: [
          `${v.from} → ${v.to} (직선 ${v.straightKm}km)${est?.minutes ? `, 앱 기준 ${est.via} 약 ${est.minutes}분` : ''}.`,
          first
            ? `가까운 정류장 ${first.stop}(${first.distanceM}m)${arr.length ? `: ${arr.map((a) => `${a.route}번 ${a.inMin}분 후`).join(', ')}` : ''}`
            : '',
          `[카카오맵 대중교통 길찾기](${links.transit})`,
        ]
          .filter(Boolean)
          .join('\n'),
      }
    }
    case 'get_bus_arrivals': {
      if (v.status !== 'LIVE')
        return {
          text: `버스 정보를 가져오지 못했어요(${v.message ?? v.status}).`,
        }
      const stops = (v.stops as Json[] | undefined) ?? []
      return {
        text: `${v.near} 근처 정류장(${v.asOf} 기준):\n${listed(
          stops,
          (s) =>
            `${s.stop}: ${
              ((s.arrivals as Json[] | null) ?? [])
                .slice(0, 3)
                .map((a) => `${a.route}번 ${a.inMin}분`)
                .join(', ') || '도착 예정 없음'
            }`,
          3,
        )}`,
      }
    }
    case 'get_train_times': {
      if (v.status !== 'LIVE')
        return {
          text: `열차 시간표를 가져오지 못했어요(${v.message ?? v.status}).`,
        }
      const rows = (v.trains as Json[] | undefined) ?? []
      return {
        text: rows.length
          ? `${v.date} 열차:\n${listed(rows, (t) => `${t.departs} → ${t.arrives} ${t.grade} ${t.no}`, 6)}`
          : '조건에 맞는 열차가 없어요.',
      }
    }
    case 'get_weather': {
      if (v.status !== 'LIVE' && v.status !== 'SNAPSHOT')
        return { text: String(v.message ?? '날씨를 불러오지 못했어요.') }
      const hours = (v.hours as Json[] | undefined) ?? []
      return {
        text: hours.length
          ? `${v.near} ${v.date} 예보(기상청):\n${listed(hours, (h) => `${h.time} ${h.tempC}°C ${h.precip || h.sky} 강수 ${h.popPct}% 바람 ${h.windMs}m/s${h.provenance === 'SNAPSHOT' ? ` (저장 예보 · ${h.issuedAt} 발표)` : ''}`, 5)}${v.note ? `\n${v.note}` : ''}`
          : `${v.date} 예보는 아직 없어요(예보는 ${v.lastForecastDate}까지).`,
      }
    }
    default:
      return { text: '확인했어요.' }
  }
}

export const decide = (options: LanguageModelV4CallOptions): Reply => {
  const available = new Set(
    (options.tools ?? []).flatMap((t) =>
      t.type === 'function' ? [t.name] : [],
    ),
  )
  const has = (n: string) => available.has(n)
  const stage = stageIn(options.prompt)
  const text = lastUserText(options.prompt)
  const results = trailingResults(options.prompt)
  const fromResult = results.length
    ? decideFromResult(results.at(-1)!, stage, has, options.prompt)
    : null
  if (options.toolChoice?.type === 'tool') {
    const forced = options.toolChoice.toolName
    // Prefer the reply the last result implies when it calls the forced tool.
    return fromResult?.call?.name === forced
      ? fromResult
      : {
          call: {
            name: forced,
            input: defaultInput(forced, text, options.prompt),
          },
        }
  }
  if (fromResult) return fromResult
  return decideFromText(
    text,
    stage,
    has,
    detailsIn(text, options.prompt),
    options.prompt,
  )
}

export const scriptedModel = (): LanguageModelV4 => ({
  specificationVersion: 'v4',
  provider: 'run2',
  modelId: 'rule-based',
  supportedUrls: {},
  doGenerate: async () => {
    throw new Error('rule-based model streams only')
  },
  doStream: async (options) => ({ stream: toStream(decide(options)) }),
})

/** Use `primary`; if it fails before streaming, answer with `backup` instead. */
export const withFallback = (
  primary: LanguageModelV4,
  backup: LanguageModelV4,
  onServed: (mode: 'OPENAI' | 'FALLBACK') => void,
): LanguageModelV4 => ({
  specificationVersion: 'v4',
  provider: primary.provider,
  modelId: primary.modelId,
  supportedUrls: primary.supportedUrls,
  doGenerate: (o) => primary.doGenerate(o),
  doStream: async (o) => {
    try {
      const result = await primary.doStream(o)
      onServed('OPENAI')
      return result
    } catch {
      onServed('FALLBACK')
      return backup.doStream(o)
    }
  },
})
