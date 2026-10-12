import { photoEligiblePlaces } from './community'
import type { TripConfig } from './schema'
import type { TripState } from './trip'

/** Open a composer, never publish or infer a visit from a sentence. */
export const requestsVisitPhoto = (text: string) =>
  /사진|photo|picture/i.test(text) &&
  /올[릴려리]|업로드|공유|게시|커뮤니티|남[길겨기]|upload|share|post/i.test(
    text,
  ) &&
  !/안\s*(올|공유|남|찍|할|해)|않|싫|취소|나중|말고|하지\s*마|don't|do not/i.test(
    text,
  )

export type VisitPhotoOffer = {
  message: string
  placeIds: string[]
  selectedId: string | null
}

export const visitPhotoOffer = (
  config: TripConfig,
  state: TripState,
  request: string,
): VisitPhotoOffer => {
  if (state.plan.condition === 'UNWELL')
    return {
      message: '사진은 나중에 남겨도 괜찮아요. 먼저 몸을 살펴주세요.',
      placeIds: [],
      selectedId: null,
    }
  const places = photoEligiblePlaces(config, state)
  if (['OUTBOUND', 'RETURN'].includes(state.plan.stage))
    return {
      message:
        '이동을 마친 뒤 사진을 남겨요. 도착하면 방문한 장소의 사진을 공유할 수 있어요.',
      placeIds: [],
      selectedId: null,
    }
  const placeIds = places.map((p) => p.id)
  const compact = (s: string) => s.replace(/\s/g, '').toLowerCase()
  const query = compact(request)
  // Match catalogue names, not arbitrary ids or invented locations. Ambiguous
  // names stay a choice; the user always sees the place before publishing.
  const named = config.places.filter((p) => {
    const names = [
      p.attrs.short,
      p.attrs.subtitle.split('·')[0].trim(),
      ...p.attrs.short.split(' ').filter((s) => s.length >= 3),
    ]
    return names.some(
      (name) => name.length >= 3 && query.includes(compact(name)),
    )
  })
  if (named.length === 1 && !placeIds.includes(named[0].id))
    return {
      message: `${named[0].attrs.short}은 아직 방문할 차례가 아니에요. 현재 관광 중인 장소나 방문 완료한 장소의 사진을 올려 주세요.`,
      placeIds: [],
      selectedId: null,
    }
  if (!places.length)
    return {
      message:
        '관광지에 도착하면 현재 장소의 사진을 올릴 수 있어요. 방문 완료한 장소의 사진도 이 대화에서 공유할 수 있어요.',
      placeIds,
      selectedId: null,
    }
  const selected =
    named.length === 1
      ? places.find((p) => p.id === named[0].id)
      : named.length === 0 && /여기|이곳|방금|here|just visited/i.test(request)
        ? places.at(-1)
        : undefined
  return {
    message: selected
      ? `${selected.attrs.short}의 사진인가요? 장소와 사진, 한마디를 확인한 뒤 공유해 주세요.`
      : '어디에서 찍은 사진인가요? 현재 관광 중이거나 방문한 장소를 고르고 사진과 한마디를 남겨 주세요.',
    placeIds,
    selectedId: selected?.id ?? null,
  }
}
