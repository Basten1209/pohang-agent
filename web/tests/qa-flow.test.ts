import { describe, expect, it, beforeAll } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { seedConfig } from '#/core/defaults'
import { planner } from '#/core/planner'
import {
  accept,
  advance,
  initialTrip,
  replay,
  runScenario,
  tripStateSchema,
  startReturn,
} from '#/core/trip'
import { photoEligiblePlaces } from '#/core/community'
import {
  distanceMeters,
  demoRoute,
  routeDistanceMeters,
  routeAt,
} from '#/core/race-route'
import { progressForTool } from '#/core/agent-progress'
import { memoryDb, type Db } from '#/server/db/client'
import { shareVisit, visitsForTrip } from '#/server/community'
import { captionContext } from '#/server/caption'
import { trips } from '#/server/db/schema'
import { ItineraryTimeline } from '#/home/timeline'
import { applyDemoQaData } from '#/server/db/demo-qa'
import { seed, readConfig, patchConfig } from '#/server/db/repo'
import { listCommunity } from '#/server/community'
import { eq } from 'drizzle-orm'
import { appConfig } from '#/server/db/schema'

const calc = planner(seedConfig)
const localTrip = () => {
  let s = initialTrip(seedConfig)
  s = replay(s, runScenario(seedConfig, s, 'base').events)
  s.phase = 3
  s = replay(s, accept(s, calc(s.plan, s.observations)).events)
  return replay(s, advance(s, calc(s.plan, s.observations)).events)
}
let db: Db
beforeAll(async () => {
  db = await memoryDb()
})

it('데모 DB 패치는 기존 게시물과 운영 설정을 보존하며 재실행해도 중복되지 않는다', async () => {
  const db = await memoryDb()
  await seed(db, seedConfig)
  await patchConfig(db, 'agent', { maxOutputTokens: 600, timeoutMs: 23456 })
  const state = localTrip(),
    id = crypto.randomUUID()
  await db.insert(trips).values({ id, state })
  const original = await shareVisit(db, seedConfig, {
    tripId: id,
    placeId: calc(state.plan, state.observations).stops[0].id,
    course: 'guryongpo',
    caption: '기존 게시물',
    photo: { kind: 'DEMO' },
  })
  await applyDemoQaData(db)
  const first = await listCommunity(db)
  expect(first).toHaveLength(13)
  expect(first.find((p) => p.id === original!.id)).toEqual(original)
  const { config, issues } = await readConfig(db, seedConfig)
  expect(issues).toEqual([])
  expect(config.agent).toMatchObject({
    maxOutputTokens: 1600,
    timeoutMs: 23456,
  })
  expect(config.places.find((p) => p.id === 'street')!.attrs.image).toBe(
    seedConfig.places.find((p) => p.id === 'street')!.attrs.image,
  )
  await patchConfig(db, 'agent', { maxOutputTokens: 1800 })
  await Promise.all([applyDemoQaData(db), applyDemoQaData(db)])
  expect(await listCommunity(db)).toEqual(first)
  expect((await readConfig(db, seedConfig)).config.agent.maxOutputTokens).toBe(
    1800,
  )
  const [marker] = await db
    .select()
    .from(appConfig)
    .where(eq(appConfig.key, 'demo-qa-2026-10-12'))
  expect(marker.value).toMatchObject({ previous: { postIds: [original!.id] } })
})

describe('QA 회귀: 기록과 사진의 독립성', () => {
  it('완료 장소와 당시 시간을 재계산·복귀·직렬화 뒤에도 보존한다', () => {
    let state = localTrip()
    const itinerary = calc(state.plan, state.observations)
    const first = itinerary.stops[0]
    const completion = advance(state, itinerary).events
    state = replay(state, completion)
    expect(state.visits).toEqual([
      {
        placeId: first.id,
        course: itinerary.course,
        start: first.start,
        end: first.end,
      },
    ])
    expect(replay(state, completion)).toEqual(state)
    state = replay(state, [
      {
        type: 'observations.patched',
        patch: { readings: { ...state.observations.readings, congestion: 82 } },
      },
    ])
    state = replay(
      state,
      startReturn(state, calc(state.plan, state.observations)).events,
    )
    state = replay(
      state,
      advance(state, calc(state.plan, state.observations)).events,
    )
    state = tripStateSchema.parse(JSON.parse(JSON.stringify(state)))
    expect(state.plan.stage).toBe('DONE')
    expect(state.visits[0].start).toBe(first.start)
    const html = renderToStaticMarkup(
      createElement(ItineraryTimeline, {
        config: seedConfig,
        itinerary: calc(state.plan, state.observations),
        state,
      }),
    )
    expect(html).toContain('완료')
    expect(html).toContain(
      seedConfig.places.find((p) => p.id === first.id)!.attrs.short,
    )
  })
  it('구버전 완료 목록은 시간 기록 없이 보이고 여정을 초기화하지 않는다', () => {
    const old = { ...localTrip(), visits: undefined }
    old.plan.completed = ['street']
    const restored = tripStateSchema.parse(old)
    expect(restored.visits).toEqual([])
    expect(restored.created).toBe(true)
    expect(
      renderToStaticMarkup(
        createElement(ItineraryTimeline, {
          config: seedConfig,
          itinerary: calc(restored.plan, restored.observations),
          state: restored,
        }),
      ),
    ).toContain('시간 기록 없음')
  })
  it('현재 장소는 게시 가능하고 미래 장소는 거부하며 게시가 일정을 진행시키지 않는다', async () => {
    const state = localTrip(),
      id = crypto.randomUUID()
    const current = calc(state.plan, state.observations).stops[0].id
    expect(photoEligiblePlaces(seedConfig, state).map((p) => p.id)).toEqual([
      current,
    ])
    const before = structuredClone(state)
    await db.insert(trips).values({ id, state })
    const input = {
      tripId: id,
      course: 'guryongpo' as const,
      placeId: current,
      caption: '오늘의 한 장',
      photo: { kind: 'DEMO' as const },
    }
    const [a, b] = await Promise.all([
      shareVisit(db, seedConfig, input),
      shareVisit(db, seedConfig, input),
    ])
    expect(a?.id).toBe(b?.id)
    expect(a?.image).toContain('/images/demo/sample-')
    expect(await visitsForTrip(db, id)).toHaveLength(1)
    expect(
      await shareVisit(db, seedConfig, { ...input, placeId: 'hm-hand' }),
    ).toBeNull()
    expect(state).toEqual(before)
    const photo = {
      kind: 'UPLOAD' as const,
      data: 'data:image/jpeg;base64,/9j/2Q==',
    }
    expect(
      await captionContext(db, seedConfig, {
        tripId: id,
        placeId: current,
        photo,
      }),
    ).toContain(seedConfig.places.find((p) => p.id === current)!.attrs.short)
    await expect(
      captionContext(db, seedConfig, { tripId: id, placeId: 'hm-hand', photo }),
    ).rejects.toMatchObject({ code: 'PLACE_NOT_ELIGIBLE' })
    for (const stage of ['OUTBOUND', 'RETURN'] as const)
      expect(
        photoEligiblePlaces(seedConfig, {
          ...state,
          plan: { ...state.plan, stage },
        }),
      ).toEqual([])
  })
})

describe('QA 회귀: 지도와 진행 문구', () => {
  it('도로를 따른 10km 왕복 경로의 반환점과 마커가 거리와 일치한다', () => {
    expect(routeDistanceMeters).toBeCloseTo(10000, 0)
    expect(demoRoute.length).toBeGreaterThan(200)
    expect(
      Math.max(
        ...demoRoute.slice(1).map((p, i) => distanceMeters(demoRoute[i], p)),
      ),
    ).toBeLessThan(500)
    expect(routeAt(0.5).position[0]).toBeCloseTo(
      demoRoute[(demoRoute.length - 1) / 2][0],
      8,
    )
    expect(routeAt(1).position).toEqual(routeAt(0).position)
  })
  it('대회·관광정보·일정 변경 조회를 코스 생성으로 표시하지 않는다', () => {
    expect(progressForTool('get_race_info')).toBe('RACE')
    expect(progressForTool('search_guide')).toBe('GUIDE')
    expect(progressForTool('apply_plan_change')).toBe('UPDATE')
    expect(progressForTool('plan_course')).toBe('PLAN')
  })
})
