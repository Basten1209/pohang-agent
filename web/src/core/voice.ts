import type { Locale } from '#/i18n'
import { agentLanguage } from '#/i18n'
import type { AgentConfig } from './schema'

/**
 * Voice mode, as pure functions. OpenAI Live listens and speaks; it never
 * decides. Every request it hears is delegated to the text agent, and what
 * the agent answered is handed back for Live to say.
 */

export type VoiceConfig = NonNullable<AgentConfig['voice']>

/** Native Live events the browser may send and receive (server-owned policy). */
export const liveClientEvents = [
  'session.close',
  'session.commentary.append',
  'session.thinking.append',
]
export const liveServerEvents = [
  'session.started',
  'session.closed',
  'session.usage.updated',
  'session.delegation.created',
  'session.input_transcript.delta',
  'session.output_transcript.delta',
  'session.thinking.appended',
  'error',
].map((type) => ({ type }))

/** The Live session the server creates; anything the browser sends is ignored. */
export const liveSessionConfig = (voice: VoiceConfig, locale?: Locale) => ({
  instructions:
    locale && locale !== 'ko'
      ? `${voice.instructions}\n사용자와는 ${agentLanguage[locale]}로 말한다. 위임 결과도 그 언어로 읽어 준다.`
      : voice.instructions,
  // A built-in voice is a plain name; `{ id }` is only for custom voices.
  voice: voice.voice,
  providerOptions: {
    openai: {
      delegation: { type: 'client' as const },
      store: false,
      client: {
        dataChannel: {
          allowedClientEvents: liveClientEvents,
          allowedServerEvents: liveServerEvents,
        },
      },
    },
  },
})

type PartLike = { type: string; text?: string; state?: string }

/** Markdown and links read badly aloud. */
const plain = (text: string) =>
  text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`#>]+/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * What Live should say for one agent reply: its text, a pointer to any
 * approval waiting on screen, cut to Live's per-result budget.
 */
const koreanNotes = {
  approval:
    '바뀐 일정을 화면에 띄웠어요. 적용하려면 화면에서 적용을 눌러 주세요.',
  seeScreen: '확인했어요. 자세한 내용은 화면에서 볼 수 있어요.',
  rest: '나머지는 화면에서 볼 수 있어요.',
}

export const spokenReply = (
  parts: ReadonlyArray<PartLike>,
  maxChars: number,
  notes: typeof koreanNotes = koreanNotes,
): string => {
  const text = plain(
    parts
      .flatMap((p) => (p.type === 'text' && p.text ? [p.text] : []))
      .join(' '),
  )
  const approval = parts.some((p) => p.state === 'approval-requested')
    ? notes.approval
    : ''
  const said = [text, approval].filter(Boolean).join(' ')
  if (!said) return notes.seeScreen
  if (said.length <= maxChars) return said
  // Cut at a sentence end inside the budget when there is one.
  const cut = said.slice(0, maxChars)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('요 '))
  return `${end > maxChars / 2 ? cut.slice(0, end + 1) : cut}… ${notes.rest}`
}

/** The user's words since the last delegation, from Live's transcript fragments. */
export const utterance = (fragments: ReadonlyArray<string>) =>
  fragments.join('').replace(/\s+/g, ' ').trim()
