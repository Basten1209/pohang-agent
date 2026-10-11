import { useMemo } from 'react'
import { Flag, Pause, Play, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GullPose } from '#/brand/brand'
import { useRace } from './use-race'
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
import { bib, category, race } from './mock'

const km = (d: number) => d.toFixed(2)

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-0.5 rounded-lg bg-muted/50 p-3">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-lg font-semibold tabular-nums">{value}</span>
  </div>
)

/** A deliberately simulated start → tracking → finish, scoped to this trip. */
export const RaceLive = ({
  finished = false,
  tripId,
  onFinish,
}: {
  finished?: boolean
  tripId: string
  onFinish: () => void
}) => {
  const { session, elapsed, act } = useRace(tripId, finished)
  const s = useMemo(
    () =>
      snapshot(race, finished ? timeAt(race.me.paces, race.distance) : elapsed),
    [elapsed, finished],
  )
  const ready = session.status === 'READY' && !finished
  const paused = session.status === 'PAUSED' && !finished
  const complete = () => {
    act('FINISH')
    onFinish()
  }
  const avg = s.splits.length
    ? s.splits.reduce((a, b) => a + b.time, 0) / s.splits.length
    : null

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="brand-heading text-2xl">
          {ready
            ? '오늘의 레이스'
            : s.finished
              ? '끝까지 달린 나에게'
              : '나의 레이스'}
        </h1>
        <Badge variant="secondary">시연 트래킹 · GPS 미사용</Badge>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        거리·페이스·순위는 더미 데이터예요. 실제 위치나 기록칩을 측정하지
        않아요.
      </p>
      {ready ? (
        <Card className="overflow-hidden border-primary/15">
          <CardHeader className="text-center">
            <CardDescription>
              {category} · 배번 {bib}
            </CardDescription>
            <CardTitle className="text-2xl">
              첫 걸음부터, 함께 달려요.
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <GullPose className="w-48" />
            <div className="flex w-full justify-around rounded-2xl bg-muted p-4 text-center">
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  0.00 <span className="text-sm font-normal">km</span>
                </p>
                <span className="text-xs text-muted-foreground">달린 거리</span>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">0:00</p>
                <span className="text-xs text-muted-foreground">경과 시간</span>
              </div>
            </div>
            <Button
              size="lg"
              className="min-h-12 w-full"
              onClick={() => act('START')}
            >
              <Play />
              마라톤 시작하기
            </Button>
            <p className="text-xs text-muted-foreground">
              시작한 뒤 60배속·마지막 1km 시연으로 빠르게 볼 수 있어요.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden border-primary/20">
            <CardHeader>
              <CardDescription>
                {category} · 배번 {bib}
              </CardDescription>
              <CardTitle className="text-5xl font-extrabold tabular-nums">
                {km(s.distance)}{' '}
                <span className="text-lg font-medium text-muted-foreground">
                  km
                </span>
              </CardTitle>
              <CardAction>
                <Badge variant={s.finished ? 'default' : 'secondary'}>
                  {s.finished ? '완주' : paused ? '일시정지' : '달리는 중'}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="race-track rounded-2xl px-3 py-4">
                <div className="flex justify-between text-xs font-medium">
                  <span>시연 코스 진행도</span>
                  <span>{Math.round((s.distance / race.distance) * 100)}%</span>
                </div>
                <svg
                  viewBox="0 0 320 100"
                  className="w-full"
                  role="img"
                  aria-label={`10km 코스 중 ${km(s.distance)}km 진행. 실제 위치 지도가 아닙니다.`}
                >
                  <path
                    d="M 20 50 H 300"
                    stroke="#c4d8e4"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                  <path
                    d={`M 20 50 H ${20 + (s.distance / race.distance) * 280}`}
                    stroke="#00a6b4"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                  {[0, 2.5, 5, 7.5, 10].map((d) => (
                    <g key={d}>
                      <circle
                        cx={20 + d * 28}
                        cy="50"
                        r="5"
                        fill={s.distance >= d ? '#005cb9' : '#fff'}
                      />
                      <text
                        x={20 + d * 28}
                        y="79"
                        textAnchor="middle"
                        fontSize="11"
                        fill="#526579"
                      >
                        {d === 0 ? '출발' : d === 10 ? '완주' : `${d}km`}
                      </text>
                    </g>
                  ))}
                  <circle
                    cx={20 + (s.distance / race.distance) * 280}
                    cy="50"
                    r="10"
                    fill="#102a43"
                    stroke="#fff"
                    strokeWidth="3"
                  />
                </svg>
                <p className="text-xs text-muted-foreground">
                  {s.next && !s.finished
                    ? `${s.next.label}까지 ${km(s.next.inKm)}km`
                    : '결승선에 도착했어요!'}
                </p>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {s.finished ? '완주 기록' : '경과 시간'}
                </span>
                <strong className="text-2xl tabular-nums">
                  {raceClock(s.finished ? s.projected : s.t)}
                </strong>
              </div>
              <Progress
                value={(s.distance / race.distance) * 100}
                aria-label="완주 진행률"
              />
              {!s.finished && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    onClick={() => act(paused ? 'RESUME' : 'PAUSE')}
                  >
                    {paused ? <Play /> : <Pause />}
                    {paused ? '이어서 달리기' : '일시정지'}
                  </Button>
                  <ToggleGroup
                    type="single"
                    size="sm"
                    variant="outline"
                    value={String(session.speed)}
                    onValueChange={(v) => {
                      if (v) act(v === '60' ? 60 : 1)
                    }}
                    aria-label="시연 속도"
                  >
                    <ToggleGroupItem value="1">1×</ToggleGroupItem>
                    <ToggleGroupItem value="60">60×</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              )}
            </CardContent>
          </Card>
          {!s.finished && (
            <Button
              variant="outline"
              onClick={() => act('FINAL_KM')}
              disabled={s.distance >= 9}
            >
              <SkipForward />
              마지막 1km로 이동 · 시연
            </Button>
          )}
          {s.finished && (
            <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-2">
              <GullPose pose="cheer" className="w-24 shrink-0" />
              <div>
                <p className="font-bold">완주 축하해요!</p>
                <p className="text-sm text-muted-foreground">
                  이제 달린 만큼 쉬고, 구룡포를 만나요.
                </p>
              </div>
            </div>
          )}
          <Button
            size="lg"
            className="min-h-12 w-full whitespace-normal text-center"
            onClick={complete}
          >
            <Flag />
            {finished
              ? '완주의 순간 공유 · 여행 준비하기'
              : '마라톤 완주! 구룡포 여행으로 떠나요'}
          </Button>
          {!s.finished && (
            <p className="-mt-2 text-center text-xs text-muted-foreground">
              완주 버튼으로 시연을 마치고 다음 단계를 볼 수 있어요.
            </p>
          )}
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

          <details className="flex flex-col gap-4">
            <summary className="cursor-pointer py-3 text-sm font-semibold">
              시연 순위 · 구간 기록 보기
            </summary>
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
                  <p className="text-muted-foreground">
                    첫 1km를 달리는 중이에요.
                  </p>
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
          </details>
        </>
      )}
    </div>
  )
}
