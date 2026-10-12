import { AssetCredits, PhotoHero } from '#/brand/brand'
import { Button } from '@/components/ui/button'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel'
import { planner } from '#/core/planner'
import { courseById, hubOf } from '#/core/route'
import type { TripConfig } from '#/core/schema'
import { AUTO_COURSE } from '#/core/schema'
import { clock } from '#/core/time'
import type { TripView } from '#/core/view'
import { durationText } from '#/i18n'
import { useI18n } from '#/i18n/react'
import { RaceDetails, RaceHeadline } from '#/race/overview'
import { PlaceThumb } from './thumb'
import { Section } from './section'

// Editing lives in the menu (⋯ → 일정 수정).
const MyPlan = ({ config, view }: { config: TripConfig; view: TripView }) => {
  const { t, d } = useI18n()
  const { plan } = view.state
  const hub = hubOf(config, plan)
  const course =
    plan.course === AUTO_COURSE ? null : courseById(config, plan.course)
  return (
    <Section
      title={t('home.myPlan')}
      description={
        <span className="tabular-nums">
          {plan.departTime} {d(`noun.${hub.mode.id}`, hub.mode.noun)} ·{' '}
          {t('home.arrivalTarget', {
            hub: d(`hub.${hub.id}`, hub.name),
            time: clock(view.itinerary.stationTarget),
          })}
        </span>
      }
    >
      <p className="text-sm">
        {t('home.wantToGo', {
          course: course
            ? d(`course.${course.id}`, course.title)
            : t('home.recommend'),
        })}
      </p>
    </Section>
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
  const { t, d, locale } = useI18n()
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
  const hub = hubOf(config, state.plan)
  return (
    <Section
      title={t('home.preview')}
      description={d(`course.${course.id}`, course.title)}
    >
      {places.length > 0 && (
        <div className="flex flex-col gap-3">
          {/* The next photo peeks in, so it reads as swipeable. */}
          <Carousel opts={{ align: 'start' }}>
            <CarouselContent>
              {places.map((p) => (
                <CarouselItem key={p.id} className="basis-4/5 sm:basis-1/2">
                  <div className="flex flex-col gap-1.5">
                    <PlaceThumb place={p} />
                    <span className="text-sm">{p.attrs.short}</span>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          <p className="text-sm text-muted-foreground tabular-nums">
            {t('home.total', {
              duration: durationText(
                locale,
                it.outbound + it.localMin + it.returnMin,
              ),
            })}
            {it.planningArrival !== null &&
              ` · ${t('home.arrive', {
                hub: d(`hub.${hub.id}`, hub.name),
                time: clock(it.planningArrival),
              })}`}
          </p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t('home.recalc')}</p>
    </Section>
  )
}

const pill = 'h-12 rounded-full px-6 text-base'
const pillGhost = `${pill} border-white/60 bg-transparent text-white hover:bg-white/10 hover:text-white`

export const HomeTab = ({
  config,
  view,
  racing = false,
  onRace,
  onPlan,
}: {
  config: TripConfig
  view: TripView
  /** The race clock is running or paused. */
  racing?: boolean
  onRace: () => void
  onPlan: () => void
}) => {
  const { t } = useI18n()
  const raceLabel =
    view.state.phase >= 3 ? t('home.viewRecord') : t('home.ctaRace')
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <PhotoHero
        image={config.event.image || '/images/yeongildae-pier-wide.jpg'}
        portrait="/images/yeongildae-pier-portrait.jpg"
        title={
          <>
            {t('home.heroTitle1')}
            <br />
            {t('home.heroTitle2')}
          </>
        }
        description={t('home.heroBody', {
          name: view.state.plan.nickname || t('common.runner'),
        })}
        actions={
          // Mid-race the race comes first; otherwise planning the trip does.
          racing ? (
            <>
              <Button className={pill} onClick={onRace}>
                {raceLabel}
              </Button>
              <Button variant="outline" className={pillGhost} onClick={onPlan}>
                {t('home.ctaPlan')}
              </Button>
            </>
          ) : (
            <>
              <Button className={pill} onClick={onPlan}>
                {t('home.ctaPlan')}
              </Button>
              <Button variant="outline" className={pillGhost} onClick={onRace}>
                {raceLabel}
              </Button>
            </>
          )
        }
      />
      <RaceHeadline event={config.event} finished={view.state.phase >= 3} />
      <MyPlan config={config} view={view} />
      <AfterRace config={config} view={view} />
      <RaceDetails event={config.event} />
      <AssetCredits />
    </div>
  )
}
