import { Camera, ChevronDown, MapPin } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { canTravel } from '#/core/planner'
import { courseById, departLabel, hubOf } from '#/core/route'
import type { TravelMode } from '#/core/mobility'
import type { Place, TripConfig } from '#/core/schema'
import { photoEligiblePlaces } from '#/core/community'
import { clock } from '#/core/time'
import type { TripView } from '#/core/view'
import { ConditionsCard, TransportCard } from './conditions'
import { AssetCredits, GullPose } from '#/brand/brand'
import { PlaceThumb } from './thumb'
import { ItineraryTimeline } from './timeline'
import { CourseCandidates } from './candidates'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

export const TourTab = ({
  config,
  view,
  active,
  refresh,
  ask,
  selectTransport,
  selectLegTransport,
  onPhoto,
  onAdvance,
  busy,
}: {
  config: TripConfig
  view: TripView
  active: boolean
  refresh: () => void
  ask: (text: string) => void
  selectTransport: (mode: 'AUTO' | 'TAXI' | 'TRANSIT') => Promise<void>
  selectLegTransport: (id: string, mode: TravelMode | 'AUTO') => Promise<void>
  photoPrompt?: ReactNode
  onPhoto: (place: Place) => void
  onAdvance: () => void
  busy: boolean
}) => {
  const { state, itinerary: it, stage } = view
  const planned = ['PLANNING', 'JOURNEY', 'DONE'].includes(stage)
  useEffect(() => {
    if (active && planned) refresh()
  }, [active, planned])
  if (!planned || it.decision === 'INCOMPLETE')
    return (
      <div className="mx-auto w-full max-w-2xl p-4">
        <Empty className="mascot-panel rounded-3xl border px-6 py-8">
          <EmptyHeader>
            <GullPose pose="map" className="mx-auto mb-2 w-36" decorative />
            <EmptyTitle>달린 다음의 여행도, 함께해요</EmptyTitle>
            <EmptyDescription>
              완주 후 에이전트가 지금 컨디션과 귀가 시간에 맞춰 코스를 만들어
              드려요.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  const course = courseById(config, it.course),
    hub = hubOf(config, state.plan)
  const travel = canTravel(it)
  const current =
    state.plan.stage === 'LOCAL'
      ? config.places.find((p) => p.id === it.stops[0]?.id)
      : undefined
  const photos = photoEligiblePlaces(config, state)
  const others = it.alternatives.flatMap((id) => courseById(config, id) ?? [])
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-3 py-1">
        <div className="min-w-0">
          <p className="text-xs font-medium text-primary">
            {state.plan.nickname || '러너'}님의 완주 후 여행
          </p>
          <h1 className="brand-heading mt-1 text-2xl">
            {course?.title ?? '오늘의 여정'}
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            {departLabel(config, state.plan)}
          </p>
        </div>
        <Badge variant="secondary" className="mt-1 shrink-0">
          {stage === 'DONE' ? '여행 완료' : travel ? '추천 코스' : '귀가 우선'}
        </Badge>
      </div>
      <div className="rounded-2xl border bg-muted/30 p-3 text-sm">
        <p>
          {it.planningSource === 'OPENAI'
            ? 'AI가 내 조건과 관측을 살펴 구성한 일정이에요.'
            : '시연용 기본 일정이에요. 에이전트에게 맞춤 일정을 요청할 수 있어요.'}
        </p>
        {it.needsReview && (
          <p className="mt-1 text-muted-foreground">
            관측이나 여행 조건이 바뀌었어요. 이전 일정을 유지하고 있으니 다시
            검토해 주세요.
          </p>
        )}
        {(it.needsReview ||
          it.validationErrors?.length ||
          it.planningSource !== 'OPENAI') &&
          stage !== 'DONE' && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={busy}
              onClick={() =>
                ask('최신 관측과 내 조건에 맞춰 일정을 다시 제안해 줘')
              }
            >
              {it.planningSource === 'OPENAI'
                ? '일정 다시 검토하기'
                : '맞춤 일정 요청하기'}
            </Button>
          )}
      </div>
      <Card className="border-primary/25">
        <CardHeader>
          <CardDescription>지금 할 일</CardDescription>
          <CardTitle>
            {current?.attrs.short ??
              (stage === 'DONE'
                ? '오늘의 여행을 사진으로 남겨요'
                : state.plan.stage === 'RETURN'
                  ? `${hub.name}으로 돌아가요`
                  : state.plan.stage === 'OUTBOUND'
                    ? `${course?.area ?? '관광지'}로 이동해요`
                    : '마음에 드는 코스로 출발해요')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {current && (
            <div className="flex items-center gap-3">
              <PlaceThumb place={current} className="size-20 shrink-0" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                {current.attrs.desc}
              </p>
            </div>
          )}
          {current && photos.some((p) => p.id === current.id) && (
            <Button
              className="h-12 w-full"
              disabled={busy}
              onClick={() => onPhoto(current)}
            >
              <Camera />
              이곳에서 찍은 사진 올리기
            </Button>
          )}
          {stage === 'JOURNEY' && travel && state.plan.stage !== 'DONE' && (
            <Button
              variant={current ? 'outline' : 'default'}
              className="min-h-11 w-full whitespace-normal"
              disabled={busy}
              onClick={onAdvance}
            >
              {state.plan.stage === 'OUTBOUND'
                ? `${course?.area ?? '코스'}에 도착했어요`
                : state.plan.stage === 'RETURN'
                  ? `${hub.name}에 도착했어요`
                  : current
                    ? `${current.attrs.short} 다 봤어요`
                    : '돌아가기 시작'}
            </Button>
          )}
          {stage === 'PLANNING' && travel && (
            <Button
              className="h-12 w-full"
              disabled={busy}
              onClick={() => ask('이 코스로 갈게요')}
            >
              이 코스로 출발하기
            </Button>
          )}
          {photos.filter((p) => p.id !== current?.id).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photos
                .filter((p) => p.id !== current?.id)
                .map((p) => (
                  <Button
                    key={p.id}
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => onPhoto(p)}
                  >
                    <Camera />
                    {p.attrs.short}
                  </Button>
                ))}
            </div>
          )}
          {!travel && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {it.reasons.join(' ')}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>오늘의 일정표</CardTitle>
          <CardDescription className="leading-relaxed tabular-nums">
            {hub.name} 도착 목표 {clock(it.stationTarget)}
            {it.slack !== null && ` · 여유 ${it.slack}분`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ItineraryTimeline
            config={config}
            itinerary={it}
            state={state}
            select={selectLegTransport}
            disabled={busy}
            onPhoto={onPhoto}
            photoIds={photos.map((p) => p.id)}
          />
          {it.planningArrival !== null && (
            <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="size-3.5" />
              {clock(it.planningArrival)} {hub.name} 도착 예정 · 시연 추정
            </p>
          )}
          {stage !== 'DONE' && (
            <Collapsible className="mt-4 text-xs text-muted-foreground">
              <CollapsibleTrigger className="cursor-pointer py-2 w-full text-left">
                이동수단 기본 설정
              </CollapsibleTrigger>
              <CollapsibleContent>
                <TransportCard
                  config={config}
                  view={view}
                  select={selectTransport}
                  disabled={busy}
                />
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <CourseCandidates
            key={it.course}
            config={config}
            course={it.course}
          />
        </CardContent>
      </Card>
      {others.length > 0 && stage === 'PLANNING' && (
        <Collapsible className="group rounded-xl border bg-card px-4 py-3">
          <CollapsibleTrigger className="flex cursor-pointer items-center justify-between text-sm w-full text-left">
            다른 코스 보기
            <ChevronDown className="size-4 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 flex flex-wrap gap-2">
              {others.map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => ask(`${c.area} 코스로 보여줘`)}
                >
                  {c.title}
                </Button>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
      <ConditionsCard config={config} view={view} />
      <AssetCredits />
    </div>
  )
}
