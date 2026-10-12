import { CalendarDays, CircleDot, Flag, MapPin } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
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
import { MascotBanner } from '#/brand/brand'
import { useI18n } from '#/i18n/react'
import { Section } from '#/home/section'

const directionsTo = (event: RaceEvent) =>
  `https://map.kakao.com/link/to/${encodeURIComponent(event.venue)},${event.geo.lat},${event.geo.lng}`

/** When and where: the race at a glance. */
export const RaceHeadline = ({
  event: source,
  finished = false,
}: {
  event: RaceEvent
  finished?: boolean
}) => {
  // Directions search the Korean venue name; the panel reads in the runner's language.
  const directions = directionsTo(source)
  const { t, locale } = useI18n()
  const event = eventIn(source, locale)
  return (
    <MascotBanner
      pose={finished ? 'cheer' : 'map'}
      eyebrow={t('race.bib', {
        category: `${event.course.distanceKm}km`,
        bib,
      })}
      title={event.name}
      description={
        <span className="flex flex-col gap-1">
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
            className="flex w-fit items-center gap-1.5 text-primary underline underline-offset-2"
          >
            <MapPin className="size-4 shrink-0" />
            {event.venue}
          </a>
        </span>
      }
    />
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
              <div className="max-h-64 overflow-y-auto scroll-fade no-scrollbar">
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
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="course">
            <AccordionTrigger>{t('race.detail.course')}</AccordionTrigger>
            <AccordionContent className="flex flex-col gap-2">
              <div className="max-h-64 overflow-y-auto scroll-fade no-scrollbar">
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
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="kit">
            <AccordionTrigger>{t('race.detail.kit')}</AccordionTrigger>
            <AccordionContent>
              <div className="max-h-64 overflow-y-auto scroll-fade no-scrollbar">
                <ul className="flex list-disc flex-col gap-1 pl-5">
                  {event.kit.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="facilities">
            <AccordionTrigger>{t('race.detail.facilities')}</AccordionTrigger>
            <AccordionContent>
              <div className="max-h-64 overflow-y-auto scroll-fade no-scrollbar">
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
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="notes">
            <AccordionTrigger>{t('race.detail.notes')}</AccordionTrigger>
            <AccordionContent>
              <div className="max-h-64 overflow-y-auto scroll-fade no-scrollbar">
                <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
                  {event.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="rules">
            <AccordionTrigger>{t('race.detail.rules')}</AccordionTrigger>
            <AccordionContent>
              <div className="max-h-64 overflow-y-auto scroll-fade no-scrollbar">
                <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
                  {event.rules.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
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
