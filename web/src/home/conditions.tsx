import { Sparkles, ArrowUpRight, Bus, CarTaxiFront, Copy } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TripConfig } from '#/core/schema'
import type { TripView } from '#/core/view'
import { usableReading } from '#/core/signals'
import { recommendTransport } from '#/core/transport'
import { mapUrl } from '#/core/links'
import { hubOf } from '#/core/route'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { htmlLang } from '#/i18n'
import type { Locale } from '#/i18n'
import { localizeDeep } from '#/i18n/phrases'
import { Rich, useI18n } from '#/i18n/react'

const at = (locale: Locale, unknown: string, iso?: string | null) =>
  iso && Number.isFinite(Date.parse(iso))
    ? new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : htmlLang[locale], {
        timeZone: 'Asia/Seoul',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(iso))
    : unknown

export const ConditionsCard = ({
  config,
  view,
}: {
  config: TripConfig
  view: TripView
}) => {
  const obs = view.state.observations
  const { t, locale } = useI18n()
  const hasDemo = config.sources.some(
    (source) =>
      source.enabled && obs.sources[source.reading]?.provenance === 'DEMO',
  )
  return (
    <Accordion
      type="single"
      collapsible
      className="rounded-xl border bg-card px-4 text-xs text-muted-foreground"
    >
      <AccordionItem value="conditions">
        <AccordionTrigger className="py-3 text-xs font-normal leading-relaxed">
          <span className="flex flex-col">
            <span className="font-semibold text-foreground">
              {hasDemo ? t('race.cond.titleDemo') : t('race.cond.title')}
            </span>
            <span className="mt-1 block">
              {[
                {
                  reading: 'congestion',
                  label: t('race.cond.traffic'),
                  unit: '%',
                },
                { reading: 'pm25', label: t('race.cond.pm25'), unit: 'μg/m³' },
                { reading: 'uvIndex', label: t('race.cond.uv'), unit: '' },
              ]
                .filter((s) =>
                  config.sources.some(
                    (source) => source.enabled && source.reading === s.reading,
                  ),
                )
                .map((source) => {
                  const value = usableReading(obs, source.reading)
                  return `${source.label} ${value == null ? t('race.cond.checking') : `${Math.round(value * 10) / 10}${source.unit}`}`
                })
                .join(' · ')}
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="text-xs">
          <div className="space-y-3 border-t pt-3 leading-relaxed">
            <p>{[...new Set(view.itinerary.reasons)].join(' ')}</p>
            {config.sources
              .filter((s) => s.enabled)
              .map((source) => {
                const src = obs.sources[source.reading]
                const scoped =
                  view.itinerary.course === 'guryongpo' ||
                  (source.reading === 'congestion' &&
                    view.itinerary.legs.some((leg) => leg.trafficScope))
                const applies =
                  scoped &&
                  view.itinerary.calculationStatus !== 'NOT_RUN' &&
                  usableReading(obs, source.reading) !== null &&
                  (src?.eligible === true || src?.provenance === 'DEMO')
                return (
                  <div key={source.id} className="space-y-1">
                    <p className="font-medium text-foreground">
                      {source.label}
                    </p>
                    <p>
                      {src?.value ??
                        obs.readings[source.reading] ??
                        t('race.cond.checking')}{' '}
                      {source.unit}
                    </p>
                    <p>
                      {src?.provenance === 'DEMO'
                        ? t('race.cond.prov.DEMO')
                        : src?.provenance === 'LIVE'
                          ? t('race.cond.prov.LIVE')
                          : src?.provenance === 'SNAPSHOT'
                            ? t('race.cond.prov.SNAPSHOT')
                            : t('race.cond.unknown')}{' '}
                      ·{' '}
                      {src?.freshness === 'STALE'
                        ? `${t('race.cond.stale')} · `
                        : ''}
                      {applies && view.itinerary.needsReview
                        ? t('race.cond.review')
                        : applies
                          ? t('race.cond.applied')
                          : t('race.cond.notApplied')}
                    </p>
                    <p>
                      {t('race.cond.times', {
                        observed: at(
                          locale,
                          t('race.cond.unknown'),
                          src?.observedAt,
                        ),
                        fetched: at(
                          locale,
                          t('race.cond.unknown'),
                          src?.fetchedAt,
                        ),
                      })}
                    </p>
                    <p>{src?.note}</p>
                    <a
                      href={String(source.meta.docs)}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {t('race.cond.docs')}
                    </a>
                  </div>
                )
              })}
            <p>{t('race.cond.scope')}</p>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

export const TransportCard = ({
  config,
  view,
  select,
  disabled = false,
}: {
  config: TripConfig
  view: TripView
  disabled?: boolean
  select: (mode: 'AUTO' | 'TAXI' | 'TRANSIT') => Promise<void>
}) => {
  const { t, locale } = useI18n()
  const rec = localizeDeep(
    recommendTransport(
      view.state.plan,
      view.state.observations,
      view.itinerary,
    ),
    locale,
  )
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const selected = view.state.plan.localTransport ?? 'AUTO'
  const hub = hubOf(config, view.state.plan)
  const choose = async (mode: 'AUTO' | 'TAXI' | 'TRANSIT') => {
    setPending(true)
    setMessage('')
    try {
      await select(mode)
    } catch {
      setMessage(t('race.cond.saveFailed'))
    } finally {
      setPending(false)
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{rec.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-muted-foreground">
          {rec.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        {rec.mode && (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button
                variant={selected === 'AUTO' ? 'default' : 'outline'}
                disabled={pending || disabled}
                onClick={() => choose('AUTO')}
              >
                <Sparkles />
                {t('race.cond.auto')}
              </Button>
              <Button
                variant={selected === 'TRANSIT' ? 'default' : 'outline'}
                disabled={pending || disabled}
                onClick={() => choose('TRANSIT')}
              >
                <Bus />
                {t('race.cond.transit')}
              </Button>
              <Button
                variant={selected === 'TAXI' ? 'default' : 'outline'}
                disabled={pending || disabled}
                onClick={() => choose('TAXI')}
              >
                <CarTaxiFront />
                {t('race.cond.taxi')}
              </Button>
            </div>
            {selected === 'TAXI' ? (
              <div className="rounded-lg bg-secondary p-3 text-sm">
                <p className="mb-3">{t('race.cond.taxiNote')}</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <a href={rec.url} target="_blank" rel="noreferrer">
                      {t('race.cond.openKakaoT')}
                      <ArrowUpRight />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(hub.name)
                        setMessage(t('race.cond.copied'))
                      } catch {
                        setMessage(
                          t('race.cond.destination', { name: hub.name }),
                        )
                      }
                    }}
                  >
                    <Copy />
                    {t('race.cond.copy')}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  <Rich
                    text={t('race.cond.pcNote', { name: hub.name })}
                    icon={
                      <a
                        href="https://www.kakaomobility.com/service-kakaot/taxi"
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        {t('race.cond.installGuide')}
                      </a>
                    }
                  />
                </p>
              </div>
            ) : (
              selected === 'TRANSIT' && (
                <Button asChild variant="outline">
                  <a
                    href={mapUrl(config, view.itinerary.course)(hub.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('race.cond.mapRoute')}
                    <ArrowUpRight />
                  </a>
                </Button>
              )
            )}
          </>
        )}
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
