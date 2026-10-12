import {
  CalendarDays,
  CircleDot,
  Flag,
  MapPin,
  Navigation,
  Timer,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { useI18n } from '#/i18n/react'

const directionsTo = (event: RaceEvent) =>
  `https://map.kakao.com/link/to/${encodeURIComponent(event.venue)},${event.geo.lat},${event.geo.lng}`

/** When and where: the race at a glance. */
export const RaceHeadline = ({ event: source }: { event: RaceEvent }) => {
  // Directions search the Korean venue name; the card reads in the runner's language.
  const directions = directionsTo(source)
  const { t, locale } = useI18n()
  const event = eventIn(source, locale)
  return (
    <Card>
      {event.image && (
        <img
          src={event.image}
          alt=""
          width="960"
          height="540"
          className="aspect-[2/1] w-full object-cover"
        />
      )}
      <CardHeader>
        <CardTitle>{event.name}</CardTitle>
        <CardDescription>
          {t('race.bib', { category: event.category, bib })}
        </CardDescription>
        <CardAction>
          <Badge variant="outline">{t('race.demo')}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          <Item size="sm">
            <ItemMedia variant="icon">
              <CalendarDays />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{event.dateLabel}</ItemTitle>
              <ItemDescription>
                {t('race.gun', { time: event.gun })}
              </ItemDescription>
            </ItemContent>
          </Item>
          <Item size="sm">
            <ItemMedia variant="icon">
              <MapPin />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{event.venue}</ItemTitle>
              <ItemDescription>{event.address}</ItemDescription>
            </ItemContent>
          </Item>
          <Item size="sm">
            <ItemMedia variant="icon">
              <Timer />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{t('race.cutoff')}</ItemTitle>
              <ItemDescription>{event.cutoff}</ItemDescription>
            </ItemContent>
          </Item>
        </ItemGroup>
        <Button asChild variant="outline" className="mt-3 w-full">
          <a href={directions} target="_blank" rel="noreferrer">
            <Navigation />
            {t('race.directions')}
          </a>
        </Button>
      </CardContent>
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
      <Card>
        <CardHeader>
          <CardTitle>{t('race.detail.guide')}</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('race.detail.faq')}</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </>
  )
}

export const RaceOverview = ({ event }: { event: RaceEvent }) => (
  <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
    <RaceHeadline event={event} />
    <RaceDetails event={event} />
  </div>
)
