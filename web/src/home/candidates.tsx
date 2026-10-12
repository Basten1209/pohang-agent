import { useState } from 'react'
import { Coffee, MapPin, Utensils } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TripConfig, Venue } from '#/core/schema'
import { courseVenues, venueMapUrl } from '#/core/venues'
import { pohangTenTastesUrl } from '#/core/seed/venues'
import { Rich, useI18n } from '#/i18n/react'

const kinds = [
  { id: 'food', Icon: Utensils },
  { id: 'cafe', Icon: Coffee },
  { id: 'sight', Icon: MapPin },
] as const

export function CourseCandidates({
  config,
  course,
}: {
  config: TripConfig
  course: string | null
}) {
  const { t } = useI18n()
  const [kind, setKind] = useState<Venue['kind']>('food')
  const [expanded, setExpanded] = useState(false)
  const venues = courseVenues(config, course)
  if (!venues.length) return null
  const filtered = venues.filter((v) => v.kind === kind)
  const shown = expanded ? filtered : filtered.slice(0, 3)
  return (
    <section className="space-y-3" aria-label={t('tour.candidatesLabel')}>
      <div>
        <h3 className="text-base font-semibold">{t('tour.candidatesTitle')}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t('tour.candidatesBody')}
        </p>
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t('tour.kindsLabel')}
      >
        {kinds.map(({ id, Icon }) => (
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
            {t(`tour.kind.${id}`)} {venues.filter((v) => v.kind === id).length}
          </Button>
        ))}
      </div>
      {kind === 'food' && venues.some((v) => v.tenTaste) && (
        <p className="rounded-lg bg-secondary p-3 text-xs leading-relaxed text-secondary-foreground">
          <Rich
            text={t('tour.tenTastesIntro')}
            icon={
              <a
                href={pohangTenTastesUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline underline-offset-2"
              >
                {t('tour.tenTastes')}
              </a>
            }
          />
        </p>
      )}
      <ul className="space-y-2">
        {shown.map((v) => (
          <li key={v.id} className="rounded-xl border bg-background p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{v.name}</p>
              {v.tenTaste && (
                <span className="text-xs text-primary">
                  {t('tour.tenTastes')}
                </span>
              )}
              {v.detour && (
                <span className="text-xs text-muted-foreground">
                  {t('tour.detour')}
                </span>
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
                aria-label={t('tour.viewMapOf', { name: v.name })}
              >
                {t('tour.viewMap')}
              </a>
              <a
                href={v.source.url}
                target="_blank"
                rel="noreferrer"
                className="py-1 text-muted-foreground underline underline-offset-2"
                aria-label={t('tour.viewSourceOf', {
                  name: v.name,
                  source: v.source.title,
                })}
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
          {expanded
            ? t('tour.collapse')
            : t('tour.showMore', { n: filtered.length - 3 })}
        </Button>
      )}
      <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
        {t('tour.candidatesNote')}
      </p>
    </section>
  )
}
