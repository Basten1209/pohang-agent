import { afterEach, expect, it, vi } from 'vitest'
import { seedConfig } from '#/core/defaults'
import { modelFor } from '#/server/agent/model'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it.each(['doGenerate', 'doStream'] as const)(
  '%s sends Fast processing without losing existing OpenAI options',
  async (method) => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    vi.stubEnv('OPENAI_BASE_URL', 'https://openai.invalid/v1')
    let body: Record<string, unknown> | undefined
    vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) => {
      body = JSON.parse(init.body as string)
      throw new Error('request captured')
    })
    const model = modelFor(seedConfig)!
    await expect(
      model[method]({
        prompt: [{ role: 'user', content: [{ type: 'text', text: '안녕' }] }],
        providerOptions: { openai: { store: false, parallelToolCalls: false } },
      }),
    ).rejects.toThrow('request captured')
    expect(body).toMatchObject({
      model: seedConfig.agent.model,
      service_tier: 'fast',
      store: false,
      parallel_tool_calls: false,
    })
  },
)
