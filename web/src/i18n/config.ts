import { eventIn } from '#/core/race-event'
import type { TripConfig } from '#/core/schema'
import type { Locale } from './index'
import { translateData } from './index'
import { localizeDeep } from './phrases'

/**
 * The config as a runner reading in `locale` sees it: names and seed text
 * swapped for their translations, Korean wherever none exists. Ids, times
 * and coordinates are untouched, so planning and links work the same.
 */
export const localizeConfig = (
  config: TripConfig,
  locale: Locale,
): TripConfig => {
  if (locale === 'ko') return config
  return localizeDeep(structured(config, locale), locale)
}

/** Names and seed text that have their own translations. */
const structured = (
  config: TripConfig,
  locale: Exclude<Locale, 'ko'>,
): TripConfig => {
  const d = (key: string, korean: string) => translateData(locale, key, korean)
  return {
    ...config,
    event: eventIn(config.event, locale),
    anchors: config.anchors.map((a) => ({
      ...a,
      name: d(`anchor.${a.id}`, d(`hub.${a.id}`, a.name)),
    })),
    courses: config.courses.map((c) => ({
      ...c,
      title: d(`course.${c.id}`, c.title),
      area: d(`area.${c.id}`, c.area),
    })),
    modes: config.modes.map((m) => ({
      ...m,
      label: d(`mode.${m.id}`, m.label),
      noun: d(`noun.${m.id}`, m.noun),
    })),
    places: config.places.map((p) => ({
      ...p,
      attrs: {
        ...p.attrs,
        ...p.attrs.translations?.[locale],
        candidates: p.attrs.candidates?.map((v) => ({
          ...v,
          ...v.translations?.[locale],
        })),
      },
    })),
  }
}
