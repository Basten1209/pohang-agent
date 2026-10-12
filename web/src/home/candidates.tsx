import { useState } from 'react'
import { Coffee, MapPin, Utensils } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { TripConfig, Venue } from '#/core/schema'
import { courseVenues, venueMapUrl } from '#/core/venues'
import { pohangTenTastesUrl } from '#/core/seed/venues'

const kinds = [
  { id: 'food', label: '맛집', Icon: Utensils },
  { id: 'cafe', label: '카페', Icon: Coffee },
  { id: 'sight', label: '볼거리', Icon: MapPin },
] as const

export function CourseCandidates({
  config,
  course,
}: {
  config: TripConfig
  course: string | null
}) {
  const [kind, setKind] = useState<Venue['kind']>('food')
  const [expanded, setExpanded] = useState(false)
  const venues = courseVenues(config, course)
  if (!venues.length) return null
  const filtered = venues.filter((v) => v.kind === kind)
  const shown = expanded ? filtered : filtered.slice(0, 3)
  return (
    <section className="space-y-3" aria-label="관광 안내와 지도 정보의 실제 방문 후보">
      <div>
        <h3 className="text-base font-semibold">어디에 들러볼까요?</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          관광 안내와 지도 매장 정보에서 찾은 실제 장소예요.
        </p>
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="방문 후보 종류"
      >
        {kinds.map(({ id, label, Icon }) => (
          <Button
            key={id}
            size="sm"
            variant={kind === id ? 'default' : 'outline'}
            aria-pressed={kind === id}
            onClick={() => {
              setKind(id)
              setExpanded(false)
            }}
          >
            <Icon className="size-3.5" />
            {label} {venues.filter((v) => v.kind === id).length}
          </Button>
        ))}
      </div>
      {kind === 'food' && venues.some((v) => v.tenTaste) && (
        <p className="rounded-lg bg-secondary p-3 text-xs leading-relaxed text-secondary-foreground">
          포항시가 소개한{' '}
          <a
            href={pohangTenTastesUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline underline-offset-2"
          >
            포항 10미
          </a>{' '}
          중 모리국수·물회·과메기를 맛볼 곳부터 골라봤어요.
        </p>
      )}
      <ul className="space-y-2">
        {shown.map((v) => (
          <li key={v.id} className="rounded-xl border bg-background p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{v.name}</p>
              {v.tenTaste && (
                <Badge variant="secondary" className="text-[0.625rem]">
                  포항 10미
                </Badge>
              )}
              {v.detour && (
                <Badge variant="outline" className="text-[0.625rem]">
                  별도 이동
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs font-medium text-primary">
              {v.highlight}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {v.description}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {v.address}
            </p>
            {v.note && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {v.note}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <a
                href={venueMapUrl(v)}
                target="_blank"
                rel="noreferrer"
                className="py-1 font-medium text-primary underline underline-offset-2"
                aria-label={`${v.name} 지도 보기`}
              >
                지도 보기
              </a>
              <a
                href={v.source.url}
                target="_blank"
                rel="noreferrer"
                className="py-1 text-muted-foreground underline underline-offset-2"
                aria-label={`${v.name} ${v.source.title} 소개 보기`}
              >
                {v.source.title} ↗
              </a>
            </div>
          </li>
        ))}
      </ul>
      {filtered.length > 3 && (
        <Button
          size="sm"
          variant="ghost"
          className="w-full"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '접기' : `후보 ${filtered.length - 3}곳 더 보기`}
        </Button>
      )}
      <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
        2026.10.12 소개 자료·지도 등록 확인. 방문 후보이며 일정에 자동 추가되지
        않아요. 영업 여부·메뉴·이동 시간은 방문 전에 확인해 주세요.
      </p>
    </section>
  )
}
