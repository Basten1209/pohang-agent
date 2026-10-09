import { Map as MapIcon, Navigation } from 'lucide-react'
import { useEffect } from 'react'
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
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { toward } from '#/core/explain'
import { mapUrl } from '#/core/links'
import { readingLine } from '#/core/live'
import type { Decision } from '#/core/planner'
import { canTravel } from '#/core/planner'
import { anchorOf, courseById, departLabel, hubOf } from '#/core/route'
import type { TripConfig } from '#/core/schema'
import { clock } from '#/core/time'
import type { TripView } from '#/core/view'
import { PlaceThumb } from './thumb'

const decisionLabel: Record<Decision, string> = {
  GO: '추천 코스',
  INDOOR: '실내 위주',
  SHORTEN: '단축 코스',
  CANCEL: '귀가 우선',
  MEDICAL_FIRST: '의료 우선',
  NEEDS_DATA: '확인 필요',
  INCOMPLETE: '입력 필요',
}

/** The course the agent made, read from the same trip as the chat. */
export const TourTab = ({
  config,
  view,
  active,
  refresh,
  ask,
}: {
  config: TripConfig
  view: TripView
  /** The tab is showing: pull fresh live observations into the plan. */
  active: boolean
  refresh: () => void
  /** Open the agent with this message. */
  ask: (text: string) => void
}) => {
  const { state, itinerary: it, stage } = view
  const planned =
    stage === 'PLANNING' || stage === 'JOURNEY' || stage === 'DONE'
  useEffect(() => {
    if (active && planned) refresh()
    // Refresh on entering the tab, not on every trip update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, planned])

  if (!planned || it.decision === 'INCOMPLETE')
    return (
      <Empty className="m-4 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MapIcon />
          </EmptyMedia>
          <EmptyTitle>아직 코스가 없어요</EmptyTitle>
          <EmptyDescription>
            완주 후 에이전트가 지금 컨디션과 귀가 시간에 맞춰 코스를 만들어
            드려요.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )

  const course = courseById(config, it.course)
  const hub = hubOf(config, state.plan)
  const map = mapUrl(config, it.course)
  const place = (id: string) => config.places.find((p) => p.id === id)
  const origin = anchorOf(config, state.plan.origin)?.name ?? state.plan.origin
  const travel = canTravel(it)
  const timeline = [
    ...(it.outbound > 0
      ? [
          { at: clock(it.start), what: `${origin} 출발` },
          {
            at: clock(it.start + it.outbound),
            what: `${course?.area ?? '코스'} 도착`,
          },
        ]
      : []),
    ...it.stops.map((s) => ({
      at: `${clock(s.start)}–${clock(s.end)}`,
      what: place(s.id)?.attrs.short ?? s.id,
    })),
    ...(it.returnDeparture !== null
      ? [{ at: clock(it.returnDeparture), what: `${toward(hub.name)} 출발` }]
      : []),
    ...(it.planningArrival !== null
      ? [
          {
            at: clock(it.planningArrival),
            what: `${hub.name} 도착 (여유 포함)`,
          },
        ]
      : []),
  ]
  const others = it.alternatives.flatMap((id) => courseById(config, id) ?? [])

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardDescription>{departLabel(config, state.plan)}</CardDescription>
          <CardTitle>{course?.title ?? '코스'}</CardTitle>
          <CardAction>
            <Badge variant={travel ? 'secondary' : 'outline'}>
              {decisionLabel[it.decision]}
            </Badge>
          </CardAction>
        </CardHeader>
        {it.stops.length > 0 && (
          <CardContent>
            <Carousel opts={{ align: 'start' }}>
              <CarouselContent>
                {it.stops.map((s) => {
                  const p = place(s.id)
                  if (!p) return null
                  return (
                    <CarouselItem key={s.id} className="basis-3/4 sm:basis-1/2">
                      <div className="flex flex-col gap-2">
                        <PlaceThumb place={p} />
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{p.attrs.short}</span>
                          <span className="line-clamp-2 text-xs text-muted-foreground">
                            {p.attrs.desc}
                          </span>
                          <span className="text-xs tabular-nums">
                            {clock(s.start)}–{clock(s.end)} · {s.dwell}분
                          </span>
                        </div>
                      </div>
                    </CarouselItem>
                  )
                })}
              </CarouselContent>
            </Carousel>
          </CardContent>
        )}
        {!travel && (
          <CardContent className="text-sm text-muted-foreground">
            {it.reasons.join(' ')}
          </CardContent>
        )}
      </Card>

      {travel && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>시간표</CardTitle>
            <CardDescription className="tabular-nums">
              {hub.name} 도착 목표 {clock(it.stationTarget)} · 여유{' '}
              {it.slack ?? 0}분 · 걷기 {it.walking}분
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-2 text-sm">
              {timeline.map((row) => (
                <li key={`${row.at}${row.what}`} className="flex gap-3">
                  <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                    {row.at}
                  </span>
                  <span>{row.what}</span>
                </li>
              ))}
            </ol>
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-2">
            <p className="text-xs text-muted-foreground">
              근거:{' '}
              {readingLine(state.observations, 'congestion', '교통 혼잡', '%')}
              {it.trafficReserve > 0 && ` · 귀가 여유 +${it.trafficReserve}분`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline">
                <a href={map('COURSE')} target="_blank" rel="noreferrer">
                  <Navigation />
                  {course?.area ?? '코스'} 가는 길
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={map(hub.id)} target="_blank" rel="noreferrer">
                  <Navigation />
                  {hub.name} 가는 길
                </a>
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {others.length > 0 && (
        <div className="flex flex-col gap-2 px-1">
          <span className="text-sm text-muted-foreground">
            다른 코스도 있어요
          </span>
          <div className="flex flex-wrap gap-2">
            {others.map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant="outline"
                onClick={() => ask(`${c.area} 코스로 보여줘`)}
              >
                {c.title}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
