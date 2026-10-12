import { openai } from '@ai-sdk/openai'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { liveSessionConfig } from '#/core/voice'
import { getConfig } from '#/server/config'
import { json, parseBody } from '#/server/http'

/**
 * Voice mode setup: exchange the browser's WebRTC offer for an OpenAI Live
 * answer. The API key stays here; audio then flows browser ↔ OpenAI directly.
 * The session (delegation, voice, allowed events) is fixed by the server —
 * whatever session settings the browser sends are ignored.
 */
const bodySchema = z.object({
  sdp: z.string().min(1).max(200_000),
  sessionConfig: z.unknown().optional(),
})

export const Route = createFileRoute('/api/voice/session')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const trip = new URL(request.url).searchParams.get('trip')
        if (!z.uuid().safeParse(trip).success)
          return json({ error: 'INVALID_TRIP' }, { status: 400 })
        const { config } = await getConfig()
        const voice = config.agent.voice
        if (!voice?.enabled || !process.env.OPENAI_API_KEY)
          return json({ error: 'VOICE_UNAVAILABLE' }, { status: 503 })
        const body = await parseBody(request, bodySchema, 256_000)
        if (!body.ok) return body.response
        const model = openai.experimental_realtime(voice.model)
        // Only continuous (Live) models negotiate WebRTC here.
        if (!model.doCreateWebRTCSession)
          return json({ error: 'VOICE_MODEL_UNSUPPORTED' }, { status: 503 })
        try {
          const answer = await model.doCreateWebRTCSession({
            sdp: body.data.sdp,
            sessionConfig: liveSessionConfig(voice),
            abortSignal: AbortSignal.timeout(15_000),
          })
          return json(answer)
        } catch (error) {
          console.error(
            '[voice] session setup failed:',
            (error as Error).message.split('\n')[0],
          )
          return json({ error: 'VOICE_SETUP_FAILED' }, { status: 502 })
        }
      },
    },
  },
})
