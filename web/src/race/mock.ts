import type { Race, Runner } from '#/core/race'

/**
 * Demo data for the race tabs. Event name, date, schedule and the field are
 * made up for the demo; only the venue matches the app's RACE anchor.
 */

export const event = {
  name: '2026 포항 영일만 해변런',
  category: '10km',
  date: '2026년 10월 25일 (일)',
  gun: '08:30',
  venue: '영일대해수욕장 특설무대',
  address: '경북 포항시 북구 두호동 영일대해수욕장',
  geo: { lat: 36.0565, lng: 129.378 },
  bib: '10427',
  cutoff: '90분 (10:00 결승 통과 마감)',
  schedule: [
    { time: '07:00', label: '물품보관·탈의실 운영 시작' },
    { time: '08:00', label: '집결 · 단체 스트레칭' },
    { time: '08:30', label: '10km 출발' },
    { time: '08:40', label: '5km 출발' },
    { time: '10:00', label: '10km 제한시간 종료' },
    { time: '10:30', label: '시상식 · 물품 반환 마감 11:30' },
  ],
  course: [
    '영일대해수욕장 출발',
    '해안로 따라 남쪽',
    '5km 반환점',
    '같은 길로 복귀',
    '영일대 결승',
  ],
  kit: [
    '배번표 (가슴 앞쪽, 접지 않기)',
    '기록칩 (오른쪽 신발끈에 고정)',
    '물품보관 태그 (가방에 부착)',
  ],
  facilities: [
    { label: '급수대', detail: '2.5km · 5km · 7.5km · 결승' },
    { label: '의무 지원', detail: '출발선 · 5km 반환점 · 결승선' },
    { label: '물품보관', detail: '출발선 오른쪽 천막, 배번 끝자리별' },
    { label: '운영본부', detail: '특설무대 왼쪽 천막' },
  ],
  notes: [
    '해안로는 대회 중 차량이 통제돼요. 셔틀은 07:00–11:30 포항역↔대회장.',
    '기상 악화 시 코스가 줄어들 수 있어요. 변경은 이 화면과 현장 방송으로 알려요.',
  ],
} as const

export const checkpoints = [
  { km: 2.5, label: '1번 급수대' },
  { km: 5, label: '반환점 · 2번 급수대' },
  { km: 7.5, label: '3번 급수대' },
  { km: 10, label: '결승' },
] as const

/** A slightly positive-split 5'50" runner with a kick in the last km. */
const me: Runner = {
  bib: event.bib,
  name: '나',
  paces: [352, 345, 348, 350, 355, 358, 362, 360, 356, 340],
}

const named = ['박○준', '김○현', '최○아', '정○우', '한○민']

/** Deterministic field: even-paced runners from ~3'30" to ~9'00" per km. */
const field: Runner[] = Array.from({ length: 1239 }, (_, i) => {
  const q = (i + 0.5) / 1239
  const p = Math.round(208 + 332 * q ** 0.75)
  return {
    bib: String(20001 + i),
    name: named[i] ?? `참가자 ${20001 + i}`,
    paces: Array.from({ length: 10 }, () => p),
  }
})

export const race: Race = { distance: 10, me, field, checkpoints }

/** Where the demo clock starts: just past 6 km. */
export const demoStart = 2240
