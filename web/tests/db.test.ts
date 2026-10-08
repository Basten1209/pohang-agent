import { beforeAll, describe, expect, it } from 'vitest'
import { seedConfig } from '#/core/defaults'
import { planner } from '#/core/planner'
import { initialTrip, replay } from '#/core/trip'
import type { TripEvent } from '#/core/trip'
import type { Db } from '#/server/db/client'
import { memoryDb } from '#/server/db/client'
import {
  appendEvents,
  eventsOf,
  latestLiveSnapshot,
  patchConfig,
  readConfig,
  saveSnapshot,
  seed,
  trainChanges,
} from '#/server/db/repo'

let db: Db
beforeAll(async () => {
  db = await memoryDb()
  await seed(db, seedConfig)
})

describe('jsonb 설정 저장소', () => {
  it('시드 후 읽은 설정은 시드와 같음', async () => {
    const { config, issues } = await readConfig(db, seedConfig)
    expect(issues).toEqual([])
    expect(config.policy).toEqual(seedConfig.policy)
    expect(config.places.map((p) => p.id)).toEqual(['food', 'street', 'cafe'])
  })

  it('시드를 다시 실행해도 DB의 수정이 유지됨', async () => {
    await patchConfig(db, 'policy', { stationBufferMin: 20 })
    await seed(db, seedConfig)
    const { config } = await readConfig(db, seedConfig)
    expect(config.policy.stationBufferMin).toBe(20)
    // A DB-only policy edit changes the decision with no code change.
    const it = planner(config)(
      { ...config.defaults.plan, condition: 'TIRED', trainTime: '16:00' },
      config.defaults.observations,
    )
    expect(it.stationTarget).toBe(940)
    await patchConfig(db, 'policy', { stationBufferMin: 30 })
  })

  it('잘못된 설정 문서는 거부되고 시드로 대체됨', async () => {
    await patchConfig(db, 'agent', { maxSteps: 99 })
    const { config, issues } = await readConfig(db, seedConfig)
    expect(issues.length).toBeGreaterThan(0)
    expect(config.agent.maxSteps).toBe(seedConfig.agent.maxSteps)
    await patchConfig(db, 'agent', { maxSteps: 4 })
  })
})

describe('이벤트 로그 (append-only jsonb)', () => {
  it('이벤트를 저장하고 다시 접어서 같은 상태를 얻음', async () => {
    const id = crypto.randomUUID()
    const events: TripEvent[] = [
      { type: 'plan.patched', patch: { condition: 'TIRED' } },
      { type: 'trip.created' },
      { type: 'plan.patched', patch: { trainTime: '16:00' } },
      { type: 'screen.changed', screen: 'course' },
    ]
    const state = replay(initialTrip(seedConfig), events)
    await appendEvents(db, id, events, state)
    const rows = await eventsOf(db, id)
    const restored = replay(
      initialTrip(seedConfig),
      rows.map((r) => ({ type: r.type, ...r.payload }) as TripEvent),
    )
    expect(restored).toEqual(state)
    const changes = await trainChanges(db, id)
    expect(changes.map((c) => c.trainTime)).toEqual(['16:00'])
  })
})

describe('관측 스냅샷', () => {
  it('최근 성공 응답만 대체용으로 꺼냄', async () => {
    const at = (m: number) =>
      new Date(Date.UTC(2026, 9, 13, 1, m)).toISOString()
    await saveSnapshot(db, {
      sourceId: 'INT_S07_005',
      status: 'LIVE',
      observedAt: at(0),
      fetchedAt: at(1),
      payload: { value: 37.76 },
    })
    await saveSnapshot(db, {
      sourceId: 'INT_S07_005',
      status: 'ERROR',
      observedAt: null,
      fetchedAt: at(5),
      payload: {},
    })
    const [last] = await latestLiveSnapshot(db, 'INT_S07_005')
    expect(last.payload).toEqual({ value: 37.76 })
  })
})
