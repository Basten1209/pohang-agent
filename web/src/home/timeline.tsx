import {
  Bus,
  CarTaxiFront,
  Check,
  ChevronDown,
  Footprints,
  Camera,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { directionsUrl, pointOf } from '#/core/links'
import type { Itinerary } from '#/core/planner'
import type { Place, TripConfig } from '#/core/schema'
import type { TripState } from '#/core/trip'
import { clock } from '#/core/time'
import { KAKAO_T_URL } from '#/core/transport'
import { transportLabel, type TravelMode } from '#/core/mobility'
import { PlaceThumb } from './thumb'
import { venueMapUrl } from '#/core/venues'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

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
  const completed =
    state?.plan.completed.map((id) => ({
      id,
      record: state.visits?.find((v) => v.placeId === id),
    })) ?? []
  const stopRow = (id: string, time: string, status: string) => {
    const p = config.places.find((p) => p.id === id)
    return (
      <li
        key={`stop-${id}`}
        className={`rounded-xl border p-3 ${status === '완료' ? 'border-secondary bg-secondary/40' : 'border-primary/25 bg-secondary/60'}`}
      >
        <div className="flex gap-3">
          {p && <PlaceThumb place={p} className="size-16 shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-xs font-semibold text-primary">
              {status === '완료' && <Check className="size-3" />}
              {status}
              <span className="ml-1 font-normal tabular-nums">{time}</span>
            </p>
            <p className="mt-1 font-semibold leading-snug">
              {p?.attrs.short ?? id}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {p?.attrs.subtitle}
            </p>
            {status !== '완료' &&
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
                      {v.detour ? ' · 별도 이동' : ''}
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
                사진 남기기
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
    <ol aria-label="관광 일정과 구간별 이동" className="flex flex-col gap-3">
      {completed.map(({ id, record }) =>
        stopRow(
          id,
          record
            ? `${clock(record.start)}–${clock(record.end)}`
            : '이전 방문 · 시간 기록 없음',
          '완료',
        ),
      )}
      {rows.map(({ key, leg, stop }) => {
        if (stop)
          return stopRow(
            stop.id,
            `${clock(stop.start)}–${clock(stop.end)} · ${stop.dwell}분`,
            state?.plan.stage === 'LOCAL' && stop.id === it.stops[0]?.id
              ? '지금'
              : '예정',
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
            <Collapsible className="group">
              <CollapsibleTrigger className="flex cursor-pointer items-center gap-2 py-1 w-full text-left">
                <Icon className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 leading-relaxed">
                  {leg.label}
                  <span className="ml-1.5 whitespace-nowrap">
                    · {transportLabel[leg.mode]} 약 {leg.totalMin}분
                  </span>
                </span>
                <ChevronDown className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3 space-y-3 border-t pt-3 leading-relaxed">
                  <p>
                    {clock(leg.start)}–{clock(leg.end)} · 시연 추정
                  </p>
                  <p>
                    {leg.rideMin > 0 && `승차 ${leg.rideMin}분 · `}
                    {leg.waitMin > 0 && `대기 ${leg.waitMin}분 · `}도보{' '}
                    {leg.walkMin}분
                    {leg.bufferMin > 0 && ` · 혼잡 여유 ${leg.bufferMin}분`}
                  </p>
                  <p>{leg.reason}</p>
                  <p>
                    {leg.basis}. 실제 시간·운행·배차는 지도에서 확인해 주세요.
                  </p>
                  {select && leg.options.length > 1 && (
                    <div className="flex flex-wrap gap-2">
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
                </div>
              </CollapsibleContent>
            </Collapsible>
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
