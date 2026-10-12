import type { RaceEvent } from './schema'

/** The race as a runner reading in `locale` sees it; Korean fills any gap. */
export const eventIn = (event: RaceEvent, locale: string): RaceEvent => {
  const text =
    locale === 'en' || locale === 'ja' || locale === 'zh'
      ? event.translations[locale]
      : undefined
  if (!text) return event
  return { ...event, ...text, course: { ...event.course, ...text.course } }
}
