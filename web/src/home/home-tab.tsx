import { Pencil } from 'lucide-react'
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
import { planner } from '#/core/planner'
import { courseById, departLabel, hubOf } from '#/core/route'
import type { TripConfig } from '#/core/schema'
import { AUTO_COURSE } from '#/core/schema'
import { clock, duration } from '#/core/time'
import type { TripView } from '#/core/view'
import { RaceDetails, RaceHeadline } from '#/race/overview'
import { PlaceThumb } from './thumb'

const MyPlan = ({
  config,
  view,
  onEdit,
}: {
  config: TripConfig
  view: TripView
  onEdit: () => void
}) => {
  const { plan } = view.state
  const hub = hubOf(config, plan)
  const course =
    plan.course === AUTO_COURSE ? null : courseById(config, plan.course)
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>내 일정</CardTitle>
        <CardDescription className="tabular-nums">
          {departLabel(config, plan)} · {hub.name} 도착 목표{' '}
          {clock(view.itinerary.stationTarget)}
        </CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil />
            편집
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="text-sm">
        가고 싶은 곳: {course?.title ?? '추천'}
      </CardContent>
    </Card>
  )
}

/**
 * What the day could look like after the race. The real plan waits for the
 * runner's condition; this preview assumes "괜찮아요" and an on-time start.
 */
const AfterRace = ({
  config,
  view,
}: {
  config: TripConfig
  view: TripView
}) => {
  const { state } = view
  const it =
    view.itinerary.stops.length > 0
      ? view.itinerary
      : planner(config)(
          { ...state.plan, condition: 'OK', baggageCollected: true },
          state.observations,
        )
  const course = courseById(config, it.course)
  const places = it.stops.flatMap(
    (s) => config.places.find((p) => p.id === s.id) ?? [],
  )
  if (!course) return null
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>완주 후</CardDescription>
        <CardTitle>{course.title}</CardTitle>
        <CardAction>
          <Badge variant="outline">미리보기</Badge>
        </CardAction>
      </CardHeader>
      {places.length > 0 && (
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            {places.slice(0, 3).map((p) => (
              <div key={p.id} className="flex flex-col gap-1">
                <PlaceThumb place={p} />
                <span className="truncate text-xs">{p.attrs.short}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground tabular-nums">
            이동 포함 약 {duration(it.outbound + it.localMin + it.returnMin)}
            {it.planningArrival !== null &&
              ` · ${hubOf(config, state.plan).name} ${clock(it.planningArrival)} 도착`}
          </p>
        </CardContent>
      )}
      <CardFooter className="text-xs text-muted-foreground">
        완주하면 그때 컨디션에 맞춰 다시 계산해 드려요.
      </CardFooter>
    </Card>
  )
}

export const HomeTab = ({
  config,
  view,
  onEditProfile,
}: {
  config: TripConfig
  view: TripView
  onEditProfile: () => void
}) => (
  <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
    <RaceHeadline event={config.event} />
    <MyPlan config={config} view={view} onEdit={onEditProfile} />
    <AfterRace config={config} view={view} />
    <RaceDetails event={config.event} />
  </div>
)
