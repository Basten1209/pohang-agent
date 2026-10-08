import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Prompt,
  LanguageModelV4StreamPart,
} from '@ai-sdk/provider'
import { interpret } from '#/core/intents'
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
  const d = detailsFromText(text, { stage: stageIn(prompt), readyTime })
  // "카페도" adds to what was already chosen.
  const before =
    system.match(/하고 싶은 일: ([a-z, ]+) ·/)?.[1]?.split(', ') ?? []
  if (Array.isArray(d.interests) && d.interests.length && /도\s|도$/.test(text))
    d.interests = [...new Set([...before, ...d.interests])]
  return d
}
const saysSomething = (d: Json) => Object.values(d).some((v) => v !== null)

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
    ? ` 계획상 포항역 도착은 ${v.planningArrival}이에요.`
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
): Reply => {
  if (text.startsWith('/시연')) {
    const scenario = demoScenario(text)
    return scenario && has('set_demo_observation')
      ? { call: { name: 'set_demo_observation', input: { scenario } } }
      : {
          text: '시연 명령: /시연 기본 · 16시 · 혼잡 · 대기 · 지연 · 누락 · 오래된 관측',
        }
  }
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
    const intent = interpret(text)
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
            question: '몇 시 기차인가요?',
            options: [
              {
                id: `${String(h).padStart(2, '0')}:00 기차`,
                label: `오전 ${h}시`,
              },
              {
                id: `${String(h + 12).padStart(2, '0')}:00 기차`,
                label: `오후 ${h}시`,
              },
            ],
          },
        },
      }
    }
    return {
      text: '바꿀 조건을 알려주세요. 예: "16시 기차로 바뀌었어", "15분만 걷고 싶어", "30분 더 쉴래".',
    }
  }
  return { text: '알겠어요.' }
}

const decideFromResult = (
  r: ToolResult,
  stage: string,
  has: (n: string) => boolean,
): Reply => {
  const v = r.value ?? {}
  if (r.denied) return { text: '기존 계획을 그대로 둘게요.' }
  switch (r.toolName) {
    case 'plan_course':
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
          ? `반영했어요.${v.planningArrival ? ` 계획상 포항역 도착은 ${v.planningArrival}이에요.` : ''}`
          : '그사이 조건이 바뀌어서 반영하지 않았어요. 다시 요청해 주세요.',
      }
    case 'explain_plan':
      return {
        text: Array.isArray(v.reasons) ? (v.reasons as string[]).join(' ') : '',
      }
    case 'compare_transport':
      return {
        text: '포항역 복귀 버스는 시연 기준 120분이에요. 택시는 시간·요금을 아직 확인할 수 없어 버스 계획을 유지해요.',
      }
    case 'check_live_conditions':
      return {
        text: '디지털 트윈 연결 상태를 확인했어요. 일정 계산은 화면의 관측 입력 기준이에요.',
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
        text: `오늘 ${(v.visited as string[] | undefined)?.join(', ') || '구룡포'}에 다녀왔어요. ${v.trainTime} 열차 잘 타세요.`,
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
      return decideFromText(String(v.id ?? v.label ?? ''), stage, has, {})
    case 'await_progress':
      return {
        text:
          {
            ARRIVED: '구룡포에 도착했어요.',
            STOP_DONE: '좋아요, 다음으로 가요.',
            SKIP: '건너뛰고 남은 일정을 다시 계산했어요.',
            REST: '조금 더 쉬도록 다시 계산했어요.',
            START_RETURN: '포항역으로 출발해요.',
            AT_STATION: '도착했어요.',
          }[String(v.event)] ?? '확인했어요.',
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
    ? decideFromResult(results.at(-1)!, stage, has)
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
  return decideFromText(text, stage, has, detailsIn(text, options.prompt))
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
