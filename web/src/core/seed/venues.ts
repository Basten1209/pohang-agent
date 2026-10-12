import type { Venue } from '../schema'

export const pohangTenTastesUrl = 'https://blog.naver.com/inpohang/223464918169'
const city = (id: number) => ({
  title: '포항시 퐝퐝여행',
  url: `https://pohang.go.kr/phtour/wmap/tourInformation/view.do?menu_idx=43&tour_info_idx=${id}`,
  checkedAt: '2026-10-12',
})
const drama = {
  title: '포항시 · 모래에도 꽃이 핀다 촬영지',
  url: 'https://pohang.go.kr/phtour/board/view.do?board_idx=2946&manage_idx=3&menu_idx=96',
  checkedAt: '2026-10-12',
}
const listing = (id: string) => ({
  title: '카카오맵 매장 정보',
  url: `https://place.map.kakao.com/${id}`,
  checkedAt: '2026-10-12',
})
const venue = (v: Omit<Venue, 'detour'> & { detour?: boolean }): Venue => ({
  detour: false,
  ...v,
})

/** Sources verify names, locations and featured menus, not today's opening.
 * Candidates stay separate from planner stops, whose time budget is unchanged.
 */
export const venueCandidates: Record<string, Venue[]> = {
  food: [
    venue({
      id: 'kkakkune',
      map: { kind: 'place', id: '8241712' },
      name: '까꾸네 모리국수',
      kind: 'food',
      address: '구룡포읍 호미로 239-13',
      highlight: '모리국수',
      tenTaste: '모리국수',
      description:
        '생선·해산물을 넣어 얼큰하게 끓이는 구룡포 향토 국수. 시장 골목에서 포항 10미를 맛볼 후보예요.',
      note: '인원별 주문과 대기 여부는 방문 전에 확인해 주세요.',
      source: {
        title: '한국관광공사 대한민국 구석구석',
        url: 'https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=5ca71de0-c2ae-43c0-b69d-ef840d2d9712',
        checkedAt: '2026-10-12',
      },
    }),
    venue({
      id: 'gangdugi',
      map: { kind: 'place', id: '218316645' },
      name: '강두기수산',
      kind: 'food',
      address: '구룡포읍 호미로 20',
      highlight: '물회 · 홍게',
      tenTaste: '포항 물회',
      description:
        '포항시 관광 안내에 물회와 홍게를 소개한 식당이에요. 물회 한 끼를 찾을 때 확인해 보세요.',
      detour: true,
      note: '병포리 쪽으로 이동이 필요해요.',
      source: city(1046),
    }),
    venue({
      id: 'halmae-sikdang',
      map: { kind: 'place', id: '9570020' },
      name: '할매식당',
      kind: 'food',
      address: '구룡포읍 호미로 241',
      highlight: '갈치찌개 · 도루묵찌개',
      description:
        '가옥거리 인근에서 생선찌개와 밥을 먹을 수 있는 식당 후보예요.',
      source: listing('9570020'),
    }),
    venue({
      id: 'cheolgyu',
      map: { kind: 'place', id: '11234352' },
      name: '철규분식',
      kind: 'food',
      address: '구룡포읍 구룡포길 62-2',
      highlight: '찐빵 · 단팥죽 · 잔치국수',
      description:
        '구룡포초등학교 앞 분식집. 국수나 단팥죽에 찐빵을 곁들이는 메뉴를 소개하고 있어요.',
      source: city(641),
    }),
    venue({
      id: 'gwamegi-street',
      map: { kind: 'coordinate', lat: 35.9903122, lng: 129.555267 },
      name: '구룡포과메기물회거리',
      kind: 'food',
      address: '구룡포읍 구룡포리 984-1 일대',
      highlight: '과메기 · 물회 전문 음식거리',
      tenTaste: '과메기 · 포항 물회',
      description:
        '과메기와 물회 식당이 모인 음식테마거리예요. 과메기는 겨울철 별미로 소개돼요.',
      note: '음식거리 전체를 나타내는 포항시 안내 위치예요. 지도 핀에서 주변 식당을 살펴보세요.',
      source: city(861),
    }),
  ],
  cafe: [
    venue({
      id: 'coffee311',
      map: { kind: 'place', id: '2057065333' },
      name: '커피311',
      kind: 'cafe',
      address: '구룡포읍 호미로 311',
      highlight: '구룡포·호미곶 삼거리의 쉼터',
      description: '포항시가 드라마 촬영팀도 쉬어 간 카페로 소개한 곳이에요.',
      source: listing('2057065333'),
    }),
    venue({
      id: 'default-coffee',
      map: { kind: 'place', id: '1489660261' },
      name: '디폴트커피바',
      kind: 'cafe',
      address: '구룡포읍 일출로 14, 1층 (삼정리)',
      highlight: '해수욕장 바다 전망 · 커피와 디저트',
      description: '구룡포해수욕장을 바라보며 쉬어 갈 수 있는 카페예요.',
      detour: true,
      note: '삼정리 해수욕장 쪽으로 이동이 필요해요.',
      source: listing('1489660261'),
    }),
  ],
  street: [
    venue({
      id: 'japanese-street',
      map: { kind: 'place', id: '1364011631' },
      name: '구룡포 일본인 가옥거리',
      kind: 'sight',
      address: '구룡포읍 구룡포길 153-1 일대',
      highlight: '포항 12경 · 역사 골목',
      description: '옛 가옥이 남아 있는 골목에서 항구 마을의 풍경을 둘러봐요.',
      note: '인근 근대역사관은 공식 안내상 2026년 11월까지 휴관. 야외 거리 관람과 구분해 주세요.',
      source: city(347),
    }),
    venue({
      id: 'ara-square',
      map: { kind: 'place', id: '27237054' },
      name: '구룡포 아라광장',
      kind: 'sight',
      address: '구룡포읍 구룡포리 954-16',
      highlight: '항구 앞 광장 · 드라마 촬영지',
      description:
        '구룡포항과 맞닿은 광장. 가옥거리와 함께 들러 항구 풍경을 볼 수 있어요.',
      source: city(765),
    }),
    venue({
      id: 'guryongpo-port',
      map: { kind: 'place', id: '10132683' },
      name: '구룡포항',
      kind: 'sight',
      address: '구룡포읍 호미로 222-1',
      highlight: '어선과 항구 풍경',
      description: '시장과 가옥거리 가까이에서 포구의 일상을 둘러볼 수 있어요.',
      source: city(109),
    }),
    venue({
      id: 'janggilri-park',
      map: { kind: 'place', id: '26127888' },
      name: '장길리 복합낚시공원',
      kind: 'sight',
      address: '구룡포읍 동해안로 4376-30',
      highlight: '바다 풍경 · 해안 사진',
      description: '포항시가 드라마 촬영지와 바다 사진 명소로 소개한 곳이에요.',
      detour: true,
      note: '장길리까지 별도 이동이 필요해요.',
      source: city(96),
    }),
  ],
  'gp-museum': [
    venue({
      id: 'gwamegi-museum',
      map: { kind: 'place', id: '1119010097' },
      name: '구룡포 과메기문화관',
      kind: 'sight',
      address: '구룡포읍 구룡포길117번길 28-8',
      highlight: '실내 전시 · 해양 체험',
      description: '포항의 바다와 과메기를 주제로 전시·체험을 즐길 수 있어요.',
      note: '오르막이 있어요. 휴관일과 관람 가능 여부를 확인해 주세요.',
      source: city(406),
    }),
  ],
  'hm-food': [
    venue({
      id: 'daebori286',
      map: { kind: 'place', id: '407370553' },
      name: '대보리286식당',
      kind: 'food',
      address: '호미곶면 해맞이로150번길 9, 1층',
      highlight: '바지락칼국수 · 성게비빔밥',
      description:
        '해맞이광장 가까이에서 식사할 수 있는 후보예요. 지도 매장 메뉴에 칼국수와 성게비빔밥이 안내되어 있어요.',
      source: listing('407370553'),
    }),
  ],
  'hm-cafe': [
    venue({
      id: 'offing',
      map: { kind: 'place', id: '1731583479' },
      name: '오핑 카페',
      kind: 'cafe',
      address: '호미곶면 구만길 279, 2층',
      highlight: '드라마 속 카페',
      description:
        '포항시가 소개한 호미곶 촬영지 카페. 구만리 바닷가에서 쉬어 갈 수 있어요.',
      detour: true,
      note: '지도 안내상 월·화요일 휴무예요. 광장에서 구만리까지 별도 이동이 필요해요.',
      source: drama,
    }),
    venue({
      id: 'nest',
      map: { kind: 'place', id: '2130999132' },
      name: '네스트카페',
      kind: 'cafe',
      address: '호미곶면 해맞이로46번길 164',
      highlight: '바다 전망 · 커피',
      description: '바다를 바라보며 쉬어 갈 수 있는 대형 카페로 소개돼요.',
      detour: true,
      note: '해맞이광장 밖 별도 이동 후보예요.',
      source: listing('2130999132'),
    }),
  ],
  'hm-hand': [
    venue({
      id: 'hands',
      map: { kind: 'place', id: '27206923' },
      name: '상생의 손',
      kind: 'sight',
      address: '호미곶면 해맞이로150번길 20 일대',
      highlight: '호미곶 해맞이광장 · 바다 사진',
      description: '바다와 육지에서 서로 마주하는 손 조형물을 만나봐요.',
      source: city(184),
    }),
  ],
  'hm-museum': [
    venue({
      id: 'lighthouse-museum',
      map: { kind: 'place', id: '11692016' },
      name: '국립등대박물관',
      kind: 'sight',
      address: '호미곶면 해맞이로150번길 20',
      highlight: '등대와 항로표지 전시',
      description: '등대의 역사와 항로표지를 살펴보는 실내 관람 후보예요.',
      source: city(521),
    }),
    venue({
      id: 'millennium-hall',
      map: { kind: 'place', id: '23864226' },
      name: '새천년기념관',
      kind: 'sight',
      address: '호미곶면 해맞이로 136',
      highlight: '전시 · 옥상 전망대',
      description:
        '해맞이광장에서 동해와 호미곶 해안을 조망할 수 있는 곳이에요.',
      source: city(409),
    }),
  ],
}
