import { Camera, MapPin, RefreshCw } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
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
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { canTravel } from '#/core/planner'
import { courseById, hubOf } from '#/core/route'
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
import { useI18n } from '#/i18n/react'
import { Section } from './section'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

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
  onRace,
  onTravel,
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
  /** Empty state: go run first, or (after the race) ask the agent for a course. */
  onRace: () => void
  onTravel: () => void
  busy: boolean
}) => {
  const { t, d } = useI18n()
  const { state, itinerary: it, stage } = view
  const planned = ['PLANNING', 'JOURNEY', 'DONE'].includes(stage)
  const finished = state.phase >= 3
  useEffect(() => {
    if (active && planned) refresh()
  }, [active, planned])
  if (!planned || it.decision === 'INCOMPLETE')
    return (
      <div className="mx-auto w-full max-w-2xl p-4">
        <Empty className="mascot-panel rounded-3xl border px-6 py-8">
          <EmptyHeader>
            <GullPose pose="map" className="mx-auto mb-2 w-36" decorative />
            <EmptyTitle>
              {finished ? t('tour.emptyTitle') : t('tour.noRaceTitle')}
            </EmptyTitle>
            <EmptyDescription>{t('tour.emptyBody')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {finished ? (
              <Button className="h-11 rounded-full px-6" onClick={onTravel}>
                {t('home.ctaPlan')}
              </Button>
            ) : (
              <Button className="h-11 rounded-full px-6" onClick={onRace}>
                {t('home.ctaRace')}
              </Button>
            )}
          </EmptyContent>
        </Empty>
      </div>
    )
  const course = courseById(config, it.course),
    hub = hubOf(config, state.plan)
  const hubName = d(`hub.${hub.id}`, hub.name)
  const area = course && d(`area.${course.id}`, course.area)
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
            {t('tour.tripOf', {
              name: state.plan.nickname || t('common.runner'),
            })}
          </p>
          <h1 className="brand-heading mt-1 text-2xl">
            {course
              ? d(`course.${course.id}`, course.title)
              : t('tour.todaysJourney')}
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            {state.plan.departTime} {d(`noun.${hub.mode.id}`, hub.mode.noun)} ·{' '}
            {stage === 'DONE'
              ? t('tour.badge.done')
              : travel
                ? t('tour.badge.recommended')
                : t('tour.badge.homeFirst')}
          </p>
        </div>
      </div>
      {it.needsReview && (
        <p className="text-sm text-muted-foreground">{t('tour.needsReview')}</p>
      )}
      {(it.needsReview ||
        it.validationErrors?.length ||
        it.planningSource !== 'OPENAI') &&
        stage !== 'DONE' && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            disabled={busy}
            onClick={() =>
              ask('최신 관측과 내 조건에 맞춰 일정을 다시 제안해 줘')
            }
          >
            <RefreshCw />
            {t('tour.requestCustom')}
          </Button>
        )}
      <Card className="border-primary/25">
        <CardHeader>
          <CardDescription>{t('tour.nowTodo')}</CardDescription>
          <CardTitle>
            {current?.attrs.short ??
              (stage === 'DONE'
                ? t('tour.todo.photo')
                : state.plan.stage === 'RETURN'
                  ? t('tour.todo.return', { hub: hubName })
                  : state.plan.stage === 'OUTBOUND'
                    ? t('tour.todo.outbound', {
                        area: area ?? t('tour.spot'),
                      })
                    : t('tour.todo.pick'))}
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
              {t('tour.uploadPhotoHere')}
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
                ? t('tour.arrivedAt', { place: area ?? t('tour.course') })
                : state.plan.stage === 'RETURN'
                  ? t('tour.arrivedAt', { place: hubName })
                  : current
                    ? t('tour.doneWith', { place: current.attrs.short })
                    : t('tour.startReturn')}
            </Button>
          )}
          {stage === 'PLANNING' && travel && (
            <Button
              className="h-12 w-full"
              disabled={busy}
              onClick={() => ask('이 코스로 갈게요')}
            >
              {t('tour.startCourse')}
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
      <Section
        title={t('tour.schedule')}
        description={
          <span className="tabular-nums">
            {t('tour.arrivalTarget', {
              hub: hubName,
              time: clock(it.stationTarget),
            })}
            {it.slack !== null && ` · ${t('tour.slack', { min: it.slack })}`}
          </span>
        }
      >
        <div>
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
              {t('tour.planningArrival', {
                time: clock(it.planningArrival),
                hub: hubName,
              })}
            </p>
          )}
          {stage !== 'DONE' && (
            <Accordion
              type="single"
              collapsible
              className="mt-4 text-xs text-muted-foreground"
            >
              <AccordionItem value="transport">
                <AccordionTrigger className="py-2 text-xs font-normal">
                  {t('tour.transportDefaults')}
                </AccordionTrigger>
                <AccordionContent>
                  <TransportCard
                    config={config}
                    view={view}
                    select={selectTransport}
                    disabled={busy}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      </Section>
      <Section>
        <CourseCandidates key={it.course} config={config} course={it.course} />
      </Section>
      {others.length > 0 && stage === 'PLANNING' && (
        <Section>
          <Accordion type="single" collapsible>
            <AccordionItem value="others">
              <AccordionTrigger className="py-3 font-normal">
                {t('tour.otherCourses')}
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-2">
                  {others.map((c) => (
                    <Button
                      key={c.id}
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => ask(`${c.area} 코스로 보여줘`)}
                    >
                      {d(`course.${c.id}`, c.title)}
                    </Button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Section>
      )}
      <Section>
        <ConditionsCard config={config} view={view} />
      </Section>
      <AssetCredits />
    </div>
  )
}
