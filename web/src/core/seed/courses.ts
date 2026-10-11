import type { Course, Mode } from '../schema'

/**
 * Courses: one area each, with its own legs and shortening steps. Travel
 * minutes are demo policy (bus or taxi with waiting), not timetables, and
 * must be checked against real routes before use.
 */
export const courses: Course[] = [
  {
    id: 'guryongpo',
    sort: 10,
    active: true,
    title: '구룡포 항구 마을',
    area: '구룡포',
    desc: '항구 앞 시장에서 점심을 먹고 일본인 가옥거리를 걸은 뒤 골목 카페에서 쉬는 코스. 대회장에서 가장 먼 대신 바다 마을 분위기가 가장 진해요.',
    tags: ['항구', '골목', '사진', '시장'],
    geo: { lat: 35.9868, lng: 129.5528 },
    outbound: {
      minutes: 90,
      accessWalk: 10,
      window: { from: '10:00', to: '12:00' },
      via: '시내버스(환승 포함, 대기 포함)',
    },
    return: {
      minutes: { STATION: 120, TERMINAL: 110, AIRPORT: 90, PARKING: 110 },
      accessWalk: 10,
      stopAccess: 5,
      window: { from: '12:00', to: '18:00' },
      via: '시내버스(대기 포함)',
    },
    variants: [
      {
        id: 'full',
        stops: [
          { place: 'food', dwell: 60, walk: 0 },
          { place: 'street', dwell: 20, walk: 0, transferMin: 5 },
          { place: 'gp-museum', dwell: 30, walk: 5 },
          { place: 'cafe', dwell: 40, walk: 0, transferMin: 5 },
        ],
        reason: null,
      },
      {
        id: 'short',
        stops: [
          { place: 'food', dwell: 50, walk: 0 },
          { place: 'street', dwell: 5, walk: 5 },
        ],
        reason: '출발 시간에 맞춰 카페를 빼고 골목 구경을 5분으로 줄였어요.',
      },
      {
        id: 'minimal',
        stops: [{ place: 'food', dwell: 50, walk: 0 }],
        reason: '점심만 남겨 귀가 시간을 확보했어요.',
      },
    ],
    meta: {
      provenance: 'DEMO_POLICY',
      verified: false,
      trafficOutbound: true,
      trafficReturn: true,
    },
  },
  {
    id: 'homigot',
    sort: 20,
    active: true,
    title: '호미곶 해맞이',
    area: '호미곶',
    desc: '한반도 동쪽 끝 해맞이광장에서 상생의 손을 보고 국립등대박물관을 둘러보는 코스. 바다 전망과 실내 전시를 함께 즐길 수 있어요.',
    tags: ['바다 전망', '상징 조형물', '박물관'],
    geo: { lat: 36.0767, lng: 129.5684 },
    outbound: {
      minutes: 100,
      accessWalk: 5,
      window: { from: '10:00', to: '12:00' },
      via: '시내버스(구룡포 환승, 대기 포함)',
    },
    return: {
      minutes: { STATION: 130, TERMINAL: 120, AIRPORT: 90, PARKING: 120 },
      accessWalk: 5,
      stopAccess: 5,
      window: { from: '12:00', to: '18:00' },
      via: '시내버스(대기 포함)',
    },
    variants: [
      {
        id: 'full',
        stops: [
          { place: 'hm-food', dwell: 50, walk: 0 },
          { place: 'hm-hand', dwell: 20, walk: 10 },
          { place: 'hm-museum', dwell: 40, walk: 5 },
          { place: 'hm-cafe', dwell: 30, walk: 0 },
        ],
        reason: null,
      },
      {
        id: 'short',
        stops: [
          { place: 'hm-food', dwell: 45, walk: 0 },
          { place: 'hm-hand', dwell: 15, walk: 10 },
        ],
        reason: '출발 시간에 맞춰 박물관과 카페를 빼고 광장만 짧게 봐요.',
      },
      {
        id: 'minimal',
        stops: [{ place: 'hm-hand', dwell: 15, walk: 10 }],
        reason: '상생의 손만 보고 바로 돌아오도록 줄였어요.',
      },
    ],
    meta: { provenance: 'DEMO_POLICY', verified: false, trafficOutbound: true },
  },
  {
    id: 'yeongildae',
    sort: 30,
    active: true,
    title: '영일대·스페이스워크',
    area: '영일대',
    desc: '대회장 바로 옆이라 이동이 가장 짧은 코스. 물회로 점심을 먹고 해상누각과 스페이스워크를 걷고, 미술관이나 해변 카페에서 쉬어요.',
    tags: ['가까움', '바다 전망', '물회', '미술관'],
    geo: { lat: 36.0612, lng: 129.3845 },
    outbound: {
      minutes: 15,
      accessWalk: 5,
      window: { from: '09:00', to: '17:00' },
      via: '도보 또는 택시',
    },
    return: {
      minutes: { STATION: 30, TERMINAL: 25, AIRPORT: 45, PARKING: 10 },
      accessWalk: 5,
      stopAccess: 5,
      window: { from: '09:30', to: '21:00' },
      via: '시내버스 또는 택시',
    },
    variants: [
      {
        id: 'full',
        stops: [
          { place: 'yd-mulhoe', dwell: 50, walk: 5 },
          { place: 'yd-pavilion', dwell: 20, walk: 5 },
          { place: 'yd-spacewalk', dwell: 40, walk: 10 },
          { place: 'yd-art', dwell: 40, walk: 0 },
          { place: 'yd-cafe', dwell: 40, walk: 0 },
        ],
        reason: null,
      },
      {
        id: 'short',
        stops: [
          { place: 'yd-mulhoe', dwell: 45, walk: 5 },
          { place: 'yd-pavilion', dwell: 15, walk: 5 },
          { place: 'yd-cafe', dwell: 30, walk: 0 },
        ],
        reason: '스페이스워크와 미술관을 빼고 해변 가까이에서 마무리해요.',
      },
      {
        id: 'minimal',
        stops: [{ place: 'yd-mulhoe', dwell: 40, walk: 5 }],
        reason: '물회 한 그릇만 먹고 바로 이동해요.',
      },
    ],
    meta: { provenance: 'DEMO_POLICY', verified: false },
  },
  {
    id: 'jukdo',
    sort: 40,
    active: true,
    title: '죽도시장·포항운하',
    area: '죽도시장',
    desc: '동해안 대표 전통시장에서 회와 물회를 먹고, 포항운하를 걷거나 크루즈를 타는 코스. 버스터미널과 가까워 버스로 돌아가는 사람에게 좋아요.',
    tags: ['시장', '회', '운하', '터미널 근처'],
    geo: { lat: 36.0335, lng: 129.3655 },
    outbound: {
      minutes: 25,
      accessWalk: 5,
      window: { from: '09:00', to: '17:00' },
      via: '시내버스 또는 택시',
    },
    return: {
      minutes: { STATION: 25, TERMINAL: 15, AIRPORT: 35, PARKING: 25 },
      accessWalk: 5,
      stopAccess: 5,
      window: { from: '09:30', to: '21:00' },
      via: '시내버스 또는 택시',
    },
    variants: [
      {
        id: 'full',
        stops: [
          { place: 'jd-market', dwell: 60, walk: 10 },
          { place: 'jd-canalhall', dwell: 20, walk: 0 },
          { place: 'jd-cruise', dwell: 40, walk: 5 },
          { place: 'jd-canal', dwell: 20, walk: 5 },
          { place: 'jd-cafe', dwell: 30, walk: 0 },
        ],
        reason: null,
      },
      {
        id: 'short',
        stops: [
          { place: 'jd-market', dwell: 50, walk: 10 },
          { place: 'jd-canal', dwell: 15, walk: 5 },
        ],
        reason: '크루즈와 카페를 빼고 시장과 운하 산책만 남겼어요.',
      },
      {
        id: 'minimal',
        stops: [{ place: 'jd-market', dwell: 45, walk: 10 }],
        reason: '시장에서 식사만 하고 돌아가요.',
      },
    ],
    meta: { provenance: 'DEMO_POLICY', verified: false },
  },
]

/** Ways home. `bufferMin` is the demo margin to be at the hub before leaving. */
export const modes: Mode[] = [
  {
    id: 'TRAIN',
    label: '기차 (KTX·SRT)',
    say: '기차 타고 가요',
    hub: 'STATION',
    bufferMin: 30,
    noun: '열차',
    question: '몇 시 열차를 타요?',
    hint: '예: 18시 30분 열차',
    times: ['16:00', '17:30', '18:30'],
    unknownReply: '그럼 {time} 열차로 가정해 둘게요. 정해지면 말해 주세요.',
  },
  {
    id: 'BUS',
    label: '고속·시외버스',
    say: '버스 타고 가요',
    hub: 'TERMINAL',
    bufferMin: 20,
    noun: '버스',
    question: '몇 시 버스를 타요?',
    hint: '예: 17시 버스',
    times: ['15:30', '17:00', '18:30'],
    unknownReply: '그럼 {time} 버스로 가정해 둘게요. 정해지면 말해 주세요.',
  },
  {
    id: 'FLIGHT',
    label: '비행기',
    say: '비행기 타고 가요',
    hub: 'AIRPORT',
    bufferMin: 60,
    noun: '비행기',
    question: '몇 시 비행기예요?',
    hint: '예: 19시 30분 비행기',
    times: ['15:00', '17:30', '19:30'],
    unknownReply: '그럼 {time} 비행기로 가정해 둘게요. 정해지면 말해 주세요.',
  },
  {
    id: 'CAR',
    label: '자가용',
    say: '차를 가져왔어요',
    hub: 'PARKING',
    bufferMin: 10,
    noun: '출발',
    question: '몇 시엔 차로 출발할까요?',
    hint: '예: 오후 5시에 출발',
    times: ['15:00', '17:00', '19:00'],
    unknownReply: '그럼 {time} 출발로 가정해 둘게요. 정해지면 말해 주세요.',
  },
  {
    id: 'LOCAL',
    label: '포항에 살아요',
    say: '포항에 살아요',
    hub: 'PARKING',
    bufferMin: 0,
    noun: '귀가',
    question: '몇 시까지 돌아오면 돼요?',
    hint: '예: 저녁 7시까지',
    times: ['15:00', '17:00', '19:00'],
    unknownReply: '그럼 {time}까지 돌아오는 걸로 둘게요. 바뀌면 말해 주세요.',
  },
]
