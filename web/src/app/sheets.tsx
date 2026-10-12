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
import { transportLabel } from '#/core/mobility'
import { KAKAO_T_URL } from '#/core/transport'
import type { Evidence } from '#/core/evidence'
import { departLabel, hubOf } from '#/core/route'
import { clock } from '#/core/time'
import { changeDepart, runScenario } from '#/core/trip'
import { useApp } from './context'
import type { Sheet } from './context'
import { chipOn } from './bits'

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
  if (sheet === 'demo')
    return {
      title: '데모 시나리오',
      description: '설정(jsonb)에 저장된 시연 조건을 적용해요.',
      ...demo(),
    }
  if (sheet === 'evidence')
    return {
      title: '데이터와 연결 상태',
      description: '시연 관측과 실제 연결을 구분해서 보여줘요.',
      body: <EvidenceBody />,
    }
  if (sheet === 'train')
    return {
      title: '귀가 출발 시각',
      description: `${config.event.dateLabel} · ${hubOf(config, state.plan).name}. 실제 예약은 바뀌지 않아요.`,
      body: <TrainBody />,
    }
  if (sheet === 'taxi')
    return {
      title: `${hubOf(config, state.plan).name} 복귀 이동수단`,
      description: '비교만 하고 선택은 바꾸지 않아요.',
      body: <TaxiBody />,
    }
  if (sheet === 'why')
    return {
      title: '계산 근거',
      description: '입력한 조건과 결정 엔진의 계산이에요.',
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
  return (
    <Button
      variant="outline"
      onClick={() => {
        run(runScenario(config, state, 'reset'))
        open(null)
      }}
    >
      <RotateCcw /> 처음부터 다시
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
        <Row label="일정·이동 경로" value="SIMULATED" />
        <Row
          label="결정에 쓰는 관측"
          value={`${obs.provenance} · ${obs.freshness}`}
        />
        <Row
          label="혼잡 / 초미세먼지"
          value={`${obs.readings.congestion ?? '—'}% / ${obs.readings.pm25 ?? '—'}`}
        />
        <Row
          label="OpenAI"
          value={
            status
              ? status.agent === 'CONFIGURED'
                ? `연결 · ${status.model}`
                : '미설정 · 시연 응답'
              : '…'
          }
        />
        <Row label="저장소" value={String(status?.storage ?? storage)} />
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
        E-UM 연결 다시 확인
      </Button>
      <p className="text-xs text-muted-foreground">
        식당·카페는 상호 미정 후보예요. 일정은 이 기기에 저장되고 7일 뒤
        초기화돼요. 서버에는 구조화된 변경 이벤트만 기록하고 채팅 원문은
        저장하지 않아요. 사진: 한국관광공사, 바다온.
      </p>
    </>
  )
}

const TrainBody = () => {
  const { state, run, open, config } = useApp()
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
          {departLabel(config, state.plan)} → 변경
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
      <Button type="submit">이 시각으로 다시 계산</Button>
    </form>
  )
}

const TaxiBody = () => {
  const { map, config, state, itinerary: it } = useApp()
  return (
    <>
      <ItemGroup>
        {it.legs
          .find((l) => l.kind === 'RETURN')
          ?.options.map((option) => (
            <Item key={option.mode} variant="outline" size="sm">
              <ItemContent>
                <ItemTitle>
                  {transportLabel[option.mode]}{' '}
                  {it.legs.find((l) => l.kind === 'RETURN')?.mode ===
                    option.mode && <Badge>현재 일정</Badge>}
                </ItemTitle>
                <ItemDescription>
                  약 {option.totalMin}분 · 승차·대기·도보·여유 포함 시연 추정.
                  실제 시간·요금은 확인이 필요해요.
                </ItemDescription>
              </ItemContent>
            </Item>
          ))}
      </ItemGroup>
      <Button asChild variant="outline">
        <a href={KAKAO_T_URL} target="_blank" rel="noreferrer">
          카카오T에서 배차·요금 확인
        </a>
      </Button>
      <Button asChild>
        <a
          href={map(hubOf(config, state.plan).id)}
          target="_blank"
          rel="noreferrer"
        >
          카카오맵에서 경로 확인 <ArrowUpRight />
        </a>
      </Button>
    </>
  )
}

const WhyBody = () => {
  const { state, itinerary: it } = useApp()
  return (
    <>
      <div className="flex flex-col gap-2">
        <Row label="출발 준비" value={state.plan.readyTime} />
        <Row label="코스까지" value={`${it.outbound}분`} />
        <Row label="코스 체류" value={`${it.localMin}분`} />
        <Row label="귀가 거점까지" value={`${it.returnMin}분`} />
        <Row label="교통 여유" value={`${it.trafficReserve}분`} />
        <Separator />
        <Row
          label="계획상 역 도착"
          value={
            it.planningArrival !== null
              ? clock(it.planningArrival)
              : '계산 중단'
          }
        />
        <Row label="역 도착 목표" value={clock(it.stationTarget)} />
      </div>
      <Alert>
        <AlertTitle>판단 이유</AlertTitle>
        <AlertDescription>
          <ul className="list-disc pl-4">
            {it.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
      <p className="text-xs text-muted-foreground">
        관측 임계값은 시연 정책이며 공인 기준이 아니에요. 코스 변형:{' '}
        {it.variant ?? '—'}
      </p>
    </>
  )
}

const PlaceBody = ({ id }: { id: string }) => {
  const { config, itinerary, map } = useApp()
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
        <Badge variant="secondary">예상 체류 {dwell}분</Badge>
        {place.meta.verified === false && (
          <Badge variant="outline">미검증 후보</Badge>
        )}
      </div>
      <Button variant="outline" asChild>
        <a href={map(place.id, 'walk')} target="_blank" rel="noreferrer">
          위치 보기 <ArrowUpRight />
        </a>
      </Button>
    </>
  )
}
