import {
  ArrowRight,
  ArrowUpRight,
  BusFront,
  CheckCircle2,
  ChevronRight,
  Coffee,
  Footprints,
  MapPin,
  Radio,
  Settings2,
  TrainFront,
  TriangleAlert,
  Wind,
  X,
} from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Separator } from '#/components/ui/separator'
import { canTravel } from '#/core/planner'
import { usableReading } from '#/core/signals'
import { toggleExcluded, toggleWalking } from '#/core/trip'
import { clock, duration } from '#/core/time'
import { cn } from '#/lib/utils'
import { PlaceIcon, SectionTitle } from './bits'
import { useApp } from './context'

export const TicketCard = () => {
  const { state, itinerary, open } = useApp()
  const late = itinerary.slack !== null && itinerary.slack < 0
  return (
    <Card className="gap-0 overflow-hidden border-0 bg-primary py-0 text-primary-foreground shadow-lg">
      <CardContent className="space-y-4 p-5">
        <p className="flex items-center gap-2 text-xs font-semibold text-lime">
          <TrainFront className="size-4" /> 돌아오는 길도, 여유 있게
        </p>
        <div className="flex items-center justify-between">
          <strong className="text-2xl font-extrabold">포항</strong>
          <span className="flex items-center gap-1 text-primary-foreground/50">
            ─────── <ArrowRight className="size-4" />
          </span>
          <strong className="text-2xl font-extrabold">서울</strong>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-primary-foreground/70">포항역 출발</span>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 rounded-full bg-primary-foreground/10 font-bold text-primary-foreground hover:bg-primary-foreground/20"
            onClick={() => open('train')}
          >
            {state.plan.trainTime} <Settings2 className="size-3.5" />
          </Button>
        </div>
      </CardContent>
      <div className="border-t border-dashed border-primary-foreground/20" />
      <CardContent className="grid grid-cols-2 gap-3 p-5">
        <div>
          <p className="text-xs text-primary-foreground/60">역 도착 목표</p>
          <p className="text-xl font-extrabold">
            {clock(itinerary.stationTarget)}
          </p>
        </div>
        <div>
          <p className="text-xs text-primary-foreground/60">계획상 역 도착</p>
          <p className="text-xl font-extrabold text-lime">
            {itinerary.planningArrival !== null
              ? clock(itinerary.planningArrival)
              : '확인 필요'}
          </p>
        </div>
        {itinerary.slack !== null && (
          <p
            className={cn(
              'col-span-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
              late ? 'bg-destructive/90 text-white' : 'bg-lime/15 text-lime',
            )}
          >
            {late ? (
              <TriangleAlert className="size-3.5" />
            ) : (
              <CheckCircle2 className="size-3.5" />
            )}
            {late
              ? `역 도착 목표보다 ${Math.abs(itinerary.slack)}분 늦어요`
              : `역 도착 목표까지 ${duration(itinerary.slack)} 여유`}
          </p>
        )}
        <p className="col-span-2 text-[11px] leading-relaxed text-primary-foreground/55">
          열차 출발 30분 전 도착을 목표로 계산해요. 열차 예약은 변경되지 않아요.
        </p>
      </CardContent>
    </Card>
  )
}

export const DataStrip = () => {
  const { state, open, config } = useApp()
  const obs = state.observations
  const show = (reading: string, unit = '') => {
    const v = usableReading(obs, reading)
    return v === null ? '확인 불가' : `${v}${unit}`
  }
  return (
    <Card className="gap-0 py-0">
      <button
        type="button"
        onClick={() => open('evidence')}
        className="flex w-full items-center gap-3 p-4 text-left"
        aria-label="데이터 근거와 실제 연결 확인"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <Radio className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-primary">
            구룡포의 지금을 반영해요
          </span>
          <span className="block text-xs text-muted-foreground">
            E-UM 디지털 트윈 ·{' '}
            {obs.provenance === 'SIMULATED' ? '시연용 관측' : '실관측'}
          </span>
        </span>
        <ArrowUpRight className="size-4 text-muted-foreground" />
      </button>
      <Separator />
      <div className="grid grid-cols-2 divide-x">
        {config.policy.signals.map((s) => (
          <div key={s.reading} className="flex items-center gap-2 p-3">
            {s.reading === 'pm25' ? (
              <Wind className="size-4 text-muted-foreground" />
            ) : (
              <BusFront className="size-4 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground">
              {s.label}
              <strong className="block text-sm text-primary">
                {show(s.reading, s.reading === 'congestion' ? '%' : '')}
              </strong>
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

export const ItineraryList = () => {
  const { itinerary, config, open } = useApp()
  const place = (id: string) => config.places.find((p) => p.id === id)
  return (
    <section className="space-y-3">
      <SectionTitle
        title="오늘은 이렇게, 천천히"
        meta={`${itinerary.stops.length}곳 · 구룡포 중심부`}
      />
      {itinerary.outbound > 0 && (
        <TransitRow
          icon={<BusFront className="size-4" />}
          title={`${clock(itinerary.start)} 영일대에서 출발`}
          meta={`버스로 구룡포까지 · 도보·대기 포함 ${itinerary.outbound}분 (시연)`}
          action="이동 정보"
          onAction={() => open('taxi')}
        />
      )}
      <ol className="space-y-2">
        {itinerary.stops.map((stop, i) => {
          const p = place(stop.id)
          if (!p) return null
          return (
            <li key={stop.id}>
              <button
                type="button"
                onClick={() => open({ place: stop.id })}
                className="flex w-full items-center gap-3 rounded-2xl border bg-card p-2.5 text-left shadow-xs transition active:scale-[0.99]"
              >
                <span className="w-6 text-center text-xs font-bold text-muted-foreground">
                  0{i + 1}
                </span>
                <img
                  src={p.attrs.image}
                  alt=""
                  className="size-14 rounded-xl object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-harbor">
                    {clock(stop.start)} — {clock(stop.end)} · {stop.dwell}분
                  </span>
                  <span className="block truncate font-bold text-primary">
                    {p.attrs.short}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.attrs.subtitle}
                  </span>
                </span>
                <span className="grid size-8 place-items-center rounded-full bg-secondary">
                  <PlaceIcon name={p.attrs.icon} />
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            </li>
          )
        })}
      </ol>
      {itinerary.excluded.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {itinerary.excluded.map((x) => (
            <Badge
              key={x.id}
              variant="outline"
              className="gap-1 font-normal text-muted-foreground"
            >
              <X className="size-3" />
              <s>{place(x.id)?.attrs.short ?? x.id}</s>
              <span className="text-[10px]">{x.reason}</span>
            </Badge>
          ))}
        </div>
      )}
      {itinerary.returnDeparture !== null && (
        <TransitRow
          icon={<TrainFront className="size-4" />}
          title={`${clock(itinerary.returnDeparture)} 구룡포에서 포항역으로`}
          meta={`버스 ${itinerary.returnMin}분 · 비용 확인 필요${
            itinerary.trafficReserve
              ? ` · 교통 여유 +${itinerary.trafficReserve}분`
              : ''
          }`}
          action="택시 비교"
          onAction={() => open('taxi')}
        />
      )}
    </section>
  )
}

const TransitRow = ({
  icon,
  title,
  meta,
  action,
  onAction,
}: {
  icon: React.ReactNode
  title: string
  meta: string
  action: string
  onAction: () => void
}) => (
  <div className="flex items-center gap-3 rounded-2xl bg-secondary/70 p-3">
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-card text-primary">
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-bold text-primary">{title}</span>
      <span className="block text-xs text-muted-foreground">{meta}</span>
    </span>
    <Button
      variant="ghost"
      size="sm"
      className="shrink-0 px-2 text-xs"
      onClick={onAction}
    >
      {action} <ChevronRight className="size-3" />
    </Button>
  </div>
)

export const TripStats = () => {
  const { itinerary } = useApp()
  const stats = [
    { icon: Footprints, label: '예상 걷기', value: `${itinerary.walking}분` },
    { icon: Coffee, label: '구룡포 체류', value: duration(itinerary.localMin) },
    {
      icon: BusFront,
      label: '왕복 이동',
      value: duration(itinerary.outbound + itinerary.returnMin),
    },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl border bg-card p-3">
          <s.icon className="mb-1 size-4 text-harbor" />
          <p className="text-[11px] text-muted-foreground">{s.label}</p>
          <p className="text-sm font-extrabold text-primary">{s.value}</p>
        </div>
      ))}
    </div>
  )
}

export const AdjustCard = () => {
  const { state, run, open } = useApp()
  const cafeOut = state.plan.excluded.includes('cafe')
  const rows = [
    {
      icon: Footprints,
      label:
        state.plan.walkingLimit === 30
          ? '15분 이내로 덜 걷기'
          : '30분까지 걷기',
      onClick: () => run(toggleWalking(state)),
    },
    {
      icon: Coffee,
      label: cafeOut ? '카페 다시 넣기' : '카페 빼기',
      onClick: () => run(toggleExcluded(state, 'cafe')),
    },
    { icon: TrainFront, label: '귀가 시각 변경', onClick: () => open('train') },
  ]
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-sm font-bold text-primary">내 여행에 맞게 조정</h3>
        <Settings2 className="size-4 text-muted-foreground" />
      </div>
      {rows.map((r) => (
        <button
          key={r.label}
          type="button"
          onClick={r.onClick}
          className="flex w-full items-center gap-3 border-t px-4 py-3 text-left text-sm active:bg-secondary"
        >
          <r.icon className="size-4 text-harbor" />
          <span className="flex-1 font-medium">{r.label}</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      ))}
    </Card>
  )
}

/** Schematic of the visit order. Not a road map. */
export const RouteMap = () => {
  const { map } = useApp()
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center justify-between px-4 py-3 text-xs">
        <span className="flex items-center gap-1.5 font-bold text-primary">
          <MapPin className="size-4" /> 오늘의 여행 동선
        </span>
        <span className="text-muted-foreground">
          방문 순서 · 실제 도로 아님
        </span>
      </div>
      <svg
        viewBox="0 0 740 258"
        role="img"
        aria-label="영일대에서 구룡포를 방문한 뒤 포항역으로 돌아오는 개념도"
        className="block w-full bg-[#edf0e5]"
      >
        <path
          d="M190 -10 C180 50 245 80 240 120 S330 240 375 260 L740 260 L740 -10Z"
          fill="#d4e8e8"
        />
        <path d="M380 258 Q472 193 547 190 T740 95 L740 258" fill="#e7ecdd" />
        <g stroke="#fff" strokeWidth="7" fill="none">
          <path d="M46 0L90 82L74 200L188 258" />
          <path d="M0 98L165 105L219 169L343 250" />
          <path d="M472 258L550 216L688 212L740 168" />
        </g>
        <path
          d="M218 69 C295 69 296 188 571 204"
          stroke="#df835a"
          strokeWidth="3"
          strokeDasharray="7 7"
          fill="none"
        />
        <path
          d="M565 205 C390 182 272 244 104 140"
          stroke="#31565a"
          strokeWidth="3"
          strokeDasharray="7 7"
          fill="none"
        />
        <text x="432" y="80" fill="#819b9e" fontSize="15">
          영 일 만
        </text>
        {[
          { x: 218, y: 69, label: '영일대 · 출발', fill: '#df835a' },
          { x: 571, y: 204, label: '구룡포', fill: '#244c50' },
          { x: 104, y: 140, label: '포항역 · 귀가', fill: '#31565a' },
        ].map((p) => (
          <g key={p.label}>
            <circle
              cx={p.x}
              cy={p.y}
              r="11"
              fill={p.fill}
              stroke="#fff"
              strokeWidth="4"
            />
            <text
              x={p.x + 16}
              y={p.y - 12}
              fill="#203f42"
              fontSize="17"
              fontWeight="700"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="grid grid-cols-2 gap-2 p-3">
        <Button asChild variant="outline" size="sm">
          <a href={map('GURYONGPO')} target="_blank" rel="noreferrer">
            구룡포 경로 <ArrowUpRight />
          </a>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={map('STATION')} target="_blank" rel="noreferrer">
            포항역 경로 <ArrowUpRight />
          </a>
        </Button>
      </div>
    </Card>
  )
}

export const useCanTravel = () => canTravel(useApp().itinerary)
