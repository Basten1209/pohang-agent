import { Camera, Navigation } from 'lucide-react'
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
  EmptyTitle,
} from '@/components/ui/empty'
import { mapUrl } from '#/core/links'
import { readingLine } from '#/core/live'
import type { Decision } from '#/core/planner'
import { canTravel } from '#/core/planner'
import { courseById, departLabel, hubOf } from '#/core/route'
import type { TravelMode } from '#/core/mobility'
import type { Place } from '#/core/schema'
import { visitedPlaces } from '#/core/community'
import type { ReactNode } from 'react'
import { ItineraryTimeline } from './timeline'
import type { TripConfig } from '#/core/schema'
import { clock } from '#/core/time'
import type { TripView } from '#/core/view'
import { ConditionsCard, TransportCard } from './conditions'
import { AssetCredits, GullPose, MascotBanner } from '#/brand/brand'
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
  selectTransport,
  selectLegTransport,
  photoPrompt,
  onPhoto,
  onAdvance,
  busy,
}: {
  config: TripConfig
  view: TripView
  /** The tab is showing: pull fresh live observations into the plan. */
  active: boolean
  refresh: () => void
  /** Open the agent with this message. */
  ask: (text: string) => void
  selectTransport: (mode: 'AUTO' | 'TAXI' | 'TRANSIT') => Promise<void>
  selectLegTransport: (id: string, mode: TravelMode | 'AUTO') => Promise<void>
  photoPrompt?: ReactNode
  onPhoto: (place: Place) => void
  onAdvance: () => void
  busy: boolean
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
      <div className="mx-auto w-full max-w-2xl p-4">
        <Empty className="mascot-panel rounded-3xl border px-6 py-8">
          <EmptyHeader>
            <GullPose pose="map" className="mx-auto mb-2 w-44" decorative />
            <EmptyTitle>달린 다음의 여행도, 함께해요</EmptyTitle>
            <EmptyDescription>
              완주 후 에이전트가 지금 컨디션과 귀가 시간에 맞춰 코스를 만들어
              드려요.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )

  const course = courseById(config, it.course)
  const hub = hubOf(config, state.plan)
  const map = mapUrl(config, it.course)
  const place = (id: string) => config.places.find((p) => p.id === id)
  const travel = canTravel(it)
  const others = it.alternatives.flatMap((id) => courseById(config, id) ?? [])

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <MascotBanner
        pose={travel ? 'map' : 'think'}
        eyebrow="AFTER THE FINISH LINE"
        title={
          <>
            {state.plan.nickname || '러너'}님의
            <br />
            구룡포 여행
          </>
        }
        description="완주의 여운은 길게, 돌아가는 길은 여유롭게."
      />
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
                          <span className="text-xs text-primary">
                            {p.attrs.subtitle}
                          </span>
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

      {photoPrompt}
      {stage === 'JOURNEY' && travel && state.plan.stage !== 'DONE' && (
        <Button disabled={busy} onClick={onAdvance}>
          {state.plan.stage === 'OUTBOUND'
            ? `${course?.area ?? '코스'}에 도착했어요`
            : state.plan.stage === 'RETURN'
              ? `${hub.name}에 도착했어요`
              : it.stops[0]
                ? `${place(it.stops[0].id)?.attrs.short ?? '이곳'} 다 봤어요`
                : '돌아가기 시작'}
        </Button>
      )}
      {stage === 'PLANNING' && travel && (
        <Button disabled={busy} onClick={() => ask('이 코스로 갈게요')}>
          이 코스로 출발하기
        </Button>
      )}
      {visitedPlaces(config, state).length > 0 &&
        state.plan.condition !== 'UNWELL' && (
          <Card size="sm">
            <CardHeader>
              <CardTitle>다녀온 곳에 사진 남기기</CardTitle>
              <CardDescription>
                방문을 확인한 장소마다 한 장씩 공유할 수 있어요.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {visitedPlaces(config, state).map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant="outline"
                  onClick={() => onPhoto(p)}
                >
                  <Camera />
                  {p.attrs.short}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}
      <ConditionsCard config={config} view={view} />
      <TransportCard
        config={config}
        view={view}
        select={selectTransport}
        disabled={busy}
      />

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
            <ItineraryTimeline
              config={config}
              itinerary={it}
              select={selectLegTransport}
              disabled={busy}
            />
            {it.planningArrival !== null && (
              <p className="mt-4 text-sm font-medium text-primary">
                {clock(it.planningArrival)} {hub.name} 도착 예정 · 시연 추정
              </p>
            )}
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-2">
            <p className="text-xs text-muted-foreground">
              근거:{' '}
              {readingLine(state.observations, 'congestion', '교통 혼잡', '%')}
              {it.trafficReserve > 0 &&
                ` · 구간 여유 합계 +${it.trafficReserve}분`}
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
      <AssetCredits />
    </div>
  )
}
