import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import type { TripConfig } from '#/core/schema'

/** The language model for this deployment, or `null` to run the deterministic agent. */
export const modelFor = (config: TripConfig): LanguageModel | null => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  return createOpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  })(config.agent.model)
}
