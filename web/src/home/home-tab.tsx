import { AssetCredits, MascotBanner } from '#/brand/brand'
import { Pencil, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { InstallApp } from './install'
import { Section } from './section'

const MyPlan = ({
  config,
  view,
  onEdit,
}: {
  config: TripConfig
  view: TripView
  onEdit: () => void
}) => {
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
      action={
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Pencil />
          {t('home.edit')}
        </Button>
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
      eyebrow={`${t('home.afterRace')} · ${t('home.preview')}`}
      title={d(`course.${course.id}`, course.title)}
    >
      {places.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            {places.slice(0, 3).map((p) => (
              <div key={p.id} className="flex flex-col gap-1">
                <PlaceThumb place={p} />
                <span className="text-xs leading-relaxed">{p.attrs.short}</span>
              </div>
            ))}
          </div>
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

export const HomeTab = ({
  config,
  view,
  onEditProfile,
  onRace,
}: {
  config: TripConfig
  view: TripView
  onEditProfile: () => void
  onRace: () => void
}) => {
  const { t } = useI18n()
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <MascotBanner
        pose={view.state.phase >= 3 ? 'cheer' : 'map'}
        eyebrow="RUN2 GURYONGPO"
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
      />
      <Button size="lg" className="min-h-12" onClick={onRace}>
        {view.state.phase >= 3 ? t('home.viewRecord') : t('home.prepareRace')}
        <ArrowRight />
      </Button>
      <div className="flex justify-end">
        <InstallApp compact />
      </div>
      <RaceHeadline event={config.event} />
      <MyPlan config={config} view={view} onEdit={onEditProfile} />
      <AfterRace config={config} view={view} />
      <RaceDetails event={config.event} />
      <AssetCredits />
    </div>
  )
}
