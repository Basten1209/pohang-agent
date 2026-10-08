import {
  ArrowUpRight,
  BusFront,
  ChevronRight,
  Coffee,
  Footprints,
  TrainFront,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { usableReading } from '#/core/signals'
import { courseById, hubOf, modeOf } from '#/core/route'
import { clock, duration } from '#/core/time'
import { toggleExcluded, toggleWalking } from '#/core/trip'
import { useApp } from './context'

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-xl font-semibold tabular-nums">{value}</span>
  </div>
)

export const TrainCard = () => {
  const { state, itinerary, open, config } = useApp()
  const slack = itinerary.slack
  return (
    <Card>
      <CardHeader>
        <CardTitle>귀가 {modeOf(config, state.plan).noun}</CardTitle>
        <CardDescription>
          {hubOf(config, state.plan).name} · 실제 예약은 바뀌지 않아요
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => open('train')}>
            {state.plan.departTime} 변경
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <Stat label="역 도착 목표" value={clock(itinerary.stationTarget)} />
        <Stat
          label="계획상 역 도착"
          value={
            itinerary.planningArrival !== null
              ? clock(itinerary.planningArrival)
              : '확인 필요'
          }
        />
      </CardContent>
      {slack !== null && (
        <CardFooter>
          <Badge variant={slack < 0 ? 'destructive' : 'secondary'}>
            {slack < 0
              ? `목표보다 ${Math.abs(slack)}분 늦어요`
              : `목표까지 ${duration(slack)} 여유`}
          </Badge>
        </CardFooter>
      )}
    </Card>
  )
}

export const ObservationCard = () => {
  const { state, open, config } = useApp()
  const obs = state.observations
  return (
    <Card>
      <CardHeader>
        <CardTitle>포항 관측</CardTitle>
        <CardDescription>
          E-UM 디지털 트윈 ·{' '}
          {obs.provenance === 'SIMULATED' ? '시연 관측' : '실관측'}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={() => open('evidence')}>
            근거
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        {config.policy.signals.map((s) => {
          const v = usableReading(obs, s.reading)
          const unit = s.reading === 'congestion' ? '%' : ''
          return (
            <Stat
              key={s.reading}
              label={s.label}
              value={v === null ? '확인 불가' : `${v}${unit}`}
            />
          )
        })}
      </CardContent>
    </Card>
  )
}

export const StatsCard = () => {
  const { itinerary } = useApp()
  return (
    <Card>
      <CardContent className="grid grid-cols-3 gap-4">
        <Stat label="걷기" value={`${itinerary.walking}분`} />
        <Stat label="코스 체류" value={duration(itinerary.localMin)} />
        <Stat
          label="왕복 이동"
          value={duration(itinerary.outbound + itinerary.returnMin)}
        />
      </CardContent>
    </Card>
  )
}

export const ItineraryCard = () => {
  const { itinerary: it, config, open, map, state } = useApp()
  const place = (id: string) => config.places.find((p) => p.id === id)
  return (
    <Card>
      <CardHeader>
        <CardTitle>코스</CardTitle>
        <CardDescription>
          {it.stops.length}곳 · {courseById(config, it.course)?.title ?? ''}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={() => open('taxi')}>
            이동수단
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ItemGroup>
          {it.outbound > 0 && (
            <Item size="sm">
              <ItemMedia variant="icon">
                <BusFront />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{clock(it.start)} 영일대 출발</ItemTitle>
                <ItemDescription>
                  {courseById(config, it.course)?.outbound.via ?? '대중교통'} ·{' '}
                  {courseById(config, it.course)?.area}까지 {it.outbound}분
                  (시연)
                </ItemDescription>
              </ItemContent>
            </Item>
          )}
          {it.stops.map((stop) => {
            const p = place(stop.id)
            if (!p) return null
            return (
              <Item key={stop.id} variant="outline" size="sm" asChild>
                <button
                  type="button"
                  onClick={() => open({ place: stop.id })}
                  className="text-left"
                >
                  <ItemMedia variant="image">
                    <img src={p.attrs.image} alt="" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{p.attrs.short}</ItemTitle>
                    <ItemDescription>
                      {clock(stop.start)}–{clock(stop.end)} · {stop.dwell}분
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <ChevronRight />
                  </ItemActions>
                </button>
              </Item>
            )
          })}
          {it.returnDeparture !== null && (
            <Item size="sm">
              <ItemMedia variant="icon">
                <TrainFront />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  {clock(it.returnDeparture)} {hubOf(config, state.plan).name}
                  (으)로 복귀
                </ItemTitle>
                <ItemDescription>
                  버스 {it.returnMin}분 · 요금 확인 필요
                  {it.trafficReserve
                    ? ` · 교통 여유 +${it.trafficReserve}분`
                    : ''}
                </ItemDescription>
              </ItemContent>
            </Item>
          )}
        </ItemGroup>
        {it.excluded.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {it.excluded.map((x) => (
              <Badge key={x.id} variant="outline">
                {place(x.id)?.attrs.short ?? x.id} 제외 · {x.reason}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-2">
        <Button variant="outline" asChild>
          <a href={map('COURSE')} target="_blank" rel="noreferrer">
            {courseById(config, it.course)?.area} 경로 <ArrowUpRight />
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a
            href={map(hubOf(config, state.plan).id)}
            target="_blank"
            rel="noreferrer"
          >
            {hubOf(config, state.plan).name} 경로 <ArrowUpRight />
          </a>
        </Button>
      </CardFooter>
    </Card>
  )
}

export const AdjustCard = () => {
  const { state, run, open } = useApp()
  const cafeOut = state.plan.excluded.includes('cafe')
  return (
    <Card>
      <CardHeader>
        <CardTitle>조정</CardTitle>
        <CardDescription>바꾸면 바로 다시 계산해요.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Button
          variant="outline"
          className="justify-start"
          onClick={() => run(toggleWalking(state))}
        >
          <Footprints />
          {state.plan.walkingLimit === 30
            ? '15분 이내로 걷기'
            : '30분까지 걷기'}
        </Button>
        <Button
          variant="outline"
          className="justify-start"
          onClick={() => run(toggleExcluded(state, 'cafe'))}
        >
          <Coffee />
          {cafeOut ? '카페 다시 넣기' : '카페 빼기'}
        </Button>
        <Button
          variant="outline"
          className="justify-start"
          onClick={() => open('train')}
        >
          <TrainFront />
          귀가 시각 변경
        </Button>
      </CardContent>
    </Card>
  )
}
