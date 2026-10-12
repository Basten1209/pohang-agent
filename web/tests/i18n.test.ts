import { describe, expect, it } from 'vitest'
import { seedConfig } from '#/core/defaults'
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
})
