import { decodedKey } from './observe'

/**
 * data.go.kr clients: Korea Tourism (TourAPI KorService2), TAGO bus stops,
 * arrivals and routes, TAGO trains, and the KMA short-term forecast. One
 * service key (`DATA_GO_KR_SERVICE_KEY`) serves all of them.
 *
 * Every call returns a `Live<T>`: data with its status, never a thrown
 * error, so an agent tool can always say what it knows and what it does not.
 * The key never leaves this module (not logged, not returned).
 */

export type Live<T> =
  | { status: 'LIVE'; data: T; fetchedAt: string }
  | { status: 'NOT_CONFIGURED' | 'ERROR'; data: null; message: string }

const BASE = 'https://apis.data.go.kr'
const APP = 'RUN2'

const keyOf = (env: Record<string, string | undefined>) =>
  env.DATA_GO_KR_SERVICE_KEY?.trim() || undefined

/** Small in-memory cache per serverless instance. */
const cache = new Map<string, { until: number; value: unknown }>()
const cached = async <T>(
  key: string,
  ttlMs: number,
  load: () => Promise<Live<T>>,
): Promise<Live<T>> => {
  const hit = cache.get(key)
  if (hit && hit.until > Date.now()) return hit.value as Live<T>
  const value = await load()
  if (value.status === 'LIVE')
    cache.set(key, { until: Date.now() + ttlMs, value })
  return value
}

/** `items.item` is an array, a single object, or '' when empty. */
export const itemsOf = (body: unknown): Record<string, unknown>[] => {
  const root = (body as { response?: unknown })?.response ?? body
  const items = (root as { body?: { items?: unknown } })?.body?.items
  const item = (items as { item?: unknown } | undefined)?.item
  if (Array.isArray(item)) return item as Record<string, unknown>[]
  return item && typeof item === 'object'
    ? [item as Record<string, unknown>]
    : []
}

/** The portal answers errors as XML even when JSON was asked for. */
export const errorOf = (text: string): string | null => {
  if (text.trimStart().startsWith('<')) {
    const msg =
      text.match(/<returnAuthMsg>([^<]+)</)?.[1] ??
      text.match(/<resultMsg>([^<]+)</)?.[1] ??
      text.match(/<errMsg>([^<]+)</)?.[1]
    return msg ?? 'XML 오류 응답'
  }
  try {
    const json = JSON.parse(text) as {
      response?: { header?: { resultCode?: string; resultMsg?: string } }
      resultCode?: string
      resultMsg?: string
    }
    const header = json.response?.header ?? json
    const code = String(header.resultCode ?? '00')
    return code === '00' || code === '0000' ? null : (header.resultMsg ?? code)
  } catch {
    return '해석할 수 없는 응답'
  }
}

export const call = async (
  path: string,
  params: Record<string, string | number>,
  env: Record<string, string | undefined> = process.env,
  timeoutMs = 5000,
): Promise<Live<Record<string, unknown>[]>> => {
  const key = keyOf(env)
  if (!key)
    return {
      status: 'NOT_CONFIGURED',
      data: null,
      message:
        '공공데이터포털 인증키(DATA_GO_KR_SERVICE_KEY)가 설정되지 않았어요.',
    }
  const url = new URL(`${BASE}/${path}`)
  url.searchParams.set('serviceKey', decodedKey(key))
  for (const [k, v] of Object.entries(params))
    url.searchParams.set(k, String(v))
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    })
    const text = await response.text()
    if (!response.ok)
      return { status: 'ERROR', data: null, message: `HTTP ${response.status}` }
    const error = errorOf(text)
    if (error) return { status: 'ERROR', data: null, message: error }
    return {
      status: 'LIVE',
      data: itemsOf(JSON.parse(text)),
      fetchedAt: new Date().toISOString(),
    }
  } catch {
    return {
      status: 'ERROR',
      data: null,
      message: '응답 시간 초과 또는 연결 오류',
    }
  }
}

const map = <A, B>(live: Live<A>, f: (a: A) => B): Live<B> =>
  live.status === 'LIVE' ? { ...live, data: f(live.data) } : live

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v))
const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Great-circle distance in metres. */
export const distanceM = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) => {
  const r = 6371000
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * r * Math.asin(Math.sqrt(h)))
}

// ── Korea Tourism (TourAPI KorService2) ─────────────────────────────────

/** Content types: 12 관광지 14 문화시설 15 행사 28 레포츠 32 숙박 38 쇼핑 39 음식점. */
export const tourTypes = {
  sight: 12,
  culture: 14,
  festival: 15,
  leisure: 28,
  stay: 32,
  shopping: 38,
  food: 39,
} as const
export type TourType = keyof typeof tourTypes
const typeName: Record<string, string> = {
  '12': '관광지',
  '14': '문화시설',
  '15': '행사',
  '25': '여행코스',
  '28': '레포츠',
  '32': '숙박',
  '38': '쇼핑',
  '39': '음식점',
}

export type TourItem = {
  id: string
  typeId: string
  type: string
  title: string
  address: string
  tel: string
  image: string
  lat: number | null
  lng: number | null
  distanceM: number | null
}

const tourItem = (i: Record<string, unknown>): TourItem => ({
  id: str(i.contentid),
  typeId: str(i.contenttypeid),
  type: typeName[str(i.contenttypeid)] ?? '기타',
  title: str(i.title),
  address: `${str(i.addr1)} ${str(i.addr2)}`.trim(),
  tel: str(i.tel),
  image: str(i.firstimage),
  lat: num(i.mapy),
  lng: num(i.mapx),
  distanceM: num(i.dist) === null ? null : Math.round(num(i.dist)!),
})

const tourParams = { MobileOS: 'ETC', MobileApp: APP, _type: 'json' }

export const tourNearby = (q: {
  lat: number
  lng: number
  radiusM: number
  type?: TourType
  limit?: number
}) =>
  cached(`tour:near:${JSON.stringify(q)}`, 60 * 60_000, async () =>
    map(
      await call('B551011/KorService2/locationBasedList2', {
        ...tourParams,
        mapX: q.lng,
        mapY: q.lat,
        radius: Math.min(20000, Math.max(100, Math.round(q.radiusM))),
        arrange: 'E',
        numOfRows: q.limit ?? 8,
        pageNo: 1,
        ...(q.type && { contentTypeId: tourTypes[q.type] }),
      }),
      (items) => items.map(tourItem),
    ),
  )

/** Keyword search, kept to Pohang by address. */
export const tourSearch = (q: {
  keyword: string
  type?: TourType
  limit?: number
}) =>
  cached(`tour:kw:${JSON.stringify(q)}`, 60 * 60_000, async () =>
    map(
      await call('B551011/KorService2/searchKeyword2', {
        ...tourParams,
        keyword: q.keyword,
        arrange: 'O',
        numOfRows: 40,
        pageNo: 1,
        ...(q.type && { contentTypeId: tourTypes[q.type] }),
      }),
      (items) =>
        items
          .map(tourItem)
          .filter((i) => i.address.includes('포항'))
          .slice(0, q.limit ?? 8),
    ),
  )

/** Intro fields worth telling a visitor, by content type. */
const introKeys = [
  'usetime',
  'restdate',
  'infocenter',
  'parking',
  'usefee',
  'opentimefood',
  'restdatefood',
  'firstmenu',
  'treatmenu',
  'infocenterfood',
  'usetimeculture',
  'restdateculture',
  'usefeeculture',
  'eventstartdate',
  'eventenddate',
  'eventplace',
  'playtime',
  'opentime',
  'restdateshopping',
  'checkintime',
  'checkouttime',
]

const clean = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export const tourDetail = (contentId: string, typeId?: string) =>
  cached(`tour:detail:${contentId}`, 6 * 60 * 60_000, async () => {
    const common = await call('B551011/KorService2/detailCommon2', {
      ...tourParams,
      contentId,
    })
    if (common.status !== 'LIVE') return common
    const c = common.data[0] ?? {}
    const type = typeId || str(c.contenttypeid)
    const intro = type
      ? await call('B551011/KorService2/detailIntro2', {
          ...tourParams,
          contentId,
          contentTypeId: type,
        })
      : null
    const i = intro?.status === 'LIVE' ? (intro.data[0] ?? {}) : {}
    return {
      ...common,
      data: {
        ...tourItem(c),
        overview: clean(str(c.overview)).slice(0, 600),
        homepage: clean(str(c.homepage)).slice(0, 200),
        info: Object.fromEntries(
          introKeys
            .map((k) => [k, clean(str(i[k]))] as const)
            .filter(([, v]) => v),
        ),
      },
    }
  })

// ── TAGO buses ──────────────────────────────────────────────────────────

export type Stop = {
  cityCode: string
  id: string
  name: string
  no: string
  lat: number | null
  lng: number | null
  distanceM: number | null
}

export const stopsNear = (q: { lat: number; lng: number; limit?: number }) =>
  cached(
    `bus:stops:${q.lat.toFixed(4)},${q.lng.toFixed(4)}`,
    24 * 60 * 60_000,
    async () =>
      map(
        await call('1613000/BusSttnInfoInqireService/getCrdntPrxmtSttnList', {
          gpsLati: q.lat,
          gpsLong: q.lng,
          numOfRows: 20,
          pageNo: 1,
          _type: 'json',
        }),
        (items) =>
          items
            .map((i) => {
              const lat = num(i.gpslati)
              const lng = num(i.gpslong)
              return {
                cityCode: str(i.citycode),
                id: str(i.nodeid),
                name: str(i.nodenm),
                no: str(i.nodeno),
                lat,
                lng,
                distanceM:
                  lat !== null && lng !== null
                    ? distanceM(q, { lat, lng })
                    : null,
              }
            })
            .sort((a, b) => (a.distanceM ?? 1e9) - (b.distanceM ?? 1e9))
            .slice(0, q.limit ?? 4),
      ),
  )

export type Arrival = {
  route: string
  routeType: string
  minutes: number | null
  stopsAway: number | null
  vehicle: string
}

export const arrivals = (cityCode: string, nodeId: string) =>
  cached(`bus:arr:${cityCode}:${nodeId}`, 20_000, async () =>
    map(
      await call(
        '1613000/ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList',
        {
          cityCode,
          nodeId,
          numOfRows: 30,
          pageNo: 1,
          _type: 'json',
        },
      ),
      (items) =>
        items
          .map((i) => ({
            route: str(i.routeno),
            routeType: str(i.routetp),
            minutes:
              num(i.arrtime) === null ? null : Math.round(num(i.arrtime)! / 60),
            stopsAway: num(i.arrprevstationcnt),
            vehicle: str(i.vehicletp),
          }))
          .sort((a, b) => (a.minutes ?? 1e9) - (b.minutes ?? 1e9)),
    ),
  )

export type RouteInfo = {
  id: string
  no: string
  type: string
  from: string
  to: string
  first: string
  last: string
}

const routeInfo = (i: Record<string, unknown>): RouteInfo => ({
  id: str(i.routeid),
  no: str(i.routeno),
  type: str(i.routetp),
  from: str(i.startnodenm),
  to: str(i.endnodenm),
  first: str(i.startvehicletime),
  last: str(i.endvehicletime),
})

/** Routes that pass a stop. */
export const routesAt = (cityCode: string, nodeId: string) =>
  cached(`bus:routesAt:${cityCode}:${nodeId}`, 24 * 60 * 60_000, async () =>
    map(
      await call('1613000/BusSttnInfoInqireService/getSttnThrghRouteList', {
        cityCode,
        nodeid: nodeId,
        numOfRows: 50,
        pageNo: 1,
        _type: 'json',
      }),
      (items) => items.map(routeInfo),
    ),
  )

export const routeByNo = (cityCode: string, routeNo: string) =>
  cached(`bus:route:${cityCode}:${routeNo}`, 24 * 60 * 60_000, async () =>
    map(
      await call('1613000/BusRouteInfoInqireService/getRouteNoList', {
        cityCode,
        routeNo,
        numOfRows: 20,
        pageNo: 1,
        _type: 'json',
      }),
      (items) => items.map(routeInfo),
    ),
  )

// ── TAGO trains ─────────────────────────────────────────────────────────

type Station = { id: string; name: string }

const allStations = () =>
  cached('train:stations', 7 * 24 * 60 * 60_000, async () => {
    const cities = await call('1613000/TrainInfo/GetCtyCodeList', {
      _type: 'json',
    })
    if (cities.status !== 'LIVE') return cities
    const lists = await Promise.all(
      cities.data.map((c) =>
        call('1613000/TrainInfo/GetCtyAcctoTrainSttnList', {
          cityCode: str(c.citycode),
          numOfRows: 500,
          pageNo: 1,
          _type: 'json',
        }),
      ),
    )
    const stations: Station[] = lists.flatMap((l) =>
      l.status === 'LIVE'
        ? l.data.map((s) => ({ id: str(s.nodeid), name: str(s.nodename) }))
        : [],
    )
    return { ...cities, data: stations }
  })

/** "서울역" and "서울" both find 서울. */
export const findStation = (stations: Station[], name: string) => {
  const n = name.replace(/역$/, '').trim()
  return (
    stations.find((s) => s.name === n) ??
    stations.find((s) => s.name.replace(/역$/, '') === n) ??
    stations.find((s) => s.name.startsWith(n))
  )
}

export type Train = {
  no: string
  grade: string
  departs: string
  arrives: string
  from: string
  to: string
  fare: number | null
}

const hhmm = (t: string) =>
  t.length >= 12 ? `${t.slice(8, 10)}:${t.slice(10, 12)}` : t

export const trains = async (q: { from: string; to: string; date: string }) => {
  const stations = await allStations()
  if (stations.status !== 'LIVE') return stations
  const from = findStation(stations.data, q.from)
  const to = findStation(stations.data, q.to)
  if (!from || !to)
    return {
      status: 'ERROR' as const,
      data: null,
      message: `역을 찾지 못했어요: ${!from ? q.from : q.to}`,
    }
  return cached(`train:${from.id}:${to.id}:${q.date}`, 30 * 60_000, async () =>
    map(
      await call('1613000/TrainInfo/GetStrtpntAlocFndTrainInfo', {
        depPlaceId: from.id,
        arrPlaceId: to.id,
        depPlandTime: q.date.replaceAll('-', ''),
        numOfRows: 100,
        pageNo: 1,
        _type: 'json',
      }),
      (items): Train[] =>
        items
          .map((i) => ({
            no: str(i.trainno),
            grade: str(i.traingradename),
            departs: hhmm(str(i.depplandtime)),
            arrives: hhmm(str(i.arrplandtime)),
            from: str(i.depplacename),
            to: str(i.arrplacename),
            fare: num(i.adultcharge),
          }))
          .sort((a, b) => a.departs.localeCompare(b.departs)),
    ),
  )
}

// ── KMA short-term forecast ─────────────────────────────────────────────

/** Lat/lng → KMA 5 km grid (Lambert conformal conic, KMA's published constants). */
export const kmaGrid = (lat: number, lng: number) => {
  const RE = 6371.00877 / 5.0
  const DEG = Math.PI / 180
  const slat1 = 30 * DEG
  const slat2 = 60 * DEG
  const olon = 126 * DEG
  const olat = 38 * DEG
  let sn =
    Math.tan(Math.PI * 0.25 + slat2 * 0.5) /
    Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn)
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5)
  ro = (RE * sf) / Math.pow(ro, sn)
  let ra = Math.tan(Math.PI * 0.25 + lat * DEG * 0.5)
  ra = (RE * sf) / Math.pow(ra, sn)
  let theta = lng * DEG - olon
  if (theta > Math.PI) theta -= 2 * Math.PI
  if (theta < -Math.PI) theta += 2 * Math.PI
  theta *= sn
  return {
    nx: Math.floor(ra * Math.sin(theta) + 43 + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + 136 + 0.5),
  }
}

/** The latest issued base time (02, 05, …, 23 KST, available ~10 minutes later). */
export const kmaBase = (now: Date) => {
  const kst = new Date(now.getTime() + 9 * 3600_000 - 15 * 60_000)
  const hours = [23, 20, 17, 14, 11, 8, 5, 2]
  const h = kst.getUTCHours()
  const base = hours.find((b) => b <= h)
  const day = new Date(kst)
  if (base === undefined) day.setUTCDate(day.getUTCDate() - 1)
  const ymd = day.toISOString().slice(0, 10).replaceAll('-', '')
  return { date: ymd, time: `${String(base ?? 23).padStart(2, '0')}00` }
}

const sky: Record<string, string> = {
  '1': '맑음',
  '3': '구름많음',
  '4': '흐림',
}
const precip: Record<string, string> = {
  '0': '',
  '1': '비',
  '2': '비/눈',
  '3': '눈',
  '4': '소나기',
}

export type ForecastHour = {
  date: string
  time: string
  tempC: number | null
  sky: string
  precip: string
  popPct: number | null
  windMs: number | null
}

export const forecast = (q: { lat: number; lng: number }, now = new Date()) => {
  const { nx, ny } = kmaGrid(q.lat, q.lng)
  const base = kmaBase(now)
  return cached(
    `kma:${nx},${ny}:${base.date}${base.time}`,
    30 * 60_000,
    async () =>
      map(
        await call('1360000/VilageFcstInfoService_2.0/getVilageFcst', {
          base_date: base.date,
          base_time: base.time,
          nx,
          ny,
          numOfRows: 1000,
          pageNo: 1,
          dataType: 'JSON',
        }),
        (items): ForecastHour[] => {
          const byHour = new Map<string, Record<string, string>>()
          for (const i of items) {
            const k = `${str(i.fcstDate)}${str(i.fcstTime)}`
            byHour.set(k, {
              ...byHour.get(k),
              [str(i.category)]: str(i.fcstValue),
            })
          }
          return [...byHour.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => ({
              date: `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`,
              time: `${k.slice(8, 10)}:${k.slice(10, 12)}`,
              tempC: num(v.TMP),
              sky: sky[v.SKY] ?? '',
              precip: precip[v.PTY] ?? '',
              popPct: num(v.POP),
              windMs: num(v.WSD),
            }))
        },
      ),
  )
}
