import { isRecord } from './fp'
import type { Source } from './schema'

/**
 * Interpreting an external observation response, as pure functions.
 * The adapter is generic: which field, which clock, which range — all come
 * from the source's config document.
 */

export type EvidenceStatus = 'LIVE' | 'SNAPSHOT' | 'NOT_CONFIGURED' | 'ERROR'
export type Freshness = 'FRESH' | 'STALE' | 'UNKNOWN'

export type Evidence = {
  sourceId: string
  label: string
  reading: string
  status: EvidenceStatus
  observedAt: string | null
  fetchedAt: string
  freshness: Freshness
  value: number | null
  unit: string
  values: Record<string, string | number | null>
  message: string
}

const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
const LOCAL_DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/

/** Offset of `zone` at `instant`, in minutes (e.g. Asia/Seoul → 540). */
export const zoneOffsetMinutes = (
  zone: string,
  instant: Date,
): number | null => {
  try {
    const part = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'longOffset',
    })
      .formatToParts(instant)
      .find((p) => p.type === 'timeZoneName')?.value
    if (part === 'GMT') return 0
    const m = part?.match(/^GMT([+-])(\d{2}):(\d{2})$/)
    return m
      ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]))
      : null
  } catch {
    return null
  }
}

/**
 * Normalise a provider timestamp to ISO UTC.
 * - With an explicit offset: trusted as is.
 * - Local date-time: interpreted in the source's configured zone, or rejected
 *   when the source declares none.
 * - Time only: rejected — we never invent today's date.
 */
export const normalizeTime = (
  value: unknown,
  zone: string | null,
): string | null => {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (ISO_WITH_OFFSET.test(text)) {
    const t = Date.parse(text)
    return Number.isFinite(t) ? new Date(t).toISOString() : null
  }
  const m = text.match(LOCAL_DATETIME)
  if (!m || !zone) return null
  const [, y, mo, d, h, mi, s] = m
  const asUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0))
  const parsed = new Date(asUtc)
  if (
    !Number.isFinite(asUtc) ||
    parsed.getUTCFullYear() !== +y ||
    parsed.getUTCMonth() !== +mo - 1 ||
    parsed.getUTCDate() !== +d ||
    +h > 23 ||
    +mi > 59 ||
    +(s ?? 0) > 59
  )
    return null
  const offset = zoneOffsetMinutes(zone, new Date(asUtc))
  return offset === null
    ? null
    : new Date(asUtc - offset * 60_000).toISOString()
}

/** Every object in the response that carries `field`, depth-first. */
export const recordsWith = (
  value: unknown,
  field: string,
): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value.flatMap((v) => recordsWith(v, field))
  if (!isRecord(value)) return []
  if (field in value) return [value]
  return Object.values(value).flatMap((v) => recordsWith(v, field))
}

/** Prefer the record with the latest parseable timestamp; otherwise the last one. */
export const latestRecord = (
  records: Record<string, unknown>[],
  source: Source,
) =>
  records.reduce<Record<string, unknown> | undefined>((best, r) => {
    if (!best) return r
    const a = normalizeTime(best[source.timeField], source.timezone)
    const b = normalizeTime(r[source.timeField], source.timezone)
    if (a && b) return b >= a ? r : best
    return b ? r : best
  }, undefined)

export const freshnessOf = (
  observedAt: string | null,
  maxAgeSeconds: number | null,
  now: number,
): Freshness => {
  if (!observedAt || !maxAgeSeconds) return 'UNKNOWN'
  const age = (now - Date.parse(observedAt)) / 1000
  if (age < -60) return 'UNKNOWN'
  return age > maxAgeSeconds ? 'STALE' : 'FRESH'
}

export const blankEvidence = (source: Source, fetchedAt: string) => ({
  sourceId: source.id,
  label: source.label,
  reading: source.reading,
  observedAt: null,
  fetchedAt,
  freshness: 'UNKNOWN' as Freshness,
  value: null,
  unit: source.unit,
  values: {},
})

/** A finite number inside the source's range, from a number or numeric string. */
const valueOf = (raw: unknown, source: Source): number | null => {
  const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= source.range.min &&
    value <= source.range.max
    ? value
    : null
}

/** Interpret a successful HTTP body. Shape problems are reported, never guessed around. */
export const interpretBody = (
  source: Source,
  body: unknown,
  fetchedAt: string,
  now: number,
): Evidence => {
  const blank = blankEvidence(source, fetchedAt)
  if (
    isRecord(body) &&
    typeof body.status === 'string' &&
    body.status !== 'success'
  )
    return {
      ...blank,
      status: 'ERROR',
      message: `제공처 응답 상태 ${body.status} · 신청 승인·키 상태 확인 필요`,
    }
  const records = recordsWith(body, source.valueField)
  if (!records.length)
    return {
      ...blank,
      status: 'ERROR',
      message: '기대 필드를 찾지 못했어요. 실제 응답 계약 확인이 필요해요.',
    }
  // The newest hour can arrive before it is aggregated (empty or null):
  // use the newest record whose value is a usable number.
  const record = latestRecord(
    records.filter((r) => valueOf(r[source.valueField], source) !== null),
    source,
  )
  const value = record ? valueOf(record[source.valueField], source) : null
  if (!record || value === null) {
    const sample = JSON.stringify(
      latestRecord(records, source)?.[source.valueField] ?? null,
    ).slice(0, 40)
    return {
      ...blank,
      status: 'ERROR',
      message: `관측값의 수치 형식·범위를 확인할 수 없어요(받은 값: ${sample}, ${records.length}건). 공급자 응답 계약 확인이 필요해요.`,
    }
  }
  const normalizeUnit = (v: unknown) =>
    String(v ?? '')
      .normalize('NFKC')
      .replaceAll('μ', 'µ')
      .replaceAll(' ', '')
  if (
    source.meta.expectedUnit &&
    normalizeUnit(record.unit) !== normalizeUnit(source.meta.expectedUnit)
  )
    return {
      ...blank,
      status: 'ERROR',
      message: '응답 단위가 검증된 단위와 달라 추천에 반영하지 않아요.',
    }
  const observedAt = normalizeTime(record[source.timeField], source.timezone)
  const values = Object.fromEntries(
    source.keepFields.map((key) => {
      const v = record[key]
      return [key, typeof v === 'number' || typeof v === 'string' ? v : null]
    }),
  )
  return {
    ...blank,
    status: 'LIVE',
    observedAt,
    freshness: freshnessOf(observedAt, source.maxAgeSeconds, now),
    value,
    values,
    message: source.decision
      ? '실응답 조회 성공. 최신 관측과 구룡포 적용 범위를 확인해 반영해요.'
      : '실응답 조회 성공. 단위·갱신 주기 검증 전에는 시연 계산과 분리해서 표시해요.',
  }
}

/** Hourly endpoints omit the date. Use only the date we actually requested,
 * and the explicitly configured device; never aggregate arbitrary sensors. */
export const hourlyAirBody = (
  body: unknown,
  requestedDate: string,
  deviceId?: string,
  now = Date.now(),
) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) || !deviceId)
    return { data: [] }
  const day = requestedDate
  return {
    data: recordsWith(body, 'hours')
      .filter(
        (r) =>
          String(r.devId) === deviceId &&
          String(r.type).toLowerCase() === 'pm25',
      )
      .filter(
        (r) =>
          r.hours !== null &&
          String(r.hours).trim() !== '' &&
          Number.isInteger(Number(r.hours)) &&
          Number(r.hours) >= 0 &&
          Number(r.hours) <= 23,
      )
      .filter(
        (r) =>
          Date.parse(
            `${day}T${String(r.hours).padStart(2, '0')}:00:00+09:00`,
          ) <= now,
      )
      .map((r) => ({
        ...r,
        observationTime: `${day}T${String(r.hours).padStart(2, '0')}:00:00`,
      })),
  }
}
