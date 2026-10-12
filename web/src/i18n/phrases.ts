import { courses } from '#/core/seed/courses'
import { places } from '#/core/seed/places'
import type { Locale } from './index'
import { translateData } from './index'
import config from './phrases/config'
import core from './phrases/core'
import type { Phrase } from './phrases/define'
import server from './phrases/server'
import ui from './phrases/ui'

// Names from seed data (places, venues, course areas) so they translate
// inside the server's sentences too.
const names: Phrase[] = [
  ...places.flatMap((p) => {
    const tr = p.attrs.translations
    if (!tr?.en || !tr.ja || !tr.zh) return []
    return (['title', 'short'] as const).flatMap((field) =>
      tr.en![field] && tr.ja![field] && tr.zh![field]
        ? [
            {
              ko: p.attrs[field],
              en: tr.en![field]!,
              ja: tr.ja![field]!,
              zh: tr.zh![field]!,
            },
          ]
        : [],
    )
  }),
  ...courses.map((c) => ({
    ko: c.area,
    en: translateData('en', `area.${c.id}`, c.area),
    ja: translateData('ja', `area.${c.id}`, c.area),
    zh: translateData('zh', `area.${c.id}`, c.area),
  })),
]

const all: Phrase[] = [...names, ...ui, ...core, ...config, ...server]
const exact = new Map(
  all.filter((p) => !/\{\d\}/.test(p.ko)).map((p) => [p.ko, p]),
)
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// Longer fixed text first, so the most specific template wins.
const templates = all
  .filter((p) => /\{\d\}/.test(p.ko))
  .map((p) => {
    const order: number[] = []
    const source = escape(p.ko).replace(/\\\{(\d)\\\}/g, (_, n: string) => {
      order.push(Number(n))
      return '([\\s\\S]+?)'
    })
    return { phrase: p, order, re: new RegExp(`^${source}$`) }
  })
  .sort(
    (a, b) =>
      b.phrase.ko.replace(/\{\d\}/g, '').length -
      a.phrase.ko.replace(/\{\d\}/g, '').length,
  )

const one = (locale: Exclude<Locale, 'ko'>, text: string): string | null => {
  const hit = exact.get(text)
  if (hit) return hit[locale]
  const multiline = text.includes('\n')
  for (const { phrase, order, re } of templates) {
    // A one-line template must not swallow a multi-line reply.
    if (multiline && !phrase.ko.includes('\n')) continue
    const m = re.exec(text)
    if (!m) continue
    const values: string[] = []
    order.forEach((n, i) => {
      values[n] = translateText(locale, m[i + 1]!)
    })
    return phrase[locale].replace(/\{(\d)\}/g, (_, n: string) =>
      String(values[Number(n)] ?? ''),
    )
  }
  return null
}

const hasHangul = /[가-힣]/

/**
 * Text the server wrote in Korean, in `locale` when it is a known phrase.
 * Lines, " · " lists and sentences are tried piece by piece; anything
 * unknown (names, the agent's own words) is left as it is.
 */
export const translateText = (locale: Locale, text: string): string => {
  if (locale === 'ko' || !hasHangul.test(text)) return text
  const whole = one(locale, text.trim())
  if (whole !== null) return text.replace(text.trim(), whole)
  if (text.includes('\n'))
    return text
      .split('\n')
      .map((line) => translateText(locale, line))
      .join('\n')
  const bullet = /^(\s*(?:[-•*]|\d+\.)\s+)(.+)$/.exec(text)
  if (bullet) return bullet[1] + translateText(locale, bullet[2]!)
  if (text.includes(' · '))
    return text
      .split(' · ')
      .map((part) => translateText(locale, part))
      .join(' · ')
  const sentences = text.split(/(?<=[.!?])\s+/)
  if (sentences.length > 1)
    return sentences
      .map((s) => translateText(locale, s))
      .join(locale === 'en' ? ' ' : '')
  return text
}

// Korean that must stay Korean: what the runner "says" to the agent and the
// agent's own instructions.
const keep = new Set(['say', 'instructions'])

/** Every known server phrase inside `value`, in `locale`; structure unchanged. */
export const localizeDeep = <T>(value: T, locale: Locale): T => {
  if (locale === 'ko') return value
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return translateText(locale, v)
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, keep.has(k) ? x : walk(x)]),
      )
    return v
  }
  return walk(value) as T
}
