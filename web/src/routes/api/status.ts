import { createFileRoute } from '@tanstack/react-router'
import { getConfig } from '#/server/config'
import { json } from '#/server/http'

/** Which integrations are configured. Never echoes a secret, only its presence. */
export const Route = createFileRoute('/api/status')({
  server: {
    handlers: {
      GET: async () => {
        const { config, storage, issues } = await getConfig()
        const env = process.env
        return json({
          agent: env.OPENAI_API_KEY ? 'CONFIGURED' : 'DEMO',
          model: env.OPENAI_API_KEY ? config.agent.model : null,
          eum: Boolean(env.EUM_SERVICE_KEY),
          airDevice: Boolean(env.EUM_AIR_DEVICE_ID),
          dataGoKr: Boolean(env.DATA_GO_KR_SERVICE_KEY),
          storage,
          configIssues: issues.length,
          transport: 'DEMO',
        })
      },
    },
  },
})
