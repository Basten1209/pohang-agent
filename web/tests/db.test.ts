import { sql } from 'drizzle-orm'
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
  departChanges,
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
    expect(config.places.map((p) => p.id)).toEqual(
      seedConfig.places.map((p) => p.id),
    )
    expect(config.courses.map((c) => c.id)).toEqual([
      'guryongpo',
      'homigot',
      'yeongildae',
      'jukdo',
    ])
  })

  it('시드를 다시 실행해도 DB의 수정이 유지됨', async () => {
    // An operator edit: change one number and bump the row's version.
    await db.execute(
      sql`update app_config set value = jsonb_set(value, '{0,bufferMin}', '20'), version = version + 1 where key = 'modes'`,
    )
    await seed(db, seedConfig)
    const { config } = await readConfig(db, seedConfig)
    expect(config.modes[0].bufferMin).toBe(20)
    // A DB-only policy edit changes the decision with no code change.
    const it = planner(config)(
      {
        ...config.defaults.plan,
        condition: 'TIRED',
        departTime: '16:00',
        course: 'guryongpo',
      },
      config.defaults.observations,
    )
    expect(it.stationTarget).toBe(940)
    await db.execute(
      sql`update app_config set value = jsonb_set(value, '{0,bufferMin}', '30') where key = 'modes'`,
    )
  })

  it('시드 버전이 오르면 손대지 않은 옛 시드 행은 새 시드로 바뀜', async () => {
    const old = await memoryDb()
    const v1 = {
      ...seedConfig,
      version: 1,
      places: seedConfig.places.map((p) =>
        p.id === 'food' ? { ...p, attrs: { ...p.attrs, title: '옛 제목' } } : p,
      ),
    }
    await seed(old, v1)
    await seed(old, seedConfig)
    const { config } = await readConfig(old, seedConfig)
    expect(config.places.find((p) => p.id === 'food')?.attrs.title).toBe(
      seedConfig.places.find((p) => p.id === 'food')?.attrs.title,
    )
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
      { type: 'plan.patched', patch: { departTime: '16:00' } },
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
    const changes = await departChanges(db, id)
    expect(changes.map((c) => c.departTime)).toEqual(['16:00'])
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
