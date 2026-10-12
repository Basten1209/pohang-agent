import type { ExtraPlace, Place, Plan, TripConfig } from './schema'

const icons: Record<ExtraPlace['interest'], string> = {
  food: 'utensils',
  cafe: 'coffee',
  view: 'waves',
  walk: 'footprints',
  indoor: 'landmark',
}
const actions: Record<ExtraPlace['interest'], string> = {
  food: '식사',
  cafe: '휴식',
  view: '구경',
  walk: '산책',
  indoor: '관람',
}

/** An added nearby spot as a catalogue place, so the planner treats it alike. */
export const extraPlace = (extra: ExtraPlace, sort: number): Place => ({
  id: extra.id,
  kind: extra.interest.toUpperCase(),
  sort,
  active: true,
  attrs: {
    title: extra.title,
    short: extra.title,
    subtitle: extra.address || '주변 추천 장소',
    category: 'NEARBY',
    desc: '한국관광공사 관광정보에서 찾아 일정에 더한 주변 장소예요.',
    detail: '',
    icon: icons[extra.interest],
    image: extra.image,
    actionLabel: actions[extra.interest],
    course: extra.course,
    interest: extra.interest,
    outdoor:
      extra.interest !== 'indoor' &&
      extra.interest !== 'cafe' &&
      extra.interest !== 'food',
    defaultDwell: extra.dwell,
    geo: extra.geo,
    candidates: [],
    address: extra.address,
    tips: '',
  },
  meta: {
    provenance: 'TOURAPI',
    verified: false,
    contentId: extra.contentId,
  },
})

/** The trip's config: the shared catalogue plus the spots this trip added. */
export const withExtraPlaces = (
  config: TripConfig,
  plan: Pick<Plan, 'extraPlaces'> | null | undefined,
): TripConfig => {
  const extras = plan?.extraPlaces ?? []
  if (!extras.length) return config
  const known = new Set(config.places.map((p) => p.id))
  return {
    ...config,
    places: [
      ...config.places,
      ...extras
        .filter((e) => !known.has(e.id))
        .map((e, i) => extraPlace(e, 9000 + i)),
    ],
  }
}

/** A sensible kind for a TourAPI content type, when the agent gave none. */
export const interestOfTourType = (
  typeId: string | null | undefined,
): ExtraPlace['interest'] =>
  typeId === '39'
    ? 'food'
    : typeId === '14'
      ? 'indoor'
      : typeId === '12'
        ? 'view'
        : 'walk'

export const defaultDwellOf: Record<ExtraPlace['interest'], number> = {
  food: 50,
  cafe: 30,
  view: 20,
  walk: 30,
  indoor: 40,
}
