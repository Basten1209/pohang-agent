import {
  ArrowRight,
  ArrowUpRight,
  BusFront,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Navigation,
  Radio,
  RotateCcw,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '#/components/ui/drawer'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Skeleton } from '#/components/ui/skeleton'
import type { Evidence } from '#/core/evidence'
import { clock } from '#/core/time'
import { changeTrain, runScenario } from '#/core/trip'
import { cn } from '#/lib/utils'
import { Eyebrow, PlaceIcon } from './bits'
import { useApp } from './context'
import type { Sheet } from './context'

const titleOf = (sheet: Sheet, placeName?: string) =>
  sheet === 'demo'
    ? '데모 컨트롤'
    : sheet === 'evidence'
      ? '데이터와 연결 상태'
      : sheet === 'train'
        ? '귀가 열차 시각 변경'
        : sheet === 'taxi'
          ? '포항역 복귀 · 이동수단 비교'
          : sheet === 'why'
            ? '이 코스를 제안한 이유'
            : (placeName ?? '')

export const Sheets = () => {
  const { sheet, open, config } = useApp()
  const place =
    sheet && typeof sheet === 'object'
      ? config.places.find((p) => p.id === sheet.place)
      : undefined
  const body: ReactNode =
    sheet === 'demo' ? (
      <DemoSheet />
    ) : sheet === 'evidence' ? (
      <EvidenceSheet />
    ) : sheet === 'train' ? (
      <TrainSheet />
    ) : sheet === 'taxi' ? (
      <TaxiSheet />
    ) : sheet === 'why' ? (
      <WhySheet />
    ) : place ? (
      <PlaceSheet id={place.id} />
    ) : null
  return (
    <Drawer open={sheet !== null} onOpenChange={(o) => !o && open(null)}>
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-xl">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-lg font-extrabold text-primary">
            {titleOf(sheet, place?.attrs.short)}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            {titleOf(sheet, place?.attrs.short)}
          </DrawerDescription>
        </DrawerHeader>
        <div className="space-y-4 overflow-y-auto px-4 pb-safe">{body}</div>
      </DrawerContent>
    </Drawer>
  )
}

const Intro = ({ children }: { children: ReactNode }) => (
  <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
)

const DemoSheet = () => {
  const { config, state, run, open } = useApp()
  const go = (id: string) => {
    run(runScenario(config, state, id))
    open(null)
  }
  return (
    <>
      <Intro>
        민준님의 하루를 빠르게 시연해 보세요. 시나리오는 설정(jsonb)에서 불러온
        데이터예요.
      </Intro>
      <div className="space-y-2">
        {config.scenarios.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(s.id)}
            className="flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left active:bg-secondary"
          >
            <span className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-bold">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-primary">
                {s.title}
              </span>
              <span className="block text-xs text-muted-foreground">
                {s.desc}
              </span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        ))}
      </div>
      <Button variant="outline" className="w-full" onClick={() => go('reset')}>
        <RotateCcw /> 내 하루 만들기부터 다시 시작
      </Button>
    </>
  )
}

const statusTone: Record<Evidence['status'], string> = {
  LIVE: 'bg-emerald-100 text-emerald-800',
  SNAPSHOT: 'bg-amber-100 text-amber-800',
  NOT_CONFIGURED: 'bg-secondary text-muted-foreground',
  ERROR: 'bg-red-100 text-red-800',
}

const EvidenceSheet = () => {
  const { state, storage } = useApp()
  const [evidence, setEvidence] = useState<Evidence[] | null>(null)
  const [status, setStatus] = useState<Record<string, unknown> | null>(null)
  const [busy, setBusy] = useState(false)
  const load = async () => {
    setBusy(true)
    try {
      const [e, s] = await Promise.all([
        fetch('/api/evidence').then((r) => r.json()),
        fetch('/api/status').then((r) => r.json()),
      ])
      setEvidence(e.evidence)
      setStatus(s)
    } catch {
      setEvidence([])
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])
  const obs = state.observations
  const rows: [string, ReactNode][] = [
    ['일정·이동 경로', 'SIMULATED'],
    ['결정에 쓰는 관측', `${obs.provenance} · ${obs.freshness}`],
    [
      '혼잡 / 초미세먼지',
      `${obs.readings.congestion ?? '—'}% / ${obs.readings.pm25 ?? '—'}`,
    ],
    [
      'OpenAI',
      status
        ? status.agent === 'CONFIGURED'
          ? `연결 · ${status.model}`
          : '미설정 · 시연 응답'
        : '…',
    ],
    ['저장소', String(status?.storage ?? storage)],
  ]
  return (
    <>
      <div className="flex gap-3 rounded-2xl bg-accent p-3 text-accent-foreground">
        <Radio className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-sm font-bold">시연과 실제 연결을 구분해요</p>
          <p className="text-xs leading-relaxed">
            코스 계산에는 화면의 시연 관측을 사용해요. E-UM 실응답은
            단위·범위·관측 시각 검증을 위해 별도로 표시해요.
          </p>
        </div>
      </div>
      <dl className="divide-y rounded-2xl border bg-card text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 px-3 py-2">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-semibold text-primary">{v}</dd>
          </div>
        ))}
      </dl>
      <Button className="w-full" onClick={load} disabled={busy}>
        <Radio /> E-UM 실제 연결 다시 확인
      </Button>
      {evidence === null || busy ? (
        <Skeleton className="h-24 w-full rounded-2xl" />
      ) : (
        evidence.map((e) => (
          <div
            key={e.sourceId}
            className="space-y-1 rounded-2xl border bg-card p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm text-primary">{e.label}</strong>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold',
                  statusTone[e.status],
                )}
              >
                {e.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {e.sourceId} · {e.message}
            </p>
            {e.value !== null && (
              <p className="text-sm font-bold text-primary">
                {e.value}{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  {e.unit}
                </span>
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              조회{' '}
              {new Date(e.fetchedAt).toLocaleString('ko-KR', {
                timeZone: 'Asia/Seoul',
              })}{' '}
              · 관측{' '}
              {e.observedAt
                ? new Date(e.observedAt).toLocaleString('ko-KR', {
                    timeZone: 'Asia/Seoul',
                  })
                : '확인 불가'}{' '}
              · {e.freshness}
            </p>
          </div>
        ))
      )}
      <details className="rounded-2xl border bg-card p-3 text-xs leading-relaxed text-muted-foreground">
        <summary className="cursor-pointer font-semibold text-primary">
          시연 데이터·사진 출처와 보관
        </summary>
        <p className="mt-2">
          식당·카페는 상호 미정 후보예요. 버스편, 운영시간, 경사·계단, 요금은
          검증되지 않았어요. 택시 선택은 실데이터 연동 전까지 비활성화돼요.
        </p>
        <p className="mt-2">
          일정은 이 기기에 저장되고 7일 후 초기화돼요. 계획 변경 이벤트(구조화된
          값)만 서버에 기록하고, 채팅 원문은 저장하지 않아요.
        </p>
        <p className="mt-2">
          사진:{' '}
          <a
            className="underline"
            target="_blank"
            rel="noreferrer"
            href="https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=945b0346-06ca-4783-a8f2-1cdc911ecd3f"
          >
            한국관광공사 구룡포항
          </a>{' '}
          ·{' '}
          <a
            className="underline"
            target="_blank"
            rel="noreferrer"
            href="https://badaon.or.kr/seantour_map/travel/destination/detail.do?destId=DEST000662"
          >
            바다온 일본인 가옥거리
          </a>
        </p>
      </details>
    </>
  )
}

const TrainSheet = () => {
  const { state, run, open } = useApp()
  const [draft, setDraft] = useState(state.plan.trainTime)
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        run(changeTrain(draft))
        open(null)
      }}
    >
      <Intro>
        10월 13일, 포항역에서 출발하는 시각이에요. 실제 열차 예약은 바뀌지
        않아요.
      </Intro>
      <div className="space-y-2">
        <Label htmlFor="train">서울행 열차 출발</Label>
        <Input
          id="train"
          type="time"
          required
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-12 text-base"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['16:00', '17:00', '18:30'].map((t) => (
          <Button
            key={t}
            type="button"
            variant={draft === t ? 'default' : 'outline'}
            onClick={() => setDraft(t)}
          >
            {t}
          </Button>
        ))}
      </div>
      <Button type="submit" className="h-12 w-full">
        이 시각에 맞춰 다시 계산 <ArrowRight />
      </Button>
    </form>
  )
}

const TaxiSheet = () => {
  const { map, config } = useApp()
  return (
    <>
      <Intro>
        구룡포 → 포항역 구간만 비교해요. 비교를 열어도 이동수단은 바뀌지 않아요.
      </Intro>
      <div className="flex items-start gap-3 rounded-2xl border-2 border-primary bg-card p-3">
        <BusFront className="mt-0.5 size-6 text-primary" />
        <div className="flex-1">
          <p className="flex items-center gap-2 text-sm font-bold text-primary">
            버스 <Badge>기본 선택</Badge>
          </p>
          <p className="text-sm">
            {config.policy.legs.return.minutes}분 · 도보·대기·승차 포함 (시연)
          </p>
          <p className="text-xs text-muted-foreground">
            요금 확인 필요 · 실제 운행편 확인 필요
          </p>
        </div>
        <CheckCircle2 className="size-5 text-primary" />
      </div>
      <div className="flex items-start gap-3 rounded-2xl border bg-card p-3 opacity-80">
        <Navigation className="mt-0.5 size-6 text-muted-foreground" />
        <div>
          <p className="text-sm font-bold">택시</p>
          <p className="text-sm">예상시간·요금 확인 필요</p>
          <p className="text-xs text-muted-foreground">
            자동차 경로 API 미연결 · 배차 대기 별도
          </p>
        </div>
      </div>
      <Button variant="outline" className="w-full" disabled>
        요금 확인 후 선택할 수 있어요
      </Button>
      <Button asChild className="w-full">
        <a href={map('STATION')} target="_blank" rel="noreferrer">
          카카오맵에서 경로 확인 <ArrowUpRight />
        </a>
      </Button>
    </>
  )
}

const WhySheet = () => {
  const { state, itinerary: it } = useApp()
  const terms = [
    `${state.plan.readyTime} 출발`,
    `${it.outbound}분 이동`,
    `${it.localMin}분 체류`,
    `${it.returnMin}분 복귀`,
    `${it.trafficReserve}분 여유`,
  ]
  return (
    <>
      <Intro>입력한 조건과 결정 엔진의 계산 근거예요.</Intro>
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-secondary p-3 text-xs font-semibold">
        {terms.map((t, i) => (
          <span key={t} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-harbor">＋</span>}
            <span className="rounded-full bg-card px-2 py-1">{t}</span>
          </span>
        ))}
        <span className="text-harbor">＝</span>
        <strong className="rounded-full bg-primary px-2 py-1 text-primary-foreground">
          {it.planningArrival !== null
            ? clock(it.planningArrival)
            : '계산 중단'}
        </strong>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {it.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="text-xs leading-relaxed text-muted-foreground">
        역 도착 예상 {it.stationEta !== null ? clock(it.stationEta) : '—'}와
        교통 여유를 반영한 계획상 도착을 구분해요. 관측 임계값은 시연 정책이며
        공인 기준이 아니에요. 선택된 코스 변형: {it.variant ?? '—'}
      </p>
    </>
  )
}

const PlaceSheet = ({ id }: { id: string }) => {
  const { config, itinerary, map } = useApp()
  const place = config.places.find((p) => p.id === id)
  if (!place) return null
  const dwell =
    itinerary.stops.find((s) => s.id === id)?.dwell ?? place.attrs.defaultDwell
  return (
    <>
      <img
        src={place.attrs.image}
        alt=""
        className="aspect-video w-full rounded-2xl object-cover"
      />
      <Eyebrow>{place.attrs.category}</Eyebrow>
      <h3 className="flex items-center gap-2 text-xl font-extrabold text-primary">
        <PlaceIcon name={place.attrs.icon} className="size-5" />{' '}
        {place.attrs.title}
      </h3>
      <Intro>{place.attrs.desc}</Intro>
      <p className="text-sm leading-relaxed">{place.attrs.detail}</p>
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary" className="gap-1">
          <Clock3 className="size-3.5" /> 예상 체류 {dwell}분
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <CircleHelp className="size-3.5" /> 영업·접근 정보 확인 필요
        </Badge>
        {place.meta.verified === false && (
          <Badge variant="outline">미검증 후보</Badge>
        )}
      </div>
      <Button asChild className="w-full">
        <a href={map(place.id, 'walk')} target="_blank" rel="noreferrer">
          위치 보기 <ArrowUpRight />
        </a>
      </Button>
    </>
  )
}
