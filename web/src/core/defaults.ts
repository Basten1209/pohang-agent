import type { TripConfig } from './schema'

/**
 * Seed configuration. On first boot it is written to the database as jsonb
 * (`app_config`, `places`) and from then on the database copy wins.
 * Every number below is a *demo policy*, not an official transport or
 * health standard.
 */
export const seedConfig: TripConfig = {
  version: 1,
  policy: {
    stationBufferMin: 30,
    restCapMin: 180,
    legs: {
      outbound: {
        minutes: 90,
        accessWalk: 10,
        window: { from: '10:00', to: '12:00' },
      },
      return: {
        minutes: 120,
        accessWalk: 10,
        stopAccess: 5,
        window: { from: '12:00', to: '18:00' },
      },
    },
    local: { firstApproach: 5, lastApproach: 5 },
    signals: [
      {
        kind: 'reserve-by-band',
        reading: 'congestion',
        label: '구룡포 통합 혼잡',
        bands: [
          { gte: 75, reserveMin: 20 },
          { gte: 50, reserveMin: 10 },
        ],
        unknownReserveMin: 20,
      },
      {
        kind: 'outdoor-limit',
        reading: 'pm25',
        label: '초미세먼지',
        limit: 50,
      },
    ],
    variants: [
      {
        id: 'full',
        stops: [
          { place: 'food', dwell: 60, walk: 0 },
          { place: 'street', dwell: 20, walk: 10 },
          { place: 'cafe', dwell: 40, walk: 0 },
        ],
        reason: null,
      },
      {
        id: 'short',
        stops: [
          { place: 'food', dwell: 50, walk: 0 },
          { place: 'street', dwell: 5, walk: 5 },
        ],
        reason: '열차 시간에 맞춰 카페를 빼고 골목 구경을 5분으로 줄였어요.',
      },
      {
        id: 'minimal',
        stops: [{ place: 'food', dwell: 50, walk: 0 }],
        reason: '점심만 남겨 귀가 시간을 확보했어요.',
      },
    ],
    copy: {
      medical:
        '관광 계획을 멈추고 현장 의료부스 또는 운영요원에게 도움을 요청해 주세요.',
      incomplete: '컨디션과 짐 회수 여부를 먼저 확인해 주세요.',
      atStation: '포항역 도착을 직접 확인했어요.',
      routeMissing:
        '이 출발 시각에 맞는 왕복 경로가 없어요. 지도에서 경로를 확인해 주세요.',
      returnRouteMissing:
        '현재 시각에 맞는 복귀 경로가 없어요. 외부 지도에서 확인해 주세요.',
      returnLeg:
        '정류장 접근 {stopAccess}분과 시연 버스 {returnMin}분을 반영해 포항역으로 이동해요.',
      reserveUnknown:
        '최신 관측을 확인할 수 없어 시연 정책의 교통 여유 {reserve}분을 반영했어요.',
      reserveBand:
        '{label} 신호에 따라 교통 여유 {reserve}분을 한 번 더했어요.',
      outdoorUnknown:
        '대기 조건을 확인할 수 없어 선택적 야외 구경을 제외했어요.',
      outdoorLimit: '시연 대기 정책에 따라 야외 골목 구경을 제외했어요.',
      fullCourse:
        '선택한 {count}곳을 둘러보고 열차 출발 {buffer}분 전에 역에 도착하는 계획이에요.',
      windowMissing: '변경된 복귀 시각은 등록된 경로의 범위 밖이에요.',
      cancel:
        '최소 식사 코스도 귀가 시간 또는 걷기 조건을 맞추기 어려워요. 관광 대신 귀가 경로를 확인해 주세요.',
      excludedByUser: '직접 제외한 장소',
      excludedOutdoor: '야외 체류 제한',
      excludedByTime: '귀가 시간과 걷기 조건 반영',
    },
  },
  places: [
    {
      id: 'food',
      kind: 'FOOD',
      sort: 10,
      active: true,
      attrs: {
        title: '구룡포에서 든든한 한 끼',
        short: '항구 앞 점심',
        subtitle: '구룡포시장 · 식당 후보',
        category: 'LOCAL FOOD',
        desc: '달린 뒤 찾아온 반가운 허기. 구룡포시장 근처에서 여유 있게 점심을 먹으며 여행을 시작해요.',
        detail:
          '식당은 아직 선정 전입니다. 이 데모에서는 구룡포시장 권역을 목적지로 사용해요. 1인 식사 가능 여부, 메뉴와 가격, 영업시간은 현지 확인이 필요합니다.',
        icon: 'utensils',
        image: '/images/guryongpo-harbor.jpg',
        actionLabel: '식사',
        interestLabel: '맛있는 점심',
        outdoor: false,
        defaultDwell: 60,
        geo: { lat: 35.9868, lng: 129.5528 },
      },
      meta: { provenance: 'PLACEHOLDER', verified: false },
    },
    {
      id: 'street',
      kind: 'STREET',
      sort: 20,
      active: true,
      attrs: {
        title: '골목을 따라, 구룡포 한 장',
        short: '일본인 가옥거리',
        subtitle: '오래된 집과 작은 골목',
        category: 'SLOW WALK',
        desc: '항구 마을의 시간이 남아 있는 일본인 가옥거리. 짧게 둘러보고 오늘의 사진 한 장을 남겨요.',
        detail:
          '일본인 가옥거리의 짧은 구간을 둘러보는 시연 코스예요. 구룡포공원 계단은 코스에서 제외했습니다. 실제 보행 구간의 경사와 접근성은 확인이 필요합니다.',
        icon: 'footprints',
        image: '/images/guryongpo-street.jpg',
        actionLabel: '구경',
        interestLabel: '짧은 구경',
        outdoor: true,
        defaultDwell: 20,
        geo: { lat: 35.9902, lng: 129.5595 },
      },
      meta: {
        provenance: 'PLACEHOLDER',
        verified: false,
        photo:
          'https://badaon.or.kr/seantour_map/travel/destination/detail.do?destId=DEST000662',
      },
    },
    {
      id: 'cafe',
      kind: 'CAFE',
      sort: 30,
      active: true,
      attrs: {
        title: '서두르지 않는 커피 한 잔',
        short: '골목 카페에서 휴식',
        subtitle: '가옥거리 인근 · 카페 후보',
        category: 'COFFEE BREAK',
        desc: '여행의 마지막은 느긋하게. 항구 마을의 분위기를 느끼며 앉아서 잠깐 쉬어 가요.',
        detail:
          '카페는 아직 선정 전입니다. 가옥거리 인근 후보를 가정한 체류 시간이므로 상호·영업시간·가격·출입 동선 확인 후 실제 목적지를 등록해야 합니다.',
        icon: 'coffee',
        image: '/images/guryongpo-street.jpg',
        actionLabel: '휴식',
        interestLabel: '카페 휴식',
        outdoor: false,
        defaultDwell: 40,
        geo: { lat: 35.9902, lng: 129.5595 },
      },
      meta: { provenance: 'PLACEHOLDER', verified: false },
    },
  ],
  anchors: [
    { id: 'STATION', name: '포항역', geo: { lat: 36.0714, lng: 129.3418 } },
    { id: 'RACE', name: '영일대해수욕장', geo: { lat: 36.0565, lng: 129.378 } },
    {
      id: 'HOTEL',
      name: '영일대해수욕장',
      geo: { lat: 36.0565, lng: 129.378 },
    },
    {
      id: 'GURYONGPO',
      name: '구룡포시장',
      geo: { lat: 35.9868, lng: 129.5528 },
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
      range: { min: 0, max: 100 },
      unit: '%',
      keepFields: ['cntPerc', 'hour'],
      timeoutMs: 3000,
      maxAgeSeconds: null,
      meta: {
        docs: 'https://pohang-eum.kr/data/list/detail/INT_S07_005',
        note: '전체 장비 통합 혼잡율. 갱신 주기 미검증.',
      },
    },
    {
      id: 'INT_S01_004',
      label: 'E-UM 대기환경 실시간(단일 장비)',
      url: 'https://genix.pohang-eum.kr/dpg/atmosphere/device/realtime',
      enabled: true,
      params: { id: { env: 'EUM_AIR_DEVICE_ID' } },
      reading: 'pm25',
      valueField: 'pm25',
      timeField: 'logDateTime',
      timezone: 'Asia/Seoul',
      range: { min: 0, max: 1000 },
      unit: '제공처 표기 PPM · 단위 검증 필요',
      keepFields: ['pm25', 'pm10', 'temp', 'humi', 'logDateTime', 'devId'],
      timeoutMs: 3000,
      maxAgeSeconds: null,
      meta: {
        docs: 'https://pohang-eum.kr/data/list/detail/INT_S01_004',
        note: '제공처 문서는 pm25 단위를 PPM으로 표기. μg/m³ 여부 확인 전까지 결정에 사용하지 않음.',
      },
    },
  ],
  agent: {
    model: 'gpt-6-luna',
    maxSteps: 4,
    maxToolCalls: 3,
    timeoutMs: 20000,
    maxOutputTokens: 600,
    suggestions: ['16시 기차로 바꿨어', '왜 이 코스야?', '역까지 택시 타면?'],
  },
  conversation: {
    onboarding: ['trainTime', 'interests', 'origin'],
    // Ready time first, so the stage moves on once the condition is known.
    checkIn: ['readyTime', 'condition'],
    slots: {
      trainTime: {
        question: '서울 가는 열차는 몇 시예요?',
        hint: '예: 18시 30분 기차',
        multiple: false,
        choices: [
          { label: '16:00', say: '16시 기차예요', value: '16:00' },
          { label: '17:30', say: '17시 30분 기차예요', value: '17:30' },
          { label: '18:30', say: '18시 30분 기차예요', value: '18:30' },
          {
            label: '아직 몰라요',
            say: '아직 몰라요',
            value: null,
            reply: '그럼 18:30 열차로 가정해 둘게요. 정해지면 말해 주세요.',
          },
        ],
      },
      interests: {
        question: '완주하고 구룡포에서 뭐 하고 싶어요? 여러 개 골라도 돼요.',
        hint: '예: 점심이랑 카페',
        multiple: true,
        choices: [],
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
      plan: { condition: 'TIRED' },
      readings: {},
      observations: {},
      screen: 'course',
    },
    {
      id: 'early',
      title: '16:00 귀가',
      desc: '카페 제외 · 골목 구경 단축',
      base: 'reset',
      plan: { condition: 'TIRED', trainTime: '16:00' },
      readings: {},
      observations: {},
      screen: 'course',
    },
    {
      id: 'traffic',
      title: '혼잡만 82%로',
      desc: '현재 사용자 조건 유지 · 교통 여유 +20분',
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
        trainTime: '16:00',
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
      arrivalAt: '2026-10-12T17:00',
      trainTime: '18:30',
      readyTime: '10:40',
      condition: 'UNANSWERED',
      walkingLimit: 30,
      baggageCollected: true,
      origin: 'RACE',
      interests: ['food', 'street', 'cafe'],
      excluded: [],
      restMin: 0,
      stage: 'BEFORE',
      completed: [],
      currentTime: '10:40',
      currentPlace: 'RACE',
    },
    observations: {
      readings: { congestion: 42, pm25: 10 },
      freshness: 'FRESH',
      routeAvailable: true,
      provenance: 'SIMULATED',
      observedAt: null,
    },
  },
}
