import { CalendarDays, MapPin, Navigation, Timer } from 'lucide-react'
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
import { Separator } from '@/components/ui/separator'
import { event } from './mock'

const directions = `https://map.kakao.com/link/to/${encodeURIComponent(event.venue)},${event.geo.lat},${event.geo.lng}`

/** What a participant needs before the gun: when, where, what to bring. */
export const RaceOverview = () => (
  <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
    <Card>
      <CardHeader>
        <CardTitle>{event.name}</CardTitle>
        <CardDescription>
          {event.category} · 배번 {event.bib}
        </CardDescription>
        <CardAction>
          <Badge variant="outline">시연 데이터</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          <Item size="sm">
            <ItemMedia variant="icon">
              <CalendarDays />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{event.date}</ItemTitle>
              <ItemDescription>{event.gun} 출발</ItemDescription>
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
              <ItemTitle>제한시간</ItemTitle>
              <ItemDescription>{event.cutoff}</ItemDescription>
            </ItemContent>
          </Item>
        </ItemGroup>
        <Button asChild variant="outline" className="mt-3 w-full">
          <a href={directions} target="_blank" rel="noreferrer">
            <Navigation />
            대회장 길찾기
          </a>
        </Button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>당일 일정</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>코스</CardTitle>
        <CardDescription>왕복 코스 · 반환점 5km</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-1.5">
        {event.course.map((c, i) => (
          <span key={c} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted-foreground">→</span>}
            <Badge variant="secondary">{c}</Badge>
          </span>
        ))}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>준비물</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {event.kit.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>현장 시설</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {event.facilities.map((f, i) => (
          <div key={f.label} className="flex flex-col gap-2">
            {i > 0 && <Separator />}
            <div className="flex justify-between gap-3">
              <span className="font-medium">{f.label}</span>
              <span className="text-right text-muted-foreground">
                {f.detail}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>

    <ul className="flex flex-col gap-1 px-1 text-xs text-muted-foreground">
      {event.notes.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  </div>
)
