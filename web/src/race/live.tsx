import { Flag, Pause, Play, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GullPose } from '#/brand/brand'
import { useRace } from './use-race'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { pace, raceClock, snapshot, timeAt } from '#/core/race'
import { bib, category, race } from './mock'
import { RaceRouteMap } from './route-map'
import { chipOn } from '#/app/bits'
import { useI18n } from '#/i18n/react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const Stat = ({
  label,
  value,
  prominent = false,
}: {
  label: string
  value: string
  prominent?: boolean
}) => (
  <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-muted/50 p-3">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span
      className={`${prominent ? 'text-2xl sm:text-3xl' : 'text-lg'} font-bold tabular-nums text-foreground`}
    >
      {value}
    </span>
  </div>
)

/** Personal route + metrics; all data is explicitly simulated, trip-scoped. */
export const RaceLive = ({
  finished = false,
  tripId,
  onFinish,
}: {
  finished?: boolean
  tripId: string
  onFinish: () => void
}) => {
  const { session, elapsed, act } = useRace(tripId, finished)
  const { t } = useI18n()
  const s = snapshot(
    race,
    finished ? timeAt(race.paces, race.distance) : elapsed,
  )
  const ready = session.status === 'READY' && !finished
  const paused = session.status === 'PAUSED' && !finished
  const complete = () => {
    act('FINISH')
    onFinish()
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <h1 className="brand-heading text-2xl">
        {ready
          ? t('race.live.ready')
          : s.finished
            ? t('race.live.finished')
            : t('race.live.running')}
      </h1>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t('race.live.notice')}
      </p>
      {ready ? (
        <Card className="overflow-visible border-primary/15">
          <CardHeader className="text-center">
            <CardDescription>
              {t('race.bib', { category, bib })}
            </CardDescription>
            <CardTitle className="text-2xl">{t('race.live.title')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <GullPose className="w-44 sm:w-48" />
            <div className="grid w-full grid-cols-2 gap-2 text-center">
              <Stat label={t('race.live.distance')} value="0.00 km" prominent />
              <Stat label={t('race.live.elapsed')} value="0:00" prominent />
            </div>
            <Button
              size="lg"
              className="min-h-12 w-full"
              onClick={() => act('START')}
            >
              <Play />
              {t('race.live.start')}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {t('race.live.startHint')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="gap-3 overflow-hidden border-primary/20">
            <CardHeader>
              <CardDescription>
                {t('race.bib', { category, bib })} ·{' '}
                {s.finished
                  ? t('race.live.status.finished')
                  : paused
                    ? t('race.live.status.paused')
                    : t('race.live.status.running')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label={t('race.live.distance')}
                  value={`${s.distance.toFixed(2)} km`}
                  prominent
                />
                <Stat
                  label={
                    s.finished ? t('race.live.record') : t('race.live.elapsed')
                  }
                  value={raceClock(s.elapsed)}
                  prominent
                />
                <Stat
                  label={t('race.live.avgPace')}
                  value={s.avgPace === null ? '—' : `${pace(s.avgPace)}/km`}
                />
                <Stat
                  label={
                    s.finished
                      ? t('race.live.finishTime')
                      : t('race.live.projected')
                  }
                  value={s.projected === null ? '—' : raceClock(s.projected)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {s.finished
                  ? t('race.live.doneNote')
                  : t('race.live.projectedNote')}
              </p>
              <RaceRouteMap progress={s.distance / race.distance} />
              {!s.finished && (
                <Button
                  variant="outline"
                  className="min-h-11 w-full"
                  onClick={() => act(paused ? 'RESUME' : 'PAUSE')}
                >
                  {paused ? <Play /> : <Pause />}
                  {paused ? t('race.live.resume') : t('race.live.pause')}
                </Button>
              )}
            </CardContent>
          </Card>
          {!s.finished && (
            <Accordion
              type="single"
              collapsible
              className="rounded-xl border bg-muted/30 px-4"
            >
              <AccordionItem value="controls">
                <AccordionTrigger className="py-3">
                  {t('race.live.controls')}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-3 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">
                        {t('race.live.speed')}
                      </span>
                      <ToggleGroup
                        type="single"
                        size="sm"
                        variant="outline"
                        value={String(session.speed)}
                        onValueChange={(v) => {
                          if (v) act(v === '60' ? 60 : 1)
                        }}
                        aria-label={t('race.live.speedLabel')}
                      >
                        <ToggleGroupItem className={chipOn} value="1">
                          1×
                        </ToggleGroupItem>
                        <ToggleGroupItem className={chipOn} value="60">
                          60×
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => act('FINAL_KM')}
                      disabled={s.distance >= 9}
                    >
                      <SkipForward />
                      {t('race.live.finalKm')}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
          {s.finished && (
            <div className="mascot-panel mascot-message gap-3 rounded-2xl border border-primary/10 px-4 py-3">
              <GullPose pose="cheer" className="w-full" decorative />
              <div className="min-w-0">
                <p className="font-bold">{t('race.live.congrats')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('race.live.congratsBody')}
                </p>
              </div>
            </div>
          )}
          <Button
            size="lg"
            className="min-h-12 w-full whitespace-normal text-center"
            onClick={complete}
          >
            <Flag />
            {finished ? t('race.live.share') : t('race.live.finish')}
          </Button>
          {!s.finished && (
            <p className="-mt-2 text-center text-xs text-muted-foreground">
              {t('race.live.finishHint')}
            </p>
          )}
        </>
      )}
    </div>
  )
}
