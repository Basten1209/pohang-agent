/**
 * Fixed Korean sentences the server builds (plans, routes, safety, fallback
 * replies) with their translations. `{0}`, `{1}` … mark the parts that vary;
 * they are filled with the matching text, itself translated when known.
 */
export type Phrase = { ko: string; en: string; ja: string; zh: string }

export const definePhrases = (phrases: Phrase[]) => phrases
