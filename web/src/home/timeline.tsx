import { Bus, CarTaxiFront, Footprints } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { directionsUrl, pointOf } from '#/core/links'
import type { Itinerary } from '#/core/planner'
import type { TripConfig } from '#/core/schema'
import { clock } from '#/core/time'
import { KAKAO_T_URL } from '#/core/transport'
import { transportLabel, type TravelMode } from '#/core/mobility'

/** Stops and their bridges use exactly the server's calculated time intervals. */
export function ItineraryTimeline({
  config,
  itinerary: it,
  select,
  disabled = false,
}: {
  config: TripConfig
  itinerary: Itinerary
  select?: (id: string, mode: TravelMode | 'AUTO') => Promise<void>
  disabled?: boolean
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const change = async (id: string, mode: TravelMode | 'AUTO') => {
    if (!select || pending) return
    setPending(true)
    setError('')
    try {
      await select(id, mode)
    } catch {
      setError('이동수단을 저장하지 못했어요. 다시 선택해 주세요.')
    } finally {
      setPending(false)
    }
  }
  const rows = [
    ...(it.legs ?? [])
      .filter((l) => l.mode && Array.isArray(l.options))
      .map((leg) => ({ at: leg.start, key: leg.id, leg, stop: null })),
    ...it.stops.map((stop) => ({
      at: stop.start,
      key: stop.id,
      stop,
      leg: null,
    })),
  ].sort((a, b) => a.at - b.at || (a.leg ? -1 : 1))
  const point = pointOf(config, it.course)
  return (
    <ol aria-label="관광 일정과 구간별 이동" className="flex flex-col gap-3">
      {rows.map(({ key, leg, stop }) => {
        if (stop) {
          const p = config.places.find((p) => p.id === stop.id)
          return (
            <li key={key} className="rounded-xl border bg-card p-4">
              <p className="text-xs font-medium tabular-nums text-primary">
                {clock(stop.start)}–{clock(stop.end)} · 머무는 시간 {stop.dwell}
                분
              </p>
              <p className="mt-1 font-semibold">{p?.attrs.short ?? stop.id}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {p?.attrs.subtitle}
              </p>
            </li>
          )
        }
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
            className="mx-1 rounded-xl border border-primary/15 bg-primary/5 p-3 sm:mx-3"
          >
            <div className="flex flex-wrap items-center gap-2 text-primary">
              <Icon className="size-4 shrink-0" />
              <span className="font-semibold">
                {transportLabel[leg.mode]} 이동 · 약 {leg.totalMin}분
              </span>
              <Badge variant="outline" className="text-[10px]">
                시연 추정
              </Badge>
            </div>
            <p className="mt-1 text-xs tabular-nums">
              {clock(leg.start)}–{clock(leg.end)} · {leg.label}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {leg.rideMin > 0 && `승차 ${leg.rideMin}분 · `}
              {leg.waitMin > 0 && `대기 ${leg.waitMin}분 · `}도보 {leg.walkMin}
              분{leg.bufferMin > 0 && ` + 혼잡 여유 ${leg.bufferMin}분`}
            </p>
            <p className="mt-1 text-xs leading-relaxed">{leg.reason}</p>
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer">
                이동 근거
                {select && leg.options.length > 1 ? ' · 수단 바꾸기' : ''}
              </summary>
              <p className="my-2 leading-relaxed">
                {leg.basis}. 실제 소요시간·운행·배차는 지도에서 확인해 주세요.
              </p>
              {select && leg.options.length > 1 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {leg.options.map((o) => (
                    <Button
                      key={o.mode}
                      size="sm"
                      variant={o.mode === leg.mode ? 'default' : 'outline'}
                      disabled={pending || disabled}
                      onClick={() => void change(leg.id, o.mode)}
                    >
                      {transportLabel[o.mode]} 약 {o.totalMin}분
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending || disabled}
                    onClick={() => void change(leg.id, 'AUTO')}
                  >
                    자동 추천
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
                    지도에서 이 구간 확인
                  </a>
                )}
                {leg.mode === 'TAXI' && (
                  <a
                    className="underline"
                    href={KAKAO_T_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    카카오T 배차·요금 확인
                  </a>
                )}
              </div>
            </details>
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
