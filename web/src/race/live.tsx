import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { pace, raceClock, snapshot, timeAt } from '#/core/race'
import { bib, category, demoStart, race } from './mock'

const km = (d: number) => d.toFixed(2)

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-0.5 rounded-lg bg-muted/50 p-3">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-lg font-semibold tabular-nums">{value}</span>
  </div>
)

/**
 * Live standing during the race. The demo clock advances `t` (optionally
 * fast-forwarded) on every tab, as a real race would; everything shown is
 * `snapshot(race, t)`.
 */
export const RaceLive = ({ finished = false }: { finished?: boolean }) => {
  const [t, setT] = useState(demoStart)
  const [speed, setSpeed] = useState('1')
  const s = useMemo(
    () => snapshot(race, finished ? timeAt(race.me.paces, race.distance) : t),
    [t, finished],
  )

  useEffect(() => {
    if (s.finished) return
    const id = setInterval(() => setT((x) => x + Number(speed)), 1000)
    return () => clearInterval(id)
  }, [speed, s.finished])

  const avg = s.splits.length
    ? s.splits.reduce((a, b) => a + b.time, 0) / s.splits.length
    : null

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardDescription>
            {category} · 배번 {bib}
          </CardDescription>
          <CardTitle className="text-4xl tabular-nums">
            {raceClock(s.finished ? s.projected : s.t)}
          </CardTitle>
          <CardAction>
            <Badge variant={s.finished ? 'default' : 'secondary'}>
              {s.finished ? '완주' : '레이스 중'}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Progress value={(s.distance / race.distance) * 100} />
          <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>
              {km(s.distance)} / {race.distance} km
            </span>
            {s.next && !s.finished && (
              <span>
                {s.next.label}까지 {km(s.next.inKm)} km
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Stat
          label={s.finished ? '마지막 1km 페이스' : '현재 페이스'}
          value={`${pace(s.currentPace)}/km`}
        />
        <Stat label="평균 페이스" value={`${pace(s.avgPace)}/km`} />
        <Stat
          label="전체 순위"
          value={`${s.rank.toLocaleString()} / ${s.total.toLocaleString()}`}
        />
        <Stat
          label={s.finished ? '완주 기록' : '예상 완주'}
          value={raceClock(s.projected)}
        />
      </div>
      <p className="px-1 text-xs text-muted-foreground tabular-nums">
        상위 {Math.max(1, Math.round((s.rank / s.total) * 100))}%
        {s.gapAhead !== null &&
          (s.gapAhead < 0.001
            ? ' · 앞 주자와 나란히'
            : ` · 앞 주자와 ${Math.round(s.gapAhead * 1000)}m`)}
      </p>

      <Card>
        <CardHeader>
          <CardTitle>순위</CardTitle>
          <CardDescription>상위 3명과 내 주변</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">순위</TableHead>
                <TableHead>이름</TableHead>
                <TableHead className="text-right">기록·거리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="tabular-nums">
              {s.board.map((r, i) => (
                <TableRow
                  key={r.bib}
                  data-state={r.bib === bib ? 'selected' : undefined}
                  className={
                    i > 0 && r.rank - s.board[i - 1].rank > 1
                      ? 'border-t-4'
                      : undefined
                  }
                >
                  <TableCell>{r.rank}</TableCell>
                  <TableCell className="font-medium">
                    {r.bib === bib ? `나 (${r.bib})` : r.name}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.finish !== null
                      ? raceClock(r.finish)
                      : `${km(r.distance)} km`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>구간 기록</CardTitle>
          {avg !== null && (
            <CardDescription className="tabular-nums">
              구간 평균 {pace(avg)}/km
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {s.splits.length === 0 ? (
            <p className="text-muted-foreground">첫 1km를 달리는 중이에요.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>구간</TableHead>
                  <TableHead className="text-right">페이스</TableHead>
                  <TableHead className="text-right">평균 대비</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="tabular-nums">
                {s.splits.map((sp) => {
                  const diff = Math.round(sp.time - avg!)
                  return (
                    <TableRow key={sp.km}>
                      <TableCell>{sp.km} km</TableCell>
                      <TableCell className="text-right">
                        {pace(sp.time)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {diff === 0
                          ? '±0초'
                          : `${diff > 0 ? '+' : ''}${diff}초`}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
        <span>시연 데이터 · 실제 기록칩 연동 전</span>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={speed}
          onValueChange={(v) => v && setSpeed(v)}
          aria-label="시연 속도"
        >
          <ToggleGroupItem value="1">1×</ToggleGroupItem>
          <ToggleGroupItem value="30">30×</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  )
}
