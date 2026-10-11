import type { RaceEvent } from '../schema'
import { images } from './images'

/**
 * The race, as data. Name, date, schedule, course and the FAQ are demo
 * values (no real event is implied); the venue matches the RACE anchor.
 * The agent reads this through `get_race_info` / `search_guide`, never from
 * its prompt.
 */
const raceDate = '2026-10-13'
const raceDay = new Date(`${raceDate}T00:00:00+09:00`)
const dateLabel = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
}).format(raceDay)

export const event: RaceEvent = {
  name: '2026 포항 영일만 해변런',
  image: images.event?.url ?? '/images/yeongildae.jpg',
  category: '10km · 5km',
  date: raceDate,
  dateLabel,
  gun: '08:30',
  venue: '영일대해수욕장 특설무대',
  address: '경북 포항시 북구 두호동 영일대해수욕장',
  geo: { lat: 36.0565, lng: 129.378 },
  cutoff: '10km 90분 (10:00 결승 통과 마감) · 5km 60분',
  schedule: [
    { time: '07:00', label: '물품보관·탈의실 운영 시작, 배번 현장 수령' },
    { time: '08:00', label: '집결 · 단체 스트레칭' },
    { time: '08:30', label: '10km 출발' },
    { time: '08:40', label: '5km 출발' },
    { time: '09:40', label: '5km 제한시간 종료' },
    { time: '10:00', label: '10km 제한시간 종료 · 코스 통제 해제' },
    { time: '10:30', label: '시상식' },
    { time: '11:30', label: '물품 반환 마감' },
  ],
  course: {
    distanceKm: 10,
    summary:
      '영일대해수욕장에서 출발해 해안도로를 따라 남쪽으로 달린 뒤 5km 지점에서 돌아오는 평탄한 왕복 코스예요. 5km 종목은 2.5km 지점에서 반환해요.',
    route: [
      '영일대해수욕장 특설무대 출발',
      '해안도로 남쪽 방향',
      '2.5km 1번 급수대 (5km 반환점)',
      '5km 반환점 · 2번 급수대',
      '7.5km 3번 급수대',
      '영일대 결승',
    ],
    checkpoints: [
      { km: 2.5, label: '1번 급수대 · 5km 반환점' },
      { km: 5, label: '10km 반환점 · 2번 급수대' },
      { km: 7.5, label: '3번 급수대' },
      { km: 10, label: '결승' },
    ],
  },
  kit: [
    '배번표 (가슴 앞쪽, 접지 않기)',
    '기록칩 (오른쪽 신발끈에 고정, 결승 후 반납 없음)',
    '물품보관 태그 (가방에 부착)',
    '갈아입을 옷 · 개인 상비약',
  ],
  facilities: [
    { label: '급수대', detail: '2.5km · 5km · 7.5km · 결승 (물·이온음료)' },
    { label: '의무 지원', detail: '출발선 · 5km 반환점 · 결승선 의료부스' },
    {
      label: '물품보관',
      detail: '출발선 오른쪽 천막, 배번 끝자리별 · 07:00–11:30',
    },
    { label: '탈의실', detail: '특설무대 뒤편 남·여 구분 천막' },
    { label: '화장실', detail: '해수욕장 공중화장실 · 출발선 이동식 화장실' },
    { label: '운영본부', detail: '특설무대 왼쪽 천막 · 분실물·기록 문의' },
  ],
  rules: [
    '제한시간을 넘기면 회수차량에 탑승해 주세요.',
    '배번 양도·대리 출전은 기록이 인정되지 않아요.',
    '이어폰은 한쪽만 쓰거나 볼륨을 낮춰 주세요.',
    '반려동물·유모차 동반 주행은 안전을 위해 제한해요.',
  ],
  notes: [
    '해안도로는 08:00–10:00 차량이 통제돼요.',
    '셔틀버스: 07:00–11:30 포항역 ↔ 대회장, 20분 간격 (시연 정보).',
    '대회장 주차장은 협소해요. 대중교통이나 셔틀을 권해요.',
    '기상 악화 시 코스가 줄어들 수 있어요. 변경은 앱과 현장 방송으로 알려요.',
  ],
  faq: [
    {
      q: '배번은 언제 받나요?',
      a: '사전 택배 발송이 원칙이고, 못 받았다면 당일 07:00부터 운영본부에서 신분증으로 수령해요.',
    },
    {
      q: '기록은 어디서 확인해요?',
      a: '결승 후 30분 안에 앱의 레이스 탭과 현장 기록 게시판에 올라와요.',
    },
    {
      q: '완주 메달과 기념품은?',
      a: '결승 통과 후 바로 메달과 간식을 받아요. 기념품 티셔츠는 배번과 함께 받아요.',
    },
    {
      q: '비가 오면 대회가 취소되나요?',
      a: '우천에도 진행해요. 강풍·호우 특보 같은 기상 악화 때만 코스를 줄이거나 취소하고, 앱과 문자로 알려요.',
    },
    {
      q: '대회장까지 어떻게 가요?',
      a: '포항역에서 셔틀(07:00–11:30) 또는 시내버스로 영일대해수욕장까지 약 30분이에요. 택시는 약 20분이에요.',
    },
    {
      q: '샤워 시설이 있나요?',
      a: '대회장에는 샤워 시설이 없어요. 탈의실만 운영해요.',
    },
  ],
  meta: {
    provenance: 'DEMO',
    verified: false,
    presentationAt: '2026-10-13T17:00:00+09:00',
    scenarioAt: '2026-10-13T10:40:00+09:00',
  },
}
