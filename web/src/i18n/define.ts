/**
 * One area's messages. The Korean text is the source; every other language
 * must have every key (checked by the type).
 */
export const defineMessages = <const T extends Record<string, string>>(
  ko: T,
  rest: Record<'en' | 'ja' | 'zh', Record<keyof T, string>>,
) => ({ ko, ...rest })
