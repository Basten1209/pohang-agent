export const progressLabels = {
  OBSERVE: '교통과 현장 정보를 확인하고 있어요…',
  PLAN: '컨디션과 귀가 시간에 맞춰 코스를 계산하고 있어요…',
  EXPLAIN: '확인한 내용을 답변으로 정리하고 있어요…',
  RACE: '참여하는 대회 정보를 확인하고 있어요…',
  GUIDE: '관광지와 주변 정보를 살펴보고 있어요…',
  MOBILITY: '이동 방법과 시간을 확인하고 있어요…',
  UPDATE: '요청한 일정 변경을 반영하고 있어요…',
  PHOTO: '사진을 남길 장소를 확인하고 있어요…',
} as const
export type ProgressPhase = keyof typeof progressLabels
export const progressForTool = (name: string): ProgressPhase => {
  if (name === 'plan_course' || name === 'compare_courses') return 'PLAN'
  if (name === 'get_race_info') return 'RACE'
  if (name === 'prepare_visit_photo') return 'PHOTO'
  if (['check_live_conditions', 'get_weather'].includes(name)) return 'OBSERVE'
  if (
    [
      'get_directions',
      'get_bus_arrivals',
      'get_train_times',
      'compare_transport',
    ].includes(name)
  )
    return 'MOBILITY'
  if (
    [
      'update_trip_details',
      'apply_plan_change',
      'start_journey',
      'record_race_progress',
      'set_demo_observation',
    ].includes(name)
  )
    return 'UPDATE'
  if (['search_guide', 'find_nearby', 'get_place_detail'].includes(name))
    return 'GUIDE'
  return 'EXPLAIN'
}
