import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedConfig } from '#/core/defaults'
import { interpretBody, normalizeTime } from '#/core/evidence'
import { fetchSource } from '#/server/sources/observe'

const [traffic, air] = seedConfig.sources
const now = Date.parse('2026-10-13T02:00:00Z')
afterEach(() => vi.restoreAllMocks())

describe('관측 시각 정규화', () => {
  it('시각만 있는 값에 오늘 날짜를 붙이지 않음', () => {
    expect(normalizeTime('10:00', 'Asia/Seoul')).toBeNull()
  })
  it('시간대가 없는 날짜시각은 소스에 시간대가 설정된 경우에만 해석', () => {
    expect(normalizeTime('2026-10-13 10:00:00', null)).toBeNull()
    expect(normalizeTime('2026-10-13 10:00:00', 'Asia/Seoul')).toBe(
      '2026-10-13T01:00:00.000Z',
    )
    // The E-UM sample format: "2026-07-07 17:00:00.0"
    expect(normalizeTime('2026-07-07 17:00:00.0', 'Asia/Seoul')).toBe(
      '2026-07-07T08:00:00.000Z',
    )
  })
  it('오프셋이 있으면 그대로 신뢰', () => {
    expect(normalizeTime('2026-10-13T10:00:00+09:00', null)).toBe(
      '2026-10-13T01:00:00.000Z',
    )
  })
})

describe('E-UM 응답 해석 (문서 샘플 형식)', () => {
  it('교통 혼잡: 여러 시간대 중 가장 최근 값을 사용', () => {
    const body = {
      id: 1,
      status: 'success',
      data: [
        { hour: '2026-10-13 09:00:00.0', cntPerc: 30.5 },
        { hour: '2026-10-13 10:00:00.0', cntPerc: 37.76 },
      ],
    }
    const e = interpretBody(traffic, body, new Date(now).toISOString(), now)
    expect(e.status).toBe('LIVE')
    expect(e.value).toBe(37.76)
    expect(e.observedAt).toBe('2026-10-13T01:00:00.000Z')
    // Hourly source, 2h window: the 10:00 value is fresh shortly after.
    expect(e.freshness).toBe('FRESH')
  })
  it('교통 혼잡: 최신 시간대가 아직 비어 있으면 값이 있는 직전 시간대를 사용', () => {
    const body = {
      status: 'success',
      data: [
        { hour: '2026-10-13 09:00:00.0', cntPerc: 30.5 },
        { hour: '2026-10-13 10:00:00.0', cntPerc: null },
      ],
    }
    const e = interpretBody(traffic, body, new Date(now).toISOString(), now)
    expect(e.status).toBe('LIVE')
    expect(e.value).toBe(30.5)
    expect(e.observedAt).toBe('2026-10-13T00:00:00.000Z')
  })
  it('교통 혼잡: 쓸 수 있는 값이 하나도 없으면 받은 값을 남기고 오류', () => {
    const body = {
      status: 'success',
      data: [{ hour: '2026-10-13 10:00:00.0', cntPerc: '' }],
    }
    const e = interpretBody(traffic, body, new Date(now).toISOString(), now)
    expect(e.status).toBe('ERROR')
    expect(e.message).toContain('받은 값: ""')
  })
  it('대기: 단일 객체, 문자열 수치도 범위 검증 후 허용', () => {
    const body = {
      status: 'success',
      data: { devId: 1, pm25: '74.68', logDateTime: '2026-10-13 10:30:00' },
    }
    const e = interpretBody(air, body, new Date(now).toISOString(), now)
    expect(e.value).toBe(74.68)
    expect(e.values.devId).toBe(1)
  })
  it('실패 상태·필드 누락·범위 밖은 성공으로 보고하지 않음', () => {
    const at = new Date(now).toISOString()
    expect(
      interpretBody(traffic, { status: 'fail', data: null }, at, now).status,
    ).toBe('ERROR')
    expect(
      interpretBody(traffic, { status: 'success', data: {} }, at, now).status,
    ).toBe('ERROR')
    expect(
      interpretBody(
        traffic,
        { data: { cntPerc: 140, hour: '2026-10-13 10:00:00' } },
        at,
        now,
      ).status,
    ).toBe('ERROR')
  })
})

describe('E-UM 호출', () => {
  it('서비스 키가 없으면 호출하지 않고 미설정으로 보고', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    const e = await fetchSource(traffic, {})
    expect(e.status).toBe('NOT_CONFIGURED')
    expect(spy).not.toHaveBeenCalled()
  })
  it('대기 장비 ID가 없으면 대기 소스는 미설정', async () => {
    expect(
      (await fetchSource(air, { EUM_SERVICE_KEY: 'k' })).message,
    ).toContain('EUM_AIR_DEVICE_ID')
  })
  it('401은 오류로 구분하고 키를 메시지에 노출하지 않음', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{}', { status: 401 }),
    )
    const e = await fetchSource(traffic, { EUM_SERVICE_KEY: 'secret-test-key' })
    expect(e.status).toBe('ERROR')
    expect(JSON.stringify(e)).not.toContain('secret-test-key')
  })
})

describe('E-UM 인증키 형식', () => {
  it('포털의 인코딩된 키와 디코딩된 키를 모두 받음', async () => {
    const { decodedKey } = await import('#/server/sources/observe')
    expect(decodedKey('ab%2Bcd%2Fef%3D')).toBe('ab+cd/ef=')
    expect(decodedKey('ab+cd/ef=')).toBe('ab+cd/ef=')
    // A key that is not valid percent-encoding is passed through untouched.
    expect(decodedKey('ab%zz')).toBe('ab%zz')
  })
})
