import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModelV4 } from '@ai-sdk/provider'
import type { TripConfig } from '#/core/schema'

/** The language model for this deployment, or `null` to use the rule-based model. */
export const modelFor = (config: TripConfig): LanguageModelV4 | null => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  return createOpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  })(config.agent.model) as LanguageModelV4
}
