import { CalendarDays, CircleDot, Flag, MapPin } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Card } from '@/components/ui/card'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { eventIn } from '#/core/race-event'
import type { RaceEvent } from '#/core/schema'
import { bib } from './mock'
import { ProgressiveBlur } from '#/app/progressive-blur'
import { useI18n } from '#/i18n/react'
import { Section } from '#/home/section'

const directionsTo = (event: RaceEvent) =>
  `https://map.kakao.com/link/to/${encodeURIComponent(event.venue)},${event.geo.lat},${event.geo.lng}`

/** When and where: the race at a glance. */
export const RaceHeadline = ({ event: source }: { event: RaceEvent }) => {
  // Directions search the Korean venue name; the card reads in the runner's language.
  const directions = directionsTo(source)
  const { t, locale } = useI18n()
  const event = eventIn(source, locale)
  return (
    <Card className="relative gap-0 overflow-hidden py-0">
      <img
        src={event.image || '/images/yeongildae.jpg'}
        alt=""
        width="960"
        height="540"
        className="aspect-[4/3] w-full object-cover sm:aspect-[2/1]"
      />
      {/* The essentials over the photo; the rest lives in the race guide. */}
      <div className="absolute inset-x-0 bottom-0 h-3/5">
        <ProgressiveBlur />
        <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-col p-4 text-white">
        <p className="text-xs text-white/80">
          {t('race.bib', {
            category: `${event.course.distanceKm}km`,
            bib,
          })}
        </p>
        <h2 className="mt-1 font-heading text-xl leading-snug font-semibold">
          {event.name}
        </h2>
        <div className="mt-2 flex flex-col gap-1 text-sm text-white/90">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-4 shrink-0" />
            {event.dateLabel} · {t('race.gun', { time: event.gun })}
          </span>
          {/* The venue opens directions to it. */}
          <a
            href={directions}
            target="_blank"
            rel="noreferrer"
            aria-label={`${event.venue} · ${t('race.directions')}`}
            className="flex w-fit items-center gap-1.5 underline-offset-2 hover:underline"
          >
            <MapPin className="size-4 shrink-0" />
            <span className="truncate underline decoration-white/50">
              {event.venue}
            </span>
          </a>
        </div>
      </div>
    </Card>
  )
}

/** What a participant needs before the gun, folded so the home stays short. */
export const RaceDetails = ({ event: source }: { event: RaceEvent }) => {
  const { t, locale } = useI18n()
  const event = eventIn(source, locale)
  const last = event.course.route.length - 1
  return (
    <>
      <Section title={t('race.detail.guide')}>
        <Accordion type="multiple">
          <AccordionItem value="schedule">
            <AccordionTrigger>{t('race.detail.schedule')}</AccordionTrigger>
            <AccordionContent>
              <ol className="flex flex-col gap-2">
                {event.schedule.map((s) => (
                  <li key={s.time} className="flex gap-3">
                    <span className="w-12 shrink-0 font-medium tabular-nums">
                      {s.time}
                    </span>
                    <span className="text-muted-foreground">{s.label}</span>
                  </li>
                ))}
              </ol>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="course">
            <AccordionTrigger>{t('race.detail.course')}</AccordionTrigger>
            <AccordionContent className="flex flex-col gap-2">
              <p className="text-muted-foreground">{event.course.summary}</p>
              <ItemGroup>
                {event.course.route.map((c, i) => (
                  <Item key={c} size="sm">
                    <ItemMedia variant="icon">
                      {i === 0 ? (
                        <MapPin />
                      ) : i === last ? (
                        <Flag />
                      ) : (
                        <CircleDot />
                      )}
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{c}</ItemTitle>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="kit">
            <AccordionTrigger>{t('race.detail.kit')}</AccordionTrigger>
            <AccordionContent>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {event.kit.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="facilities">
            <AccordionTrigger>{t('race.detail.facilities')}</AccordionTrigger>
            <AccordionContent>
              <ItemGroup>
                {event.facilities.map((f) => (
                  <Item key={f.label} size="sm">
                    <ItemContent>
                      <ItemTitle>{f.label}</ItemTitle>
                      <ItemDescription>{f.detail}</ItemDescription>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="notes">
            <AccordionTrigger>{t('race.detail.notes')}</AccordionTrigger>
            <AccordionContent>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
                {event.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="rules">
            <AccordionTrigger>{t('race.detail.rules')}</AccordionTrigger>
            <AccordionContent>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
                {event.rules.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Section>

      <Section title={t('race.detail.faq')}>
        <Accordion type="single" collapsible>
          {event.faq.map((f, i) => (
            <AccordionItem key={f.q} value={`faq-${i}`}>
              <AccordionTrigger>{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Section>
    </>
  )
}

export const RaceOverview = ({ event }: { event: RaceEvent }) => (
  <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
    <RaceHeadline event={event} />
    <RaceDetails event={event} />
  </div>
)
