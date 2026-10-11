import type { TripConfig } from './schema'
import { courses, modes } from './seed/courses'
import { event } from './seed/event'
import { guide } from './seed/guide'
import { places } from './seed/places'

/**
 * Seed configuration. On first boot it is written to the database as jsonb
 * (`app_config`, `places`) and from then on the database copy wins.
 * Every number below is a *demo policy*, not an official transport or
 * health standard.
 */
export const seedConfig: TripConfig = {
  // 2: courses, ways home, race event (see seed/). 3: featured course, live
  // decision source, stairs. 5: presentation date, four E-UM sources, scoped leg buffers.
  // 6: Guryongpo/Homigot scope and precise demo-route diagnostics.
  // Operator-edited documents are preserved.
  // 7: distinct modal estimates; official route references do not supply these minutes.
  version: 7,
  event,
  courses,
  modes,
  guide,
  policy: {
    // The service is about Guryongpo; other courses are the fallback.
    featuredCourse: 'guryongpo',
    restCapMin: 180,
    local: { firstApproach: 5, lastApproach: 5 },
    signals: [
      {
        kind: 'reserve-by-band',
        reading: 'congestion',
        label: '구룡포 교통 혼잡',
        bands: [
          { gte: 75, reserveMin: 10 },
          { gte: 50, reserveMin: 5 },
        ],
        unknownReserveMin: 10,
      },
      {
        kind: 'outdoor-limit',
        reading: 'pm25',
        label: '초미세먼지',
        limit: 36,
      },
      { kind: 'outdoor-limit', reading: 'uvIndex', label: '자외선', limit: 8 },
    ],
    copy: {
      medical:
        '관광 계획을 멈추고 현장 의료부스 또는 운영요원에게 도움을 요청해 주세요.',
      incomplete: '컨디션과 짐 회수 여부를 먼저 확인해 주세요.',
      atStation: '{hub} 도착을 직접 확인했어요.',
      routeMissing:
        '경로 확인이 필요한 시연 조건이 적용돼 있어 일정을 계산하지 않았어요. 시연 메뉴의 기본 코스로 복원하거나 지도에서 경로를 확인해 주세요.',
      outboundWindowMissing:
        '{start} 출발은 시연에 등록된 출발시간 {from}–{to} 밖이에요. 실제 버스가 없다는 뜻은 아니며, 지도에서 이동 경로를 확인해 주세요.',
      returnRouteMissing:
        '현재 시각에 맞는 복귀 경로가 없어요. 외부 지도에서 확인해 주세요.',
      returnLeg:
        '도보·대기를 포함한 시연 이동 {returnMin}분으로 {hub}(으)로 가요.',
      reserveUnknown:
        '최신 관측을 확인할 수 없어 보수적으로 구룡포를 지나는 도로 이동 구간마다 여유 {reserve}분을 반영했어요.',
      reserveBand:
        '{label} 신호에 따라 구룡포를 지나는 도로 이동 구간마다 여유 {reserve}분을 더했어요.',
      outdoorUnknown:
        '환경 관측을 확인할 수 없어요. 야외 체류 전 현장 상황을 확인해 주세요.',
      outdoorLimit:
        '{label} 관측과 앱의 보수적인 기준에 따라 실내 위주로 구성했어요.',
      fullCourse:
        '{area}에서 {count}곳을 둘러보고 {noun} {buffer}분 전에 {hub}에 도착하는 계획이에요.',
      fullCourseBack:
        '{area}에서 {count}곳을 둘러보고 {time}까지 {hub}(으)로 돌아오는 계획이에요.',
      noHubRoute: '{area}에서 {hub}(으)로 가는 경로가 등록돼 있지 않아요.',
      windowMissing: '변경된 복귀 시각은 등록된 경로의 범위 밖이에요.',
      cancel:
        '{area}는 가장 짧은 코스도 {noun} 시간이나 걷기 조건에 맞추기 어려워요. 관광 대신 {hub}(으)로 가는 길을 확인해 주세요.',
      noInterest: '{area}에는 고른 활동에 맞는 장소가 없어요.',
      featuredSkipped:
        '{featured}는 지금 조건으로 다녀오기 어려워 {area} 코스를 골랐어요.',
      excludedByUser: '직접 제외한 장소',
      excludedOutdoor: '야외 체류 제한',
      excludedByTime: '귀가 시간과 걷기 조건 반영',
      excludedByInterest: '고른 활동이 아님',
      excludedStairs: '계단 있는 동선이라 제외',
    },
  },
  places,
  anchors: [
    { id: 'RACE', name: '영일대해수욕장', geo: { lat: 36.0565, lng: 129.378 } },
    {
      id: 'HOTEL',
      name: '영일대 인근 숙소',
      geo: { lat: 36.0565, lng: 129.378 },
    },
    { id: 'STATION', name: '포항역', geo: { lat: 36.0714, lng: 129.3418 } },
    {
      id: 'TERMINAL',
      name: '포항버스터미널',
      geo: { lat: 36.0255, lng: 129.359 },
    },
    {
      id: 'AIRPORT',
      name: '포항경주공항',
      geo: { lat: 35.9879, lng: 129.4206 },
    },
    {
      id: 'PARKING',
      name: '대회장(영일대)',
      geo: { lat: 36.0565, lng: 129.378 },
    },
  ],
  sources: [
    {
      id: 'INT_S07_005',
      label: 'E-UM 시간대별 교통 혼잡율',
      url: 'https://genix.pohang-eum.kr/dpg/traffic/congestion',
      enabled: true,
      params: {},
      reading: 'congestion',
      valueField: 'cntPerc',
      timeField: 'hour',
      timezone: 'Asia/Seoul',
      range: { min: 0, max: 1000 },
      unit: '%',
      keepFields: ['cntPerc', 'hour'],
      timeoutMs: 3000,
      // Hourly values (2026-10-08: hour=20:00 fetched at 20:13 KST). Older than 2h = stale.
      maxAgeSeconds: 7200,
      decision: true,
      meta: {
        docs: 'https://pohang-eum.kr/data/list/detail/INT_S07_005',
        note: '구룡포 설치 장비 통합 혼잡율(%), 100% 초과 실응답 가능. 1시간 단위 관측. 실응답이 2시간 이내면 코스 판단에 반영.',
      },
    },
    {
      id: 'INT_S01_004',
      label: 'E-UM 대기환경 실시간(단일 장비)',
      url: 'https://genix.pohang-eum.kr/dpg/atmosphere/device/realtime',
      enabled: true,
      params: { id: { env: 'EUM_AIR_DEVICE_ID' } },
      reading: 'pm25Realtime',
      valueField: 'pm25',
      timeField: 'logDateTime',
      timezone: 'Asia/Seoul',
      range: { min: 0, max: 1000 },
      unit: '제공처 표기 PPM · 단위 검증 필요',
      keepFields: ['pm25', 'pm10', 'temp', 'humi', 'logDateTime', 'devId'],
      timeoutMs: 3000,
      maxAgeSeconds: null,
      // Unit unverified (provider says PPM): shown as evidence, never used to decide.
      decision: false,
      meta: {
        docs: 'https://pohang-eum.kr/data/list/detail/INT_S01_004',
        note: '제공처 문서는 pm25 단위를 PPM으로 표기. μg/m³ 여부 확인 전까지 결정에 사용하지 않음.',
      },
    },
    {
      id: 'INT_S01_012',
      label: 'E-UM 구룡포 초미세먼지 시간 통계',
      url: 'https://genix.pohang-eum.kr/dpg/atmosphere/sensor/stats/hour',
      enabled: true,
      params: { type: { value: 'pm25' }, date: { clock: 'today-kst' } },
      reading: 'pm25',
      valueField: 'value',
      timeField: 'observationTime',
      timezone: 'Asia/Seoul',
      range: { min: 0, max: 1000 },
      unit: 'μg/m³',
      keepFields: ['devId', 'type', 'unit', 'level', 'hours'],
      timeoutMs: 5000,
      maxAgeSeconds: 7200,
      decision: false,
      meta: {
        docs: 'https://pohang-eum.kr/data/list/detail/INT_S01_012',
        expectedUnit: 'μg/m³',
        note: '단위·관측 시각 검증. 구룡포 수협 위판장 인근 장비 8을 코스 주변 참고 관측으로 사용. 지역 전체를 보장하지 않음.',
        deviceId: '8',
        deviceLatitude: 35.990694,
        deviceLongitude: 129.555917,
        deviceDocs: 'https://pohang-eum.kr/data/list/detail/INT_S01_001',
        verifiedAt: '2026-10-11',
      },
    },
    {
      id: 'INT_S06_005',
      label: 'E-UM 구룡포 자외선',
      url: 'https://genix.pohang-eum.kr/dpg/sensor/latest/uvIndex',
      enabled: true,
      params: {},
      reading: 'uvIndex',
      valueField: 'uvIndex',
      timeField: 'dateTime',
      timezone: 'Asia/Seoul',
      range: { min: 0, max: 30 },
      unit: '지수',
      keepFields: ['uvIndex', 'dateTime'],
      timeoutMs: 5000,
      maxAgeSeconds: 7200,
      decision: true,
      meta: {
        docs: 'https://pohang-eum.kr/data/list/detail/INT_S06_005',
        note: '구룡포 관측 · 6 이상 햇빛 주의, 8 이상 실내 우선',
      },
    },
  ],
  agent: {
    model: 'gpt-6-luna',
    temperature: 0.2,
    maxSteps: 5,
    maxToolCalls: 4,
    timeoutMs: 20000,
    maxOutputTokens: 600,
    suggestions: ['16시로 바뀌었어', '왜 이 코스야?', '다른 코스는?'],
  },
  conversation: {
    onboarding: ['departMode', 'departTime', 'course', 'interests', 'origin'],
    // Ready time first, so the stage moves on once the condition is known.
    checkIn: ['readyTime', 'condition'],
    slots: {
      departMode: {
        question: '대회 끝나고 어떻게 돌아가요?',
        hint: '예: KTX 타고 서울 가요',
        multiple: false,
        // Chips come from \`modes\`.
        choices: [],
      },
      departTime: {
        // Question, hint and chips come from the chosen mode.
        question: '몇 시에 출발해요?',
        hint: '예: 18시 30분',
        multiple: false,
        choices: [],
      },
      course: {
        question: '완주하고 어디로 가 볼까요?',
        hint: '예: 호미곶 가 보고 싶어요',
        multiple: false,
        // Chips come from \`courses\`, then this one.
        choices: [
          {
            label: '추천해 주세요',
            say: '시간에 맞게 추천해 주세요',
            value: 'auto',
            reply: '시간과 하고 싶은 일에 맞춰 코스를 골라 둘게요.',
          },
        ],
      },
      interests: {
        question: '가서 뭐 하고 싶어요? 여러 개 골라도 돼요.',
        hint: '예: 밥 먹고 바다 보고 싶어요',
        multiple: true,
        choices: [
          { label: '맛있는 한 끼', say: '맛있는 한 끼', value: 'food' },
          { label: '산책·골목 구경', say: '산책·골목 구경', value: 'walk' },
          { label: '바다 전망·사진', say: '바다 전망·사진', value: 'view' },
          { label: '실내 볼거리', say: '실내 볼거리', value: 'indoor' },
          { label: '카페 휴식', say: '카페 휴식', value: 'cafe' },
        ],
      },
      origin: {
        question: '대회장에서 바로 출발해요, 숙소에 들렀다 가요?',
        hint: '예: 숙소에서 짐 찾고 갈게요',
        multiple: false,
        choices: [
          {
            label: '대회장에서 바로',
            say: '대회장에서 바로 갈게요',
            value: 'RACE',
          },
          {
            label: '숙소 들렀다가',
            say: '숙소에 들렀다 갈게요',
            value: 'HOTEL',
          },
        ],
      },
      arrivalAt: {
        question: '포항에는 언제 도착해요?',
        hint: '예: 전날 오후 5시',
        multiple: false,
        choices: [],
      },
      readyTime: {
        question: '언제 출발할 수 있어요?',
        hint: '예: 30분 쉬고 갈게요',
        multiple: false,
        choices: [],
      },
      condition: {
        question: '몸은 어때요?',
        hint: '예: 조금 지쳤어요',
        multiple: false,
        choices: [
          { label: '괜찮아요', say: '괜찮아요', value: 'OK' },
          { label: '조금 지쳤어요', say: '조금 지쳤어요', value: 'TIRED' },
          { label: '몸이 안 좋아요', say: '몸이 안 좋아요', value: 'UNWELL' },
        ],
      },
      walkingLimit: {
        question: '걷는 건 얼마나 괜찮아요?',
        hint: '예: 15분만 걸을래요',
        multiple: false,
        choices: [
          { label: '15분 이내', say: '15분만 걸을래요', value: 15 },
          { label: '30분 이내', say: '30분 정도는 걸어도 돼요', value: 30 },
        ],
      },
      baggageCollected: {
        question: '짐은 챙겼어요?',
        hint: '예: 짐 다 챙겼어요',
        multiple: false,
        choices: [
          { label: '챙겼어요', say: '짐 다 챙겼어요', value: true },
          { label: '아직이요', say: '짐은 아직이에요', value: false },
        ],
      },
    },
  },
  scenarios: [
    {
      id: 'base',
      title: '기본 코스',
      desc: '18:30 열차 · 점심 + 골목 + 카페',
      base: 'reset',
      plan: { condition: 'TIRED', course: 'guryongpo' },
      readings: { congestion: 42, pm25: 10, uvIndex: 2 },
      observations: { freshness: 'FRESH' },
      screen: 'course',
    },
    {
      id: 'early',
      title: '16:00 귀가',
      desc: '카페 제외 · 골목 구경 단축',
      base: 'reset',
      plan: { condition: 'TIRED', departTime: '16:00', course: 'guryongpo' },
      readings: { congestion: 42, pm25: 10, uvIndex: 2 },
      observations: { freshness: 'FRESH' },
      screen: 'course',
    },
    {
      id: 'traffic',
      title: '혼잡만 82%로',
      desc: '현재 사용자 조건 유지 · 구룡포 도로 구간마다 여유 추가',
      base: 'keep',
      plan: {},
      readings: { congestion: 82 },
      observations: { freshness: 'FRESH' },
    },
    {
      id: 'air',
      title: '대기만 60으로',
      desc: '현재 사용자 조건 유지 · 야외 구경 제외',
      base: 'keep',
      plan: {},
      readings: { pm25: 60 },
      observations: { freshness: 'FRESH' },
    },
    {
      id: 'cancel',
      title: '출발 준비 지연',
      desc: '10:50 출발 · 16:00 귀가 · 혼잡 82%',
      base: 'reset',
      plan: {
        condition: 'TIRED',
        course: 'guryongpo',
        departTime: '16:00',
        readyTime: '10:50',
        currentTime: '10:50',
      },
      readings: { congestion: 82 },
      observations: {},
      screen: 'course',
    },
    {
      id: 'missing',
      title: '복귀 경로 누락',
      desc: '이동 가능 확정 없이 확인 안내',
      base: 'keep',
      plan: {},
      readings: {},
      observations: { routeAvailable: false },
    },
    {
      id: 'stale',
      title: '오래된 관측',
      desc: '신선하지 않은 관측을 판단에서 제외',
      base: 'keep',
      plan: {},
      readings: {},
      observations: { freshness: 'STALE' },
    },
  ],
  defaults: {
    plan: {
      revision: 0,
      arrivalAt: `${new Date(Date.parse(`${event.date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)}T17:00`,
      departMode: 'TRAIN',
      departTime: '18:30',
      course: 'auto',
      readyTime: '10:40',
      condition: 'UNANSWERED',
      walkingLimit: 30,
      baggageCollected: true,
      origin: 'RACE',
      interests: ['food', 'walk', 'cafe'],
      excluded: [],
      restMin: 0,
      stage: 'BEFORE',
      completed: [],
      currentTime: '10:40',
      currentPlace: 'RACE',
    },
    observations: {
      readings: { congestion: null, pm25: null, uvIndex: null },
      sources: {},
      freshness: 'FRESH',
      routeAvailable: true,
      provenance: 'SIMULATED',
      observedAt: null,
    },
  },
}
