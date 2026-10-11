import {
  Activity,
  ArrowUpRight,
  Bus,
  CarTaxiFront,
  Copy,
  Sun,
  Wind,
} from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { TripConfig } from '#/core/schema'
import type { TripView } from '#/core/view'
import { usableReading } from '#/core/signals'
import { recommendTransport } from '#/core/transport'
import { mapUrl } from '#/core/links'
import { hubOf } from '#/core/route'

const at = (iso?: string | null) =>
  iso && Number.isFinite(Date.parse(iso))
    ? new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(iso))
    : '확인 불가'

export const ConditionsCard = ({
  config,
  view,
}: {
  config: TripConfig
  view: TripView
}) => {
  const obs = view.state.observations
  return (
    <Card className="border-primary/25 bg-secondary/40">
      <CardHeader>
        <CardDescription className="font-semibold tracking-wider text-primary">
          E-UM · 구룡포의 지금
        </CardDescription>
        <CardTitle>이 코스를 추천한 이유</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed">
          {[...new Set(view.itinerary.reasons)].join(' ')}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {config.sources
            .filter((s) => s.enabled)
            .map((source) => {
              const src = obs.sources[source.reading]
              const demo = src?.provenance === 'DEMO'
              const value = demo ? obs.readings[source.reading] : src?.value
              const scoped =
                source.reading === 'congestion'
                  ? view.itinerary.legs.some((leg) => leg.bufferMin > 0) ||
                    view.itinerary.course === 'guryongpo'
                  : view.itinerary.course === 'guryongpo'
              const applies =
                scoped &&
                view.itinerary.calculationStatus !== 'NOT_RUN' &&
                usableReading(obs, source.reading) !== null &&
                (src?.eligible === true || demo)
              const Icon =
                source.reading === 'congestion'
                  ? Activity
                  : source.reading === 'uvIndex'
                    ? Sun
                    : Wind
              return (
                <div key={source.id} className="rounded-lg border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Icon className="size-4 text-primary" />
                    <Badge variant="outline">
                      {demo
                        ? '시연 조건'
                        : src?.provenance === 'SNAPSHOT'
                          ? '저장 관측'
                          : src?.freshness === 'STALE'
                            ? '오래된 관측'
                            : src?.provenance === 'LIVE'
                              ? '실응답'
                              : '확인 불가'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {source.label.replace('E-UM ', '')}
                  </p>
                  <p className="my-1 text-xl font-semibold tabular-nums">
                    {value == null ? '—' : value}
                    <span className="ml-1 text-xs font-normal">
                      {value == null ? '' : source.unit}
                    </span>
                  </p>
                  <p className="text-xs font-medium text-primary">
                    {applies
                      ? '현재 코스 판단에 반영'
                      : '현재 코스 판단에 미반영'}
                  </p>
                  <details className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    <summary className="cursor-pointer">관측 근거 보기</summary>
                    <p>
                      범위: {src?.scope || '구룡포'} · {source.id}
                    </p>
                    <p>관측: {at(src?.observedAt)}</p>
                    <p>조회: {at(src?.fetchedAt)}</p>
                    <p>
                      {src?.note ??
                        (demo
                          ? '발표를 위한 가상 조건입니다.'
                          : '실제 API 응답 확인 후 표시합니다.')}
                    </p>
                    <a
                      href={String(source.meta.docs)}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      E-UM 제공 정보
                    </a>
                  </details>
                </div>
              )
            })}
        </div>
        {view.itinerary.course === 'guryongpo' &&
          (usableReading(obs, 'uvIndex') ?? 0) >= 6 && (
            <p className="text-xs">
              자외선이 높은 조건이에요. 그늘에서 쉬거나 실내 장소를 먼저
              살펴보세요.
            </p>
          )}
        <p className="text-xs text-muted-foreground">
          대회는 {config.event.date} 오전 일정 재현입니다. E-UM은 실제 조회
          시점의 관측이며 포항 전역의 상태를 의미하지 않습니다.
          이동시간·여유시간은 앱의 시연 정책입니다.
        </p>
      </CardContent>
    </Card>
  )
}

export const TransportCard = ({
  config,
  view,
  select,
}: {
  config: TripConfig
  view: TripView
  select: (mode: 'TAXI' | 'TRANSIT') => Promise<void>
}) => {
  const rec = recommendTransport(
    view.state.plan,
    view.state.observations,
    view.itinerary,
  )
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const selected = view.state.plan.localTransport
  const hub = hubOf(config, view.state.plan)
  const choose = async (mode: 'TAXI' | 'TRANSIT') => {
    setPending(true)
    setMessage('')
    try {
      await select(mode)
    } catch {
      setMessage('선택을 저장하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setPending(false)
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardDescription>컨디션과 귀가시간을 함께 고려했어요</CardDescription>
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
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={selected === 'TRANSIT' ? 'default' : 'outline'}
                disabled={pending}
                onClick={() => choose('TRANSIT')}
              >
                <Bus />
                대중교통 선택
              </Button>
              <Button
                variant={selected === 'TAXI' ? 'default' : 'outline'}
                disabled={pending}
                onClick={() => choose('TAXI')}
              >
                <CarTaxiFront />
                택시 선택
              </Button>
            </div>
            {selected === 'TAXI' ? (
              <div className="rounded-lg bg-secondary p-3 text-sm">
                <p className="mb-3">
                  택시 시간·요금 확인이 필요해요. 위 시간표는 기존 대중교통 기준
                  참고안으로 유지합니다.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <a href={rec.url} target="_blank" rel="noreferrer">
                      카카오T 열기
                      <ArrowUpRight />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(hub.name)
                        setMessage('목적지를 복사했어요.')
                      } catch {
                        setMessage(`목적지: ${hub.name}`)
                      }
                    }}
                  >
                    <Copy />
                    목적지 복사
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  PC에서는 모바일 앱을 이용해 주세요. 앱이 없다면{' '}
                  <a
                    href="https://www.kakaomobility.com/service-kakaot/taxi"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    공식 설치 안내
                  </a>
                  를 확인하세요. 목적지: {hub.name}
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
                    지도에서 실제 노선 확인
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
