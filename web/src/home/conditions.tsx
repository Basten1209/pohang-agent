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
  const hasDemo = config.sources.some(
    (source) =>
      source.enabled && obs.sources[source.reading]?.provenance === 'DEMO',
  )
  return (
    <details className="rounded-xl border bg-card px-4 py-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer leading-relaxed">
        <span className="font-semibold text-foreground">
          {hasDemo ? 'E-UM · 구룡포 조건 시연' : 'E-UM · 구룡포의 지금'}
        </span>
        <span className="mt-1 block">
          {[
            { reading: 'congestion', label: '교통', unit: '%' },
            { reading: 'pm25', label: '미세먼지', unit: 'μg/m³' },
            { reading: 'uvIndex', label: '자외선', unit: '' },
          ]
            .filter((s) =>
              config.sources.some(
                (source) => source.enabled && source.reading === s.reading,
              ),
            )
            .map((source) => {
              const value = usableReading(obs, source.reading)
              return `${source.label} ${value == null ? '확인 중' : `${Math.round(value * 10) / 10}${source.unit}`}`
            })
            .join(' · ')}
        </span>
      </summary>
      <div className="mt-3 space-y-3 border-t pt-3 leading-relaxed">
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
                <p className="font-medium text-foreground">{source.label}</p>
                <p>
                  {src?.value ?? obs.readings[source.reading] ?? '확인 중'}{' '}
                  {source.unit}
                </p>
                <p>
                  {src?.provenance === 'DEMO'
                    ? '시연 조건'
                    : src?.provenance === 'LIVE'
                      ? '실응답'
                      : src?.provenance === 'SNAPSHOT'
                        ? '저장 관측'
                        : '확인 불가'}{' '}
                  · {src?.freshness === 'STALE' ? '오래된 관측 · ' : ''}
                  {applies && view.itinerary.needsReview
                    ? '일정 재검토 필요 · 현재 판단에 미반영'
                    : applies
                      ? '현재 코스 판단에 반영'
                      : '현재 코스 판단에 미반영'}
                </p>
                <p>
                  관측 {at(src?.observedAt)} · 조회 {at(src?.fetchedAt)}
                </p>
                <p>{src?.note}</p>
                <a
                  href={String(source.meta.docs)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  제공 정보
                </a>
              </div>
            )
          })}
        <p>
          구룡포 관측은 포항 전역의 상태를 의미하지 않아요. 이동시간은 시연
          추정이에요.
        </p>
      </div>
    </details>
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
  const rec = recommendTransport(
    view.state.plan,
    view.state.observations,
    view.itinerary,
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
      setMessage('선택을 저장하지 못했어요. 다시 시도해 주세요.')
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
                구간별 자동
              </Button>
              <Button
                variant={selected === 'TRANSIT' ? 'default' : 'outline'}
                disabled={pending || disabled}
                onClick={() => choose('TRANSIT')}
              >
                <Bus />
                버스 우선
              </Button>
              <Button
                variant={selected === 'TAXI' ? 'default' : 'outline'}
                disabled={pending || disabled}
                onClick={() => choose('TAXI')}
              >
                <CarTaxiFront />
                택시 우선
              </Button>
            </div>
            {selected === 'TAXI' ? (
              <div className="rounded-lg bg-secondary p-3 text-sm">
                <p className="mb-3">
                  시간표에도 택시 시연 추정을 반영했어요. 실제 배차·요금과
                  소요시간은 카카오T에서 확인해 주세요.
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
