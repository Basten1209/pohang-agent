import { describe, expect, it } from 'vitest'
import { seedConfig } from '#/core/defaults'
import { eventIn } from '#/core/race-event'
import { localizeConfig } from '#/i18n/config'
import { activeCourses } from '#/core/route'
import { liveSessionConfig } from '#/core/voice'
import {
  durationText,
  isLocale,
  languageInstruction,
  locales,
  translate,
  translateData,
} from '#/i18n'

const others = locales.filter((l) => l !== 'ko')

describe('다국어 (ko/en/ja/zh)', () => {
  it('언어 값은 지원 목록만 받는다', () => {
    expect(isLocale('en')).toBe(true)
    expect(isLocale('fr')).toBe(false)
    expect(isLocale(null)).toBe(false)
  })

  it('문구 변수를 채우고, 언어마다 다른 문장을 낸다', () => {
    expect(translate('ko', 'offline.last', { time: '15:10' })).toBe(
      '마지막으로 본 일정: 15:10 출발',
    )
    expect(translate('en', 'offline.last', { time: '15:10' })).toBe(
      'Last plan: leaving 15:10',
    )
    const titles = locales.map((l) => translate(l, 'offline.title'))
    expect(new Set(titles).size).toBe(locales.length)
  })

  it('운영 설정의 이름(코스·이동수단·관심사·도착지)은 모든 언어에 번역이 있다', () => {
    const keys = [
      ...activeCourses(seedConfig).flatMap((c) => [
        `course.${c.id}`,
        `tags.${c.id}`,
        `area.${c.id}`,
      ]),
      ...seedConfig.modes.flatMap((m) => [
        `mode.${m.id}`,
        `noun.${m.id}`,
        `hub.${m.hub}`,
      ]),
      ...(seedConfig.conversation.slots.interests?.choices ?? []).map(
        (c) => `interest.${String(c.value)}`,
      ),
    ]
    for (const locale of others)
      for (const key of keys)
        expect(
          translateData(locale, key, '__missing__'),
          `${locale} ${key}`,
        ).not.toBe('__missing__')
  })

  it('번역이 없는 이름은 운영자가 쓴 한국어 그대로', () => {
    expect(translateData('en', 'course.new-course', '새 코스')).toBe('새 코스')
    expect(translateData('ko', 'course.guryongpo', '구룡포')).toBe('구룡포')
  })

  it('소요 시간을 언어에 맞게', () => {
    expect(durationText('ko', 90)).toBe('1시간 30분')
    expect(durationText('en', 45)).not.toContain('분')
    expect(durationText('ja', 120)).toContain('時間')
  })

  it('한국어가 아니면 에이전트와 Live에 답변 언어를 알린다', () => {
    expect(languageInstruction('ko')).toBeNull()
    expect(languageInstruction(undefined)).toBeNull()
    expect(languageInstruction('en')).toContain('English')
    const voice = seedConfig.agent.voice!
    expect(liveSessionConfig(voice).instructions).toBe(voice.instructions)
    expect(liveSessionConfig(voice, 'ja').instructions).toContain('Japanese')
  })

  it('대회 정보(FAQ·코스·일정)는 언어별 번역, 없는 항목은 한국어', () => {
    const event = seedConfig.event
    expect(eventIn(event, 'ko')).toBe(event)
    for (const locale of others) {
      const e = eventIn(event, locale)
      expect(e.faq).toHaveLength(event.faq.length)
      expect(e.faq[0]!.q).not.toBe(event.faq[0]!.q)
      expect(e.course.route).toHaveLength(event.course.route.length)
      expect(e.schedule.map((s) => s.time)).toEqual(
        event.schedule.map((s) => s.time),
      )
      // Map data and distances stay with the original.
      expect(e.geo).toEqual(event.geo)
      expect(e.course.distanceKm).toBe(event.course.distanceKm)
    }
    const partial = { ...event, translations: { en: { name: 'Beach Run' } } }
    expect(eventIn(partial, 'en').faq).toEqual(event.faq)
  })

  it('장소·지점 이름과 설명도 언어별로, 아이디·좌표·시간은 그대로', () => {
    expect(localizeConfig(seedConfig, 'ko')).toBe(seedConfig)
    for (const locale of others) {
      const c = localizeConfig(seedConfig, locale)
      c.places.forEach((p, i) => {
        const original = seedConfig.places[i]!
        expect(p.id).toBe(original.id)
        expect(p.attrs.geo).toEqual(original.attrs.geo)
        expect(p.attrs.defaultDwell).toBe(original.attrs.defaultDwell)
        expect(p.attrs.short, `${locale} ${p.id}`).not.toBe(
          original.attrs.short,
        )
        expect(p.attrs.title, `${locale} ${p.id}`).not.toBe(
          original.attrs.title,
        )
      })
      const race = c.anchors.find((a) => a.id === 'RACE')!
      expect(race.name).not.toBe('영일대해수욕장')
      expect(c.modes.find((m) => m.id === 'LOCAL')!.noun).not.toBe('귀가')
    }
  })
})
