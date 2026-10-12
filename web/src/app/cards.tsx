import { ArrowUpRight, Coffee, Footprints, TrainFront } from 'lucide-react'
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
import { ItineraryTimeline } from '#/home/timeline'
import { usableReading } from '#/core/signals'
import { courseById, hubOf, modeOf } from '#/core/route'
import type { Plan } from '#/core/schema'
import { clock } from '#/core/time'
import { toggleExcluded, toggleWalking } from '#/core/trip'
import { durationText } from '#/i18n'
import { useI18n } from '#/i18n/react'
import { useApp } from './context'

/** Config names (hub, way home, course, area) in the chosen language. */
export const useNames = () => {
  const { config } = useApp()
  const { d } = useI18n()
  const hub = (plan: Pick<Plan, 'departMode'>) => {
    const h = hubOf(config, plan)
    return d(`hub.${h.id}`, h.name)
  }
  const noun = (plan: Pick<Plan, 'departMode'>) => {
    const m = modeOf(config, plan)
    return d(`noun.${m.id}`, m.noun)
  }
  return {
    hub,
    noun,
    /** "18:30 열차" in the chosen language. */
    depart: (plan: Pick<Plan, 'departMode' | 'departTime'>) =>
      `${plan.departTime} ${noun(plan)}`,
    course: (id: string | null | undefined) => {
      const c = courseById(config, id)
      return c && d(`course.${c.id}`, c.title)
    },
    area: (id: string | null | undefined) => {
      const c = courseById(config, id)
      if (!c) return undefined
      return d(`area.${c.id}`, c.area)
    },
  }
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-xl font-semibold tabular-nums">{value}</span>
  </div>
)

export const TrainCard = () => {
  const { state, itinerary, open } = useApp()
  const { t, locale } = useI18n()
  const names = useNames()
  const slack = itinerary.slack
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t('classic.train.title', { noun: names.noun(state.plan) })}
        </CardTitle>
        <CardDescription>
          {t('classic.train.desc', { hub: names.hub(state.plan) })}
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => open('train')}>
            {t('classic.train.change', { time: state.plan.departTime })}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <Stat
          label={t('classic.target')}
          value={clock(itinerary.stationTarget)}
        />
        <Stat
          label={t('classic.planned')}
          value={
            itinerary.planningArrival !== null
              ? clock(itinerary.planningArrival)
              : t('classic.train.check')
          }
        />
      </CardContent>
      {slack !== null && (
        <CardFooter>
          <Badge variant={slack < 0 ? 'destructive' : 'secondary'}>
            {slack < 0
              ? t('classic.train.late', { n: Math.abs(slack) })
              : t('classic.train.slack', {
                  duration: durationText(locale, slack),
                })}
          </Badge>
        </CardFooter>
      )}
    </Card>
  )
}

export const ObservationCard = () => {
  const { state, open, config } = useApp()
  const { t } = useI18n()
  const obs = state.observations
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('classic.obs.title')}</CardTitle>
        <CardDescription>
          {t('classic.obs.twin')} ·{' '}
          {obs.provenance === 'SIMULATED'
            ? t('classic.obs.simulated')
            : t('classic.obs.live')}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={() => open('evidence')}>
            {t('classic.obs.basis')}
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
              value={v === null ? t('classic.obs.na') : `${v}${unit}`}
            />
          )
        })}
      </CardContent>
    </Card>
  )
}

export const StatsCard = () => {
  const { itinerary } = useApp()
  const { t, locale } = useI18n()
  return (
    <Card>
      <CardContent className="grid grid-cols-3 gap-4">
        <Stat
          label={t('classic.stats.walk')}
          value={t('classic.min', { n: itinerary.walking })}
        />
        <Stat
          label={t('classic.stats.stay')}
          value={durationText(locale, itinerary.localMin)}
        />
        <Stat
          label={t('classic.stats.travel')}
          value={durationText(locale, itinerary.outbound + itinerary.returnMin)}
        />
      </CardContent>
    </Card>
  )
}

export const ItineraryCard = () => {
  const { itinerary: it, config, open, map, state } = useApp()
  const { t } = useI18n()
  const names = useNames()
  const place = (id: string) => config.places.find((p) => p.id === id)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('classic.step.course')}</CardTitle>
        <CardDescription>
          {t('classic.itin.count', {
            n: it.stops.length,
            course: names.course(it.course) ?? '',
          })}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={() => open('taxi')}>
            {t('classic.itin.transport')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ItineraryTimeline config={config} itinerary={it} />
        {it.excluded.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {it.excluded.map((x) => (
              <Badge key={x.id} variant="outline">
                {t('classic.itin.excluded', {
                  place: place(x.id)?.attrs.short ?? x.id,
                  reason: x.reason,
                })}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-2">
        <Button variant="outline" asChild>
          <a href={map('COURSE')} target="_blank" rel="noreferrer">
            {t('classic.itin.route', { name: names.area(it.course) ?? '' })}{' '}
            <ArrowUpRight />
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a
            href={map(hubOf(config, state.plan).id)}
            target="_blank"
            rel="noreferrer"
          >
            {t('classic.itin.route', { name: names.hub(state.plan) })}{' '}
            <ArrowUpRight />
          </a>
        </Button>
      </CardFooter>
    </Card>
  )
}

export const AdjustCard = () => {
  const { state, run, open } = useApp()
  const { t } = useI18n()
  const cafeOut = state.plan.excluded.includes('cafe')
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('classic.adjust.title')}</CardTitle>
        <CardDescription>{t('classic.adjust.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Button
          variant="outline"
          className="justify-start"
          onClick={() => run(toggleWalking(state))}
        >
          <Footprints />
          {state.plan.walkingLimit === 30
            ? t('classic.adjust.walk15')
            : t('classic.adjust.walk30')}
        </Button>
        <Button
          variant="outline"
          className="justify-start"
          onClick={() => run(toggleExcluded(state, 'cafe'))}
        >
          <Coffee />
          {cafeOut ? t('classic.adjust.cafeIn') : t('classic.adjust.cafeOut')}
        </Button>
        <Button
          variant="outline"
          className="justify-start"
          onClick={() => open('train')}
        >
          <TrainFront />
          {t('classic.adjust.depart')}
        </Button>
      </CardContent>
    </Card>
  )
}
