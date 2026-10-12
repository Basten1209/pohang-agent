import { openai } from '@ai-sdk/openai'
import { experimental_useRealtime } from '@ai-sdk/react'
import type { Experimental_RealtimeServerEvent } from 'ai'
import { Mic, MicOff } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { VoiceConfig } from '#/core/voice'
import { spokenReply, utterance } from '#/core/voice'
import type { Agent } from './chat'
import { useI18n } from '#/i18n/react'

/**
 * Voice mode (beta). OpenAI Live hears the runner and speaks; when it
 * delegates, what the runner said goes to the same text agent as typing
 * does — same tools, safety gate, approvals and trip — and the agent's
 * answer is handed back for Live to say. The conversation shows both.
 */

/** Whether the server can open a voice session (key set and enabled). */
const useVoiceAvailable = () => {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/status', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { voice?: boolean } | null) => setAvailable(s?.voice === true))
      .catch(() => undefined)
    return () => controller.abort()
  }, [])
  return available
}

const minutes = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

const VoiceSession = ({
  agent,
  tripId,
  voice,
}: {
  agent: Agent
  tripId: string
  voice: VoiceConfig
}) => {
  const model = useMemo(
    () => openai.experimental_realtime(voice.model),
    [voice.model],
  )
  // The server fixes the real session settings; keep this object stable.
  const sessionConfig = useMemo(() => ({}), [])
  const heard = useRef<string[]>([])
  const handled = useRef(new Set<string>())
  const agentRef = useRef(agent)
  agentRef.current = agent
  const [failed, setFailed] = useState(false)
  const { t, locale } = useI18n()
  const api = useMemo(
    () => ({ session: `/api/voice/session?trip=${tripId}&locale=${locale}` }),
    [tripId, locale],
  )

  const realtime = experimental_useRealtime({
    model,
    api,
    sessionConfig,
    onError: () => setFailed(true),
    onEvent: (event: Experimental_RealtimeServerEvent) => {
      if (event.type === 'transcript-fragment' && event.speaker === 'user')
        heard.current.push(event.delta)
      if (
        event.type === 'delegation-created' &&
        !handled.current.has(event.delegationId)
      ) {
        handled.current.add(event.delegationId)
        void delegate(event.delegationId)
      }
    },
  })

  const answer = (delegationId: string, content: string) =>
    realtime
      .sendEvent({
        type: 'context-append',
        delegationId,
        content,
        providerOptions: { openai: { channel: 'commentary' } },
      })
      .catch(() => setFailed(true))

  /** One delegated request: the words since the last one, through the text agent. */
  const delegate = async (delegationId: string) => {
    const said = utterance(heard.current.splice(0))
    if (!said) return answer(delegationId, t('voice.didntHear'))
    if (agentRef.current.busy) return answer(delegationId, t('voice.busy'))
    const reply = await agentRef.current.ask(said)
    return answer(
      delegationId,
      reply
        ? spokenReply(reply.parts, voice.maxReplyChars, {
            approval: t('voice.approval'),
            seeScreen: t('voice.seeScreen'),
            rest: t('voice.rest'),
          })
        : t('voice.noAnswer'),
    )
  }

  const live = realtime.status === 'connected'
  const starting = realtime.status === 'connecting'
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={live ? 'default' : 'ghost'}
        disabled={starting || realtime.status === 'closing'}
        aria-pressed={live}
        onClick={() => {
          setFailed(false)
          if (live) void realtime.close()
          else void realtime.connect()
        }}
      >
        {starting ? <Spinner /> : live ? <MicOff /> : <Mic />}
        {live ? t('voice.stop') : t('voice.start')}
      </Button>
      {live && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {t('voice.listening', {
            time: minutes(realtime.session?.usage?.seconds ?? 0),
          })}
        </span>
      )}
      {!live && !starting && (failed || realtime.status === 'error') && (
        <span role="alert" className="text-xs text-destructive">
          {t('voice.disconnected')}
        </span>
      )}
    </div>
  )
}

/** The mic control for the agent sheet; renders nothing when voice is off. */
export const VoiceControl = ({
  agent,
  tripId,
}: {
  agent: Agent
  tripId: string
}) => {
  const available = useVoiceAvailable()
  const voice = agent.config.agent.voice
  if (!available || !voice?.enabled) return null
  return <VoiceSession agent={agent} tripId={tripId} voice={voice} />
}
