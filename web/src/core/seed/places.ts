import type { Interest, Place } from '../schema'

/**
 * Place catalogue. Descriptions are written for the demo; hours, prices and
 * exact entrances are *not* verified (`meta.verified: false`) and the agent
 * must say so. Coordinates mark the area, not a checked entrance.
 */

type Attrs = {
  title: string
  short: string
  subtitle: string
  category: string
  desc: string
  detail: string
  icon: string
  image: string
  actionLabel: string
  interest: Interest
  outdoor: boolean
  defaultDwell: number
  geo: { lat: number; lng: number }
  address: string
  /** One practical tip for a tired runner; '' when there is none. */
  tips: string
  /** Reached by stairs: left out for a tired runner or a 15-minute walk. */
  stairs?: boolean
}
const at =
  (course: string, sortBase: number) =>
  (
    id: string,
    i: number,
    attrs: Attrs,
    meta: Record<string, unknown> = {},
  ): Place => ({
    id,
    kind: attrs.interest.toUpperCase(),
    sort: sortBase + i * 10,
    active: true,
    attrs: { ...attrs, course },
    meta: { provenance: 'PLACEHOLDER', verified: false, ...meta },
  })

const gp = at('guryongpo', 0)
const hm = at('homigot', 100)
const yd = at('yeongildae', 200)
const jd = at('jukdo', 300)

export const places: Place[] = [
  // ── 구룡포 ──────────────────────────────────────────────────────────
  gp('food', 1, {
    // ops: 식당 미선정. 구룡포시장 권역을 목적지로 사용.
    title: '구룡포에서 든든한 한 끼',
    short: '항구 앞 점심',
    subtitle: '구룡포시장 · 식당 후보',
    category: 'LOCAL FOOD',
    desc: '달린 뒤 찾아온 반가운 허기. 구룡포시장 근처에서 여유 있게 점심을 먹으며 여행을 시작해요.',
    detail:
      '겨울엔 과메기, 사계절 대게·물회·모리국수가 유명해요. 1인 식사 가능 여부와 메뉴·가격·영업시간은 가게마다 달라요.',
    icon: 'utensils',
    image: '/images/guryongpo-harbor.jpg',
    actionLabel: '식사',
    interest: 'food',
    outdoor: false,
    defaultDwell: 60,
    geo: { lat: 35.9868, lng: 129.5528 },
    address: '경북 포항시 남구 구룡포읍 구룡포시장 일대',
    tips: '모리국수는 2인 이상 주문만 받는 집이 있어요.',
  }),
  gp(
    'street',
    2,
    {
      title: '골목을 따라, 구룡포 한 장',
      short: '일본인 가옥거리',
      subtitle: '오래된 집과 작은 골목',
      category: 'SLOW WALK',
      desc: '항구 마을의 시간이 남아 있는 일본인 가옥거리. 짧게 둘러보고 오늘의 사진 한 장을 남겨요.',
      detail:
        '근대 시기 가옥이 이어진 약 450m 거리의 짧은 구간을 둘러봐요. 구룡포공원으로 오르는 돌계단은 코스에서 뺐어요.',
      icon: 'footprints',
      image: '/images/guryongpo-street.jpg',
      actionLabel: '구경',
      interest: 'walk',
      outdoor: true,
      defaultDwell: 20,
      geo: { lat: 35.9902, lng: 129.5595 },
      address: '경북 포항시 남구 구룡포읍 구룡포길',
      tips: '드라마 촬영지로 알려져 주말 오후엔 붐벼요.',
    },
    {
      photo:
        'https://badaon.or.kr/seantour_map/travel/destination/detail.do?destId=DEST000662',
    },
  ),
  gp('gp-museum', 3, {
    title: '과메기 이야기, 실내에서',
    short: '구룡포 과메기문화관',
    subtitle: '구룡포공원 위 · 실내 전시',
    category: 'INDOOR',
    desc: '구룡포를 대표하는 과메기의 역사와 어촌 생활을 보여주는 실내 전시관. 바람이 차거나 공기가 나쁜 날의 대안이에요.',
    detail:
      '가옥거리 끝 구룡포공원 돌계단 위에 있어 오르막을 걸어야 해요. 관람료·휴관일은 방문 전에 확인하세요.',
    icon: 'landmark',
    image: '',
    actionLabel: '관람',
    interest: 'indoor',
    outdoor: false,
    defaultDwell: 30,
    geo: { lat: 35.9916, lng: 129.5585 },
    address: '경북 포항시 남구 구룡포읍 구룡포공원 일대',
    tips: '계단 대신 차도로 돌아가는 길은 더 길어요.',
    stairs: true,
  }),
  gp('cafe', 4, {
    title: '서두르지 않는 커피 한 잔',
    short: '골목 카페에서 휴식',
    subtitle: '가옥거리 인근 · 카페 후보',
    category: 'COFFEE BREAK',
    desc: '여행의 마지막은 느긋하게. 항구 마을의 분위기를 느끼며 앉아서 잠깐 쉬어 가요.',
    detail:
      '가옥거리 주변에 작은 카페가 여럿 있어요. 영업시간과 좌석은 가게마다 달라요.',
    icon: 'coffee',
    image: '/images/guryongpo-street.jpg',
    actionLabel: '휴식',
    interest: 'cafe',
    outdoor: false,
    defaultDwell: 40,
    geo: { lat: 35.9902, lng: 129.5595 },
    address: '경북 포항시 남구 구룡포읍 구룡포길 인근',
    tips: '',
  }),

  // ── 호미곶 ──────────────────────────────────────────────────────────
  hm('hm-food', 1, {
    title: '해맞이광장 앞 물회 한 그릇',
    short: '호미곶 식당가',
    subtitle: '해맞이광장 주변 · 식당 후보',
    category: 'LOCAL FOOD',
    desc: '광장 앞 식당가에서 시원한 물회나 해물 칼국수로 허기를 달래요.',
    detail:
      '광장 주변에 물회·해물 식당이 모여 있어요. 메뉴·가격·영업시간은 가게마다 달라요.',
    icon: 'utensils',
    image: '',
    actionLabel: '식사',
    interest: 'food',
    outdoor: false,
    defaultDwell: 50,
    geo: { lat: 36.0757, lng: 129.5672 },
    address: '경북 포항시 남구 호미곶면 해맞이로 일대',
    tips: '',
  }),
  hm('hm-hand', 2, {
    title: '바다에서 솟은 손, 상생의 손',
    short: '상생의 손',
    subtitle: '호미곶 해맞이광장',
    category: 'SEA VIEW',
    desc: '바다와 광장에 하나씩 서 있는 거대한 손 조형물. 한반도 동쪽 끝의 바다를 배경으로 오늘의 사진을 남겨요.',
    detail:
      '광장이 넓고 평탄해 걷기 부담은 적지만 바람이 강한 날이 많아요. 야외라 대기 상태가 나쁘면 코스에서 빠져요.',
    icon: 'waves',
    image: '',
    actionLabel: '구경',
    interest: 'view',
    outdoor: true,
    defaultDwell: 20,
    geo: { lat: 36.0767, lng: 129.5684 },
    address: '경북 포항시 남구 호미곶면 해맞이로 150번길 일대',
    tips: '바닷바람이 차니 완주 후 땀 식기 전에 겉옷을 챙기세요.',
  }),
  hm('hm-museum', 3, {
    title: '등대의 모든 것',
    short: '국립등대박물관',
    subtitle: '해맞이광장 옆 · 실내 전시',
    category: 'INDOOR',
    desc: '우리나라 등대의 역사와 장비를 모은 박물관. 광장 바로 옆이라 동선이 짧아요.',
    detail:
      '실내 전시 위주라 날씨 영향이 적어요. 관람료·휴관일은 방문 전에 확인하세요.',
    icon: 'landmark',
    image: '',
    actionLabel: '관람',
    interest: 'indoor',
    outdoor: false,
    defaultDwell: 40,
    geo: { lat: 36.0773, lng: 129.5671 },
    address: '경북 포항시 남구 호미곶면 해맞이로 150번길 20 일대',
    tips: '',
  }),
  hm('hm-cafe', 4, {
    title: '바다 보며 쉬어 가기',
    short: '광장 앞 카페',
    subtitle: '해맞이광장 주변 · 카페 후보',
    category: 'COFFEE BREAK',
    desc: '창밖으로 동해가 보이는 카페에서 다리를 쉬게 해요.',
    detail:
      '광장 주변 카페에서 바다를 보며 쉴 수 있어요. 영업시간은 가게마다 달라요.',
    icon: 'coffee',
    image: '',
    actionLabel: '휴식',
    interest: 'cafe',
    outdoor: false,
    defaultDwell: 30,
    geo: { lat: 36.0762, lng: 129.5662 },
    address: '경북 포항시 남구 호미곶면 해맞이광장 주변',
    tips: '',
  }),

  // ── 영일대·스페이스워크 ─────────────────────────────────────────────
  yd('yd-mulhoe', 1, {
    title: '포항식 물회, 설머리에서',
    short: '설머리 물회지구',
    subtitle: '영일대 북쪽 · 물회 식당 모인 곳',
    category: 'LOCAL FOOD',
    desc: '대회장에서 북쪽으로 조금만 가면 물회 집이 모여 있어요. 달린 뒤 시원한 포항식 물회 한 그릇.',
    detail:
      '포항식 물회는 고추장 양념에 물을 조금씩 부어 먹는 방식이 많아요. 메뉴·가격·영업시간은 가게마다 달라요.',
    icon: 'utensils',
    image: '',
    actionLabel: '식사',
    interest: 'food',
    outdoor: false,
    defaultDwell: 50,
    geo: { lat: 36.0632, lng: 129.3858 },
    address: '경북 포항시 북구 두호동 설머리 일대',
    tips: '대회 당일 점심엔 러너가 몰려 대기가 길 수 있어요.',
  }),
  yd('yd-pavilion', 2, {
    title: '바다 위 누각에서 숨 고르기',
    short: '영일대 해상누각',
    subtitle: '영일대해수욕장 앞 바다',
    category: 'SEA WALK',
    desc: '해변에서 다리로 이어진 바다 위 누각. 결승선 바로 앞이라 완주 사진 명소예요.',
    detail: '다리를 건너 누각까지 평탄한 길이에요.',
    icon: 'footprints',
    image: '',
    actionLabel: '산책',
    interest: 'walk',
    outdoor: true,
    defaultDwell: 20,
    geo: { lat: 36.0563, lng: 129.3796 },
    address: '경북 포항시 북구 두호동 영일대해수욕장',
    tips: '',
  }),
  yd('yd-spacewalk', 3, {
    title: '하늘을 걷는 트랙',
    short: '스페이스워크',
    subtitle: '환호공원 · 걷는 조형물',
    category: 'SEA VIEW',
    desc: '롤러코스터처럼 휘어진 계단 트랙을 직접 걸어 오르는 조형물. 꼭대기에서 영일만이 한눈에 보여요.',
    detail:
      '트랙은 약 333m, 계단과 경사가 이어져 다리가 지친 날엔 부담이 될 수 있어요. 강풍·우천 땐 운영을 멈춰요. 운영시간·인원 제한은 방문 전에 확인하세요.',
    icon: 'waves',
    image: '',
    actionLabel: '체험',
    interest: 'view',
    outdoor: true,
    defaultDwell: 40,
    geo: { lat: 36.0663, lng: 129.3916 },
    address: '경북 포항시 북구 환호동 환호공원',
    tips: '공원 입구에서 트랙까지 오르막이 있어요.',
    stairs: true,
  }),
  yd('yd-art', 4, {
    title: '공원 속 미술관',
    short: '포항시립미술관',
    subtitle: '환호공원 안 · 실내 전시',
    category: 'INDOOR',
    desc: '스페이스워크와 같은 공원 안에 있는 시립미술관. 쉬어 가며 전시를 봐요.',
    detail: '전시 일정·휴관일은 방문 전에 확인하세요.',
    icon: 'palette',
    image: '',
    actionLabel: '관람',
    interest: 'indoor',
    outdoor: false,
    defaultDwell: 40,
    geo: { lat: 36.0647, lng: 129.3893 },
    address: '경북 포항시 북구 환호공원길 10 일대',
    tips: '',
  }),
  yd('yd-cafe', 5, {
    title: '해변 카페에서 마무리',
    short: '영일대 카페거리',
    subtitle: '해수욕장 따라 늘어선 카페',
    category: 'COFFEE BREAK',
    desc: '해변을 따라 카페가 이어져 있어요. 바다를 보며 완주의 여운을 즐겨요.',
    detail:
      '해변을 따라 카페가 이어져 있어요. 영업시간·좌석은 가게마다 달라요.',
    icon: 'coffee',
    image: '',
    actionLabel: '휴식',
    interest: 'cafe',
    outdoor: false,
    defaultDwell: 40,
    geo: { lat: 36.0589, lng: 129.3815 },
    address: '경북 포항시 북구 두호동 해안로 일대',
    tips: '',
  }),

  // ── 죽도시장·포항운하 ───────────────────────────────────────────────
  jd('jd-market', 1, {
    title: '동해안 대표 시장에서 회 한 접시',
    short: '죽도시장',
    subtitle: '회센터 · 물회 · 대게',
    category: 'MARKET FOOD',
    desc: '동해안에서 손꼽히는 큰 전통시장. 회센터에서 고른 회를 바로 먹거나 시장 식당에서 물회를 먹어요.',
    detail:
      '시장이 넓어 이동만 10분 가까이 걸을 수 있어요. 가게마다 가격이 달라 미리 물어보는 게 좋아요. 휴무일은 가게마다 달라요.',
    icon: 'shopping',
    image: '',
    actionLabel: '식사',
    interest: 'food',
    outdoor: false,
    defaultDwell: 60,
    geo: { lat: 36.0335, lng: 129.3655 },
    address: '경북 포항시 북구 죽도동 죽도시장',
    tips: '주말 점심엔 붐벼요. 회센터 2층 식당에서 상차림 비용을 받는 곳이 많아요.',
  }),
  jd('jd-canalhall', 2, {
    title: '운하가 된 물길 이야기',
    short: '포항운하관',
    subtitle: '운하 시작점 · 실내 전시',
    category: 'INDOOR',
    desc: '막혔던 물길을 다시 이어 만든 포항운하의 이야기를 보여주는 전시관. 크루즈 타는 곳 바로 옆이에요.',
    detail: '관람 시간·휴관일은 방문 전에 확인하세요.',
    icon: 'landmark',
    image: '',
    actionLabel: '관람',
    interest: 'indoor',
    outdoor: false,
    defaultDwell: 20,
    geo: { lat: 36.0228, lng: 129.3745 },
    address: '경북 포항시 남구 송도동 포항운하관',
    tips: '',
  }),
  jd('jd-cruise', 3, {
    title: '배 타고 운하를 한 바퀴',
    short: '포항운하 크루즈',
    subtitle: '운하 → 동빈내항 왕복',
    category: 'SEA VIEW',
    desc: '앉아서 운하와 내항, 바다 쪽 풍경을 둘러보는 유람선. 다리가 무거운 날 걷지 않고 구경할 수 있어요.',
    detail:
      '배 위는 바람이 강해요. 운항 시간·요금·기상 결항은 방문 전에 확인하세요.',
    icon: 'ship',
    image: '',
    actionLabel: '승선',
    interest: 'view',
    outdoor: true,
    defaultDwell: 40,
    geo: { lat: 36.0225, lng: 129.3741 },
    address: '경북 포항시 남구 송도동 포항운하 선착장',
    tips: '',
  }),
  jd('jd-canal', 4, {
    title: '물길 따라 짧은 산책',
    short: '운하 산책로',
    subtitle: '포항운하 · 평탄한 길',
    category: 'SLOW WALK',
    desc: '운하를 따라 이어진 평탄한 산책로를 천천히 걸어요.',
    detail: '경사가 거의 없어 완주 후에도 걷기 편해요.',
    icon: 'footprints',
    image: '',
    actionLabel: '산책',
    interest: 'walk',
    outdoor: true,
    defaultDwell: 20,
    geo: { lat: 36.0262, lng: 129.3712 },
    address: '경북 포항시 남구 해도동·송도동 포항운하 일대',
    tips: '',
  }),
  jd('jd-cafe', 5, {
    title: '운하 옆 카페에서 쉬기',
    short: '운하 카페',
    subtitle: '운하 인근 · 카페 후보',
    category: 'COFFEE BREAK',
    desc: '물길이 보이는 카페에서 다음 이동 전에 잠깐 쉬어요.',
    detail: '운하를 따라 카페가 있어요. 영업시간은 가게마다 달라요.',
    icon: 'coffee',
    image: '',
    actionLabel: '휴식',
    interest: 'cafe',
    outdoor: false,
    defaultDwell: 30,
    geo: { lat: 36.0245, lng: 129.3728 },
    address: '경북 포항시 남구 송도동 운하 인근',
    tips: '',
  }),
]
