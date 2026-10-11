import { visitedPlaces } from './community'
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
  const places = visitedPlaces(config, state)
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
      message: `${named[0].attrs.short}의 방문 완료가 아직 기록되지 않았어요. 관광 탭에서 방문 완료를 확인한 뒤 사진을 올려 주세요.`,
      placeIds: [],
      selectedId: null,
    }
  if (!places.length)
    return {
      message:
        '관광 탭에서 장소를 둘러본 뒤 방문 완료를 눌러 주세요. 그다음 이 대화에서 사진을 선택해 커뮤니티에 남길 수 있어요.',
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
      ? `방문 완료한 ${selected.attrs.short}의 사진인가요? 장소와 사진, 한마디를 확인한 뒤 공유해 주세요.`
      : '어디에서 찍은 사진인가요? 방문한 장소를 고르고 사진과 한마디를 남겨 주세요.',
    placeIds,
    selectedId: selected?.id ?? null,
  }
}
