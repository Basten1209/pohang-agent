import { activeCourses, placesOf } from './route'
import type { TripConfig } from './schema'

/**
 * Everything the agent may look up, as searchable documents built from
 * config: the race, courses, places, ways home and the curated guide. The
 * agent never gets this in its prompt; it calls `search_guide` and quotes
 * what comes back.
 */

export type KnowledgeDoc = {
  id: string
  kind: 'race' | 'course' | 'place' | 'mode' | 'faq' | 'guide'
  title: string
  text: string
  /** Extra words that should match but need not be shown. */
  keywords: string
  ref?: string
}

export const knowledgeOf = (config: TripConfig): KnowledgeDoc[] => {
  const e = config.event
  const race: KnowledgeDoc[] = [
    {
      id: 'race-overview',
      kind: 'race',
      title: e.name,
      text: `${e.dateLabel} ${e.gun} 출발 · ${e.category} · ${e.venue} (${e.address}) · 제한시간 ${e.cutoff}`,
      keywords: '대회 일시 날짜 장소 언제 어디 출발 시간 마라톤',
    },
    {
      id: 'race-schedule',
      kind: 'race',
      title: '대회 당일 일정',
      text: e.schedule.map((s) => `${s.time} ${s.label}`).join(' · '),
      keywords: '일정 시간표 집결 시상식 물품보관 스트레칭',
    },
    {
      id: 'race-course',
      kind: 'race',
      title: `대회 코스 (${e.course.distanceKm}km)`,
      text: `${e.course.summary} 경로: ${e.course.route.join(' → ')}. 급수·지점: ${e.course.checkpoints.map((c) => `${c.km}km ${c.label}`).join(', ')}`,
      keywords: '대회 코스 경로 반환점 급수대 달리는 길 레이스',
    },
    {
      id: 'race-kit',
      kind: 'race',
      title: '준비물',
      text: e.kit.join(' · '),
      keywords: '준비물 배번 기록칩 챙길 것',
    },
    {
      id: 'race-facilities',
      kind: 'race',
      title: '현장 시설',
      text: e.facilities.map((f) => `${f.label}: ${f.detail}`).join(' · '),
      keywords: '시설 화장실 탈의실 물품보관 의료 급수 운영본부',
    },
    {
      id: 'race-rules',
      kind: 'race',
      title: '대회 규정·안내',
      text: [...e.rules, ...e.notes].join(' '),
      keywords: '규칙 규정 통제 셔틀 주차 이어폰 기상',
    },
    ...e.faq.map((f, i) => ({
      id: `faq-${i}`,
      kind: 'faq' as const,
      title: f.q,
      text: f.a,
      keywords: '자주 묻는 질문',
    })),
  ]
  const courses: KnowledgeDoc[] = activeCourses(config).map((c) => ({
    id: `course-${c.id}`,
    kind: 'course',
    ref: c.id,
    title: `코스: ${c.title}`,
    text: `${c.desc} 대회장에서 ${c.outbound.via}로 약 ${c.outbound.minutes}분(시연 기준). 들르는 곳: ${placesOf(
      config,
      c.id,
    )
      .map((p) => p.attrs.short)
      .join(', ')}.`,
    keywords: `${c.area} ${c.tags.join(' ')} 코스 추천`,
  }))
  const places: KnowledgeDoc[] = config.places
    .filter((p) => p.active)
    .map((p) => {
      const a = p.attrs as typeof p.attrs & { address?: string; tips?: string }
      return {
        id: `place-${p.id}`,
        kind: 'place',
        ref: p.id,
        title: `${a.short} — ${a.title}`,
        text: [a.desc, a.detail, a.tips, a.address && `주소: ${a.address}`]
          .filter(Boolean)
          .join(' '),
        keywords: `${a.subtitle} ${a.category} ${a.actionLabel} ${a.interest}`,
      }
    })
  const modes: KnowledgeDoc[] = config.modes.map((m) => {
    const hub = config.anchors.find((a) => a.id === m.hub)?.name ?? m.hub
    return {
      id: `mode-${m.id}`,
      kind: 'mode',
      title: `${m.label}로 돌아갈 때`,
      text: `${hub}에 ${m.noun === '귀가' ? '돌아오는 시각' : `${m.noun} 시각`} ${m.bufferMin}분 전 도착을 목표로 계산해요.`,
      keywords: `${m.noun} ${hub} 귀가 돌아가`,
    }
  })
  const guide: KnowledgeDoc[] = config.guide.map((g) => ({
    id: `guide-${g.id}`,
    kind: 'guide',
    title: g.title,
    text: g.body,
    keywords: `${g.topic} ${g.tags.join(' ')}`,
  }))
  return [...race, ...courses, ...places, ...modes, ...guide]
}

/** Common endings stripped so "구룡포는", "물회를" match "구룡포", "물회". */
const stem = (w: string) =>
  w.replace(
    /(?:에서는|에서|으로|에는|까지|부터|이랑|하고|은|는|이|가|을|를|에|도|의|로|랑|요|야|나|좀)$/,
    '',
  )

export const terms = (query: string) => [
  ...new Set(
    query
      .toLowerCase()
      .split(/[\s,.?!·~]+/)
      .map(stem)
      .filter((w) => w.length >= 2 || /\d/.test(w)),
  ),
]

/** Keyword score: title hits count most, then body, then hidden keywords. */
export const searchKnowledge = (
  docs: KnowledgeDoc[],
  query: string,
  limit = 4,
): KnowledgeDoc[] => {
  const ts = terms(query)
  if (!ts.length) return []
  return docs
    .map((d) => {
      const title = d.title.toLowerCase()
      const text = d.text.toLowerCase()
      const keys = d.keywords.toLowerCase()
      const score = ts.reduce(
        (s, t) =>
          s +
          (title.includes(t) ? 3 : 0) +
          (text.includes(t) ? 1 : 0) +
          (keys.includes(t) ? 2 : 0),
        0,
      )
      return { d, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.d)
}
