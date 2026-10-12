import { Bus, CarTaxiFront, Check, Footprints, Camera } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { directionsUrl, pointOf } from '#/core/links'
import type { Itinerary } from '#/core/planner'
import type { Place, TripConfig } from '#/core/schema'
import type { TripState } from '#/core/trip'
import { clock } from '#/core/time'
import { KAKAO_T_URL } from '#/core/transport'
import type { TravelMode } from '#/core/mobility'
import { PlaceThumb } from './thumb'
import { venueMapUrl } from '#/core/venues'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useI18n } from '#/i18n/react'

type Status = 'done' | 'now' | 'next'

export function ItineraryTimeline({
  config,
  itinerary: it,
  state,
  select,
  disabled = false,
  onPhoto,
  photoIds = [],
}: {
  config: TripConfig
  itinerary: Itinerary
  state?: TripState
  select?: (id: string, mode: TravelMode | 'AUTO') => Promise<void>
  disabled?: boolean
  onPhoto?: (place: Place) => void
  photoIds?: string[]
}) {
  const { t } = useI18n()
  const modeName = (mode: TravelMode) => t(`tour.mode.${mode}`)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const change = async (id: string, mode: TravelMode | 'AUTO') => {
    if (!select || pending) return
    setPending(true)
    setError('')
    try {
      await select(id, mode)
    } catch {
      setError(t('tour.saveModeFailed'))
    } finally {
      setPending(false)
    }
  }
  const completed =
    state?.plan.completed.map((id) => ({
      id,
      record: state.visits?.find((v) => v.placeId === id),
    })) ?? []
  const stopRow = (id: string, time: string, status: Status) => {
    const p = config.places.find((p) => p.id === id)
    return (
      <li
        key={`stop-${id}`}
        className={`rounded-xl border p-3 ${status === 'done' ? 'border-secondary bg-secondary/40' : 'border-primary/25 bg-secondary/60'}`}
      >
        <div className="flex gap-3">
          {p && <PlaceThumb place={p} className="size-16 shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-xs font-semibold text-primary">
              {status === 'done' && <Check className="size-3" />}
              {t(`tour.status.${status}`)}
              <span className="ml-1 font-normal tabular-nums">{time}</span>
            </p>
            <p className="mt-1 font-semibold leading-snug">
              {p?.attrs.short ?? id}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {p?.attrs.subtitle}
            </p>
            {status !== 'done' &&
              p?.attrs.candidates?.some((v) => v.kind !== 'sight') && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {p.attrs.candidates.slice(0, 2).map((v) => (
                    <a
                      key={v.id}
                      href={venueMapUrl(v)}
                      target="_blank"
                      rel="noreferrer"
                      className="py-1 text-primary underline underline-offset-2"
                    >
                      {v.name}
                      {v.detour ? ` · ${t('tour.detour')}` : ''}
                    </a>
                  ))}
                </div>
              )}
            {p && onPhoto && photoIds.includes(id) && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 px-0 text-primary"
                disabled={disabled}
                onClick={() => onPhoto(p)}
              >
                <Camera />
                {t('tour.leavePhoto')}
              </Button>
            )}
          </div>
        </div>
      </li>
    )
  }
  const rows = [
    ...(it.legs ?? [])
      .filter((l) => l.mode && Array.isArray(l.options))
      .map((leg) => ({ at: leg.start, key: leg.id, leg, stop: null })),
    ...it.stops
      .filter((s) => !completed.some((c) => c.id === s.id))
      .map((stop) => ({ at: stop.start, key: stop.id, stop, leg: null })),
  ].sort((a, b) => a.at - b.at || (a.leg ? -1 : 1))
  const point = pointOf(config, it.course)
  return (
    <ol aria-label={t('tour.timelineLabel')} className="flex flex-col gap-3">
      {completed.map(({ id, record }) =>
        stopRow(
          id,
          record
            ? `${clock(record.start)}–${clock(record.end)}`
            : t('tour.noTimeRecord'),
          'done',
        ),
      )}
      {rows.map(({ key, leg, stop }) => {
        if (stop)
          return stopRow(
            stop.id,
            t('tour.stopTime', {
              start: clock(stop.start),
              end: clock(stop.end),
              min: stop.dwell,
            }),
            state?.plan.stage === 'LOCAL' && stop.id === it.stops[0]?.id
              ? 'now'
              : 'next',
          )
        if (!leg) return null
        const Icon =
          leg.mode === 'TRANSIT'
            ? Bus
            : leg.mode === 'TAXI'
              ? CarTaxiFront
              : Footprints
        const from = point(leg.from),
          to = point(leg.to)
        const url =
          from && to
            ? directionsUrl(
                from,
                to,
                leg.mode === 'WALK'
                  ? 'walk'
                  : leg.mode === 'TAXI'
                    ? 'car'
                    : 'traffic',
              )
            : null
        return (
          <li
            key={key}
            className="mx-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground"
          >
            <Accordion type="single" collapsible>
              <AccordionItem value="leg">
                <AccordionTrigger className="items-center gap-2 py-1 text-xs font-normal">
                  <Icon className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 leading-relaxed">
                    {leg.label}
                    <span className="ml-1.5 whitespace-nowrap">
                      ·{' '}
                      {t('tour.modeAbout', {
                        mode: modeName(leg.mode),
                        min: leg.totalMin,
                      })}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-xs">
                  <div className="mt-2 space-y-3 border-t pt-3 leading-relaxed">
                    <p>
                      {t('tour.legTime', {
                        start: clock(leg.start),
                        end: clock(leg.end),
                      })}
                    </p>
                    <p>
                      {[
                        leg.rideMin > 0 && t('tour.ride', { min: leg.rideMin }),
                        leg.waitMin > 0 && t('tour.wait', { min: leg.waitMin }),
                        t('tour.walk', { min: leg.walkMin }),
                        leg.bufferMin > 0 &&
                          t('tour.buffer', { min: leg.bufferMin }),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <p>{leg.reason}</p>
                    <p>{t('tour.legBasis', { basis: leg.basis })}</p>
                    {select && leg.options.length > 1 && (
                      <div className="flex flex-wrap gap-2">
                        {leg.options.map((o) => (
                          <Button
                            key={o.mode}
                            size="sm"
                            variant={
                              o.mode === leg.mode ? 'default' : 'outline'
                            }
                            disabled={pending || disabled}
                            onClick={() => void change(leg.id, o.mode)}
                          >
                            {t('tour.modeAbout', {
                              mode: modeName(o.mode),
                              min: o.totalMin,
                            })}
                          </Button>
                        ))}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending || disabled}
                          onClick={() => void change(leg.id, 'AUTO')}
                        >
                          {t('tour.autoPick')}
                        </Button>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3">
                      {url && (
                        <a
                          className="underline"
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t('tour.legOnMap')}
                        </a>
                      )}
                      {leg.mode === 'TAXI' && (
                        <a
                          className="underline"
                          href={KAKAO_T_URL}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t('tour.kakaoT')}
                        </a>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </li>
        )
      })}
      {error && (
        <li role="alert" className="text-sm text-destructive">
          {error}
        </li>
      )}
    </ol>
  )
}
