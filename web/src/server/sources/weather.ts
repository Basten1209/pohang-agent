import { mergeForecastHours } from '#/core/weather'
import type { ForecastReading } from '#/core/weather'
import { getDb } from '../db/client'
import { latestLiveSnapshot, saveSnapshot } from '../db/repo'
import { forecast, kmaGrid } from './datagokr'

export const forecastForDay = async (
  point: { lat: number; lng: number },
  day: string,
) => {
  const { nx, ny } = kmaGrid(point.lat, point.lng)
  const id = `KMA:${nx}:${ny}:${day}`
  const db = await getDb().catch(() => null)
  const live = await forecast(point)
  const [saved] = db ? await latestLiveSnapshot(db, id).catch(() => []) : []
  const old = Array.isArray(saved?.payload.hours)
    ? (saved.payload.hours as ForecastReading[])
    : []
  const fresh =
    live.status === 'LIVE'
      ? live.data.map((h) => ({ ...h, fetchedAt: live.fetchedAt }))
      : []
  const hours = mergeForecastHours(day, old, fresh)
  if (db && fresh.some((h) => h.date === day))
    await saveSnapshot(db, {
      sourceId: id,
      status: 'LIVE',
      observedAt: null,
      fetchedAt:
        live.status === 'LIVE' ? live.fetchedAt : new Date().toISOString(),
      payload: { hours },
      meta: { source: '기상청 단기예보', grid: { nx, ny } },
    }).catch(() => undefined)
  return {
    status: hours.some((h) => h.provenance === 'LIVE')
      ? ('LIVE' as const)
      : hours.length
        ? ('SNAPSHOT' as const)
        : live.status,
    source: '기상청 단기예보',
    message: live.status === 'LIVE' ? null : live.message,
    date: day,
    hours,
    available: hours.length > 0,
    lastForecastDate:
      live.status === 'LIVE' ? (live.data.at(-1)?.date ?? null) : null,
    note: hours.some((h) => h.provenance === 'SNAPSHOT')
      ? '저장 예보가 포함돼 있어요. 각 시간의 발표 시각을 확인하세요. 현재 관측값이 아닙니다.'
      : hours.length
        ? null
        : '해당 날짜의 예보를 확인하지 못했어요. 현재 날씨로 대체하지 않았어요.',
  }
}
