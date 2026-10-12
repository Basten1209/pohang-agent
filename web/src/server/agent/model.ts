import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModelV4 } from '@ai-sdk/provider'
import { defaultSettingsMiddleware, wrapLanguageModel } from 'ai'
import type { TripConfig } from '#/core/schema'

/** The language model for this deployment, or `null` to use the rule-based model. */
export const modelFor = (config: TripConfig): LanguageModelV4 | null => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  const model = createOpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  })(config.agent.model) as LanguageModelV4
  // Both chat streaming and photo captions use this factory. Keep the selected
  // model and its reasoning settings; request OpenAI's faster processing tier.
  return wrapLanguageModel({
    model,
    middleware: defaultSettingsMiddleware({
      settings: { providerOptions: { openai: { serviceTier: 'fast' } } },
    }),
  })
}
