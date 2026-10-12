import { ArrowUpRight, ChevronRight, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { KAKAO_T_URL } from '#/core/transport'
import type { Evidence } from '#/core/evidence'
import { hubOf } from '#/core/route'
import { clock } from '#/core/time'
import { changeDepart, runScenario } from '#/core/trip'
import { useI18n } from '#/i18n/react'
import { useApp } from './context'
import type { Sheet } from './context'
import { chipOn } from './bits'
import { useNames } from './cards'

type SheetSpec = {
  title: string
  description: string
  body: ReactNode
  footer?: ReactNode
}

export const Sheets = () => {
  const { sheet, open } = useApp()
  const spec = useSpec(sheet)
  return (
    <Drawer open={sheet !== null} onOpenChange={(o) => !o && open(null)}>
      <DrawerContent className="mx-auto max-h-[90dvh] max-w-xl">
        {spec && (
          <>
            <DrawerHeader>
              <DrawerTitle>{spec.title}</DrawerTitle>
              <DrawerDescription>{spec.description}</DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-4 overflow-y-auto px-4">
              {spec.body}
            </div>
            <DrawerFooter className="pb-safe">{spec.footer}</DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}

/** Sheet id → title, description, body. */
const useSpec = (sheet: Sheet): SheetSpec | null => {
  const { config, state } = useApp()
  const { t } = useI18n()
  const names = useNames()
  if (sheet === 'demo')
    return {
      title: t('classic.demo'),
      description: t('classic.demo.desc'),
      ...demo(),
    }
  if (sheet === 'evidence')
    return {
      title: t('classic.evidence'),
      description: t('classic.evidence.desc'),
      body: <EvidenceBody />,
    }
  if (sheet === 'train')
    return {
      title: t('classic.depart.title'),
      description: t('classic.depart.desc', {
        date: config.event.dateLabel,
        hub: names.hub(state.plan),
      }),
      body: <TrainBody />,
    }
  if (sheet === 'taxi')
    return {
      title: t('classic.taxi.title', { hub: names.hub(state.plan) }),
      description: t('classic.taxi.desc'),
      body: <TaxiBody />,
    }
  if (sheet === 'why')
    return {
      title: t('classic.why.title'),
      description: t('classic.why.desc'),
      body: <WhyBody />,
    }
  if (sheet && typeof sheet === 'object') {
    const place = config.places.find((p) => p.id === sheet.place)
    if (place)
      return {
        title: place.attrs.title,
        description: place.attrs.subtitle,
        body: <PlaceBody id={place.id} />,
      }
  }
  return null
}

const demo = () => ({ body: <DemoBody />, footer: <DemoReset /> })

const DemoBody = () => {
  const { config, state, run, open } = useApp()
  return (
    <ItemGroup>
      {config.scenarios.map((s) => (
        <Item key={s.id} variant="outline" size="sm" asChild>
          <button
            type="button"
            className="text-left"
            onClick={() => {
              run(runScenario(config, state, s.id))
              open(null)
            }}
          >
            <ItemContent>
              <ItemTitle>{s.title}</ItemTitle>
              <ItemDescription>{s.desc}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <ChevronRight />
            </ItemActions>
          </button>
        </Item>
      ))}
    </ItemGroup>
  )
}

const DemoReset = () => {
  const { config, state, run, open } = useApp()
  const { t } = useI18n()
  return (
    <Button
      variant="outline"
      onClick={() => {
        run(runScenario(config, state, 'reset'))
        open(null)
      }}
    >
      <RotateCcw /> {t('classic.demo.reset')}
    </Button>
  )
}

const Row = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex justify-between gap-4 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{value}</span>
  </div>
)

const EvidenceBody = () => {
  const { state, storage } = useApp()
  const { t } = useI18n()
  const [evidence, setEvidence] = useState<Evidence[] | null>(null)
  const [status, setStatus] = useState<Record<string, unknown> | null>(null)
  const [busy, setBusy] = useState(false)
  const load = async () => {
    setBusy(true)
    try {
      const [e, s] = await Promise.all([
        fetch('/api/evidence').then((r) => r.json()),
        fetch('/api/status').then((r) => r.json()),
      ])
      setEvidence(e.evidence)
      setStatus(s)
    } catch {
      setEvidence([])
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])
  const obs = state.observations
  return (
    <>
      <div className="flex flex-col gap-2">
        <Row label={t('classic.evidence.route')} value="SIMULATED" />
        <Row
          label={t('classic.evidence.obs')}
          value={`${obs.provenance} · ${obs.freshness}`}
        />
        <Row
          label={t('classic.evidence.readings')}
          value={`${obs.readings.congestion ?? '—'}% / ${obs.readings.pm25 ?? '—'}`}
        />
        <Row
          label="OpenAI"
          value={
            status
              ? status.agent === 'CONFIGURED'
                ? t('classic.evidence.connected', {
                    model: String(status.model),
                  })
                : t('classic.evidence.unset')
              : '…'
          }
        />
        <Row
          label={t('classic.evidence.storage')}
          value={String(status?.storage ?? storage)}
        />
      </div>
      <Separator />
      {evidence === null || busy ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <ItemGroup>
          {evidence.map((e) => (
            <Item key={e.sourceId} variant="outline" size="sm">
              <ItemContent>
                <ItemTitle>
                  {e.label}{' '}
                  <Badge variant={e.status === 'LIVE' ? 'default' : 'outline'}>
                    {e.status}
                  </Badge>
                </ItemTitle>
                <ItemDescription>
                  {e.value !== null ? `${e.value} ${e.unit} · ` : ''}
                  {e.message}
                </ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}
      <Button variant="outline" onClick={load} disabled={busy}>
        {t('classic.evidence.recheck')}
      </Button>
      <p className="text-xs text-muted-foreground">
        {t('classic.evidence.note')}
      </p>
    </>
  )
}

const TrainBody = () => {
  const { state, run, open } = useApp()
  const { t } = useI18n()
  const names = useNames()
  const [draft, setDraft] = useState(state.plan.departTime)
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        run(changeDepart(draft))
        open(null)
      }}
    >
      <Field>
        <FieldLabel htmlFor="train">
          {t('classic.depart.label', { depart: names.depart(state.plan) })}
        </FieldLabel>
        <Input
          id="train"
          type="time"
          required
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </Field>
      <ToggleGroup
        type="single"
        variant="outline"
        value={draft}
        onValueChange={(v) => v && setDraft(v)}
      >
        {['16:00', '17:00', '18:30'].map((t) => (
          <ToggleGroupItem className={chipOn} key={t} value={t}>
            {t}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Button type="submit">{t('classic.depart.submit')}</Button>
    </form>
  )
}

const TaxiBody = () => {
  const { map, config, state, itinerary: it } = useApp()
  const { t } = useI18n()
  return (
    <>
      <ItemGroup>
        {it.legs
          .find((l) => l.kind === 'RETURN')
          ?.options.map((option) => (
            <Item key={option.mode} variant="outline" size="sm">
              <ItemContent>
                <ItemTitle>
                  {t(`classic.transport.${option.mode}`)}{' '}
                  {it.legs.find((l) => l.kind === 'RETURN')?.mode ===
                    option.mode && <Badge>{t('classic.taxi.current')}</Badge>}
                </ItemTitle>
                <ItemDescription>
                  {t('classic.taxi.estimate', { n: option.totalMin })}
                </ItemDescription>
              </ItemContent>
            </Item>
          ))}
      </ItemGroup>
      <Button asChild variant="outline">
        <a href={KAKAO_T_URL} target="_blank" rel="noreferrer">
          {t('classic.taxi.kakaoT')}
        </a>
      </Button>
      <Button asChild>
        <a
          href={map(hubOf(config, state.plan).id)}
          target="_blank"
          rel="noreferrer"
        >
          {t('classic.taxi.kakaoMap')} <ArrowUpRight />
        </a>
      </Button>
    </>
  )
}

const WhyBody = () => {
  const { state, itinerary: it } = useApp()
  const { t } = useI18n()
  const min = (n: number) => t('classic.min', { n })
  return (
    <>
      <div className="flex flex-col gap-2">
        <Row label={t('classic.why.ready')} value={state.plan.readyTime} />
        <Row label={t('classic.why.outbound')} value={min(it.outbound)} />
        <Row label={t('classic.stats.stay')} value={min(it.localMin)} />
        <Row label={t('classic.why.return')} value={min(it.returnMin)} />
        <Row label={t('classic.why.reserve')} value={min(it.trafficReserve)} />
        <Separator />
        <Row
          label={t('classic.planned')}
          value={
            it.planningArrival !== null
              ? clock(it.planningArrival)
              : t('classic.why.stopped')
          }
        />
        <Row label={t('classic.target')} value={clock(it.stationTarget)} />
      </div>
      <Alert>
        <AlertTitle>{t('classic.why.reasons')}</AlertTitle>
        <AlertDescription>
          <ul className="list-disc pl-4">
            {it.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
      <p className="text-xs text-muted-foreground">
        {t('classic.why.note')} {it.variant ?? '—'}
      </p>
    </>
  )
}

const PlaceBody = ({ id }: { id: string }) => {
  const { config, itinerary, map } = useApp()
  const { t } = useI18n()
  const place = config.places.find((p) => p.id === id)
  if (!place) return null
  const dwell =
    itinerary.stops.find((s) => s.id === id)?.dwell ?? place.attrs.defaultDwell
  return (
    <>
      <img
        src={place.attrs.image}
        alt=""
        className="aspect-video w-full rounded-lg object-cover"
      />
      <p className="text-sm">{place.attrs.desc}</p>
      <p className="text-sm text-muted-foreground">{place.attrs.detail}</p>
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">
          {t('classic.place.dwell', { n: dwell })}
        </Badge>
        {place.meta.verified === false && (
          <Badge variant="outline">{t('classic.place.unverified')}</Badge>
        )}
      </div>
      <Button variant="outline" asChild>
        <a href={map(place.id, 'walk')} target="_blank" rel="noreferrer">
          {t('classic.place.map')} <ArrowUpRight />
        </a>
      </Button>
    </>
  )
}
