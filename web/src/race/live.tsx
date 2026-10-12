import { Flag, Pause, Play, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GullPose } from '#/brand/brand'
import { useRace } from './use-race'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { pace, raceClock, snapshot, timeAt } from '#/core/race'
import { bib, category, race } from './mock'
import { RaceRouteMap } from './route-map'

const Stat = ({
  label,
  value,
  prominent = false,
}: {
  label: string
  value: string
  prominent?: boolean
}) => (
  <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-muted/50 p-3">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span
      className={`${prominent ? 'text-2xl sm:text-3xl' : 'text-lg'} font-bold tabular-nums text-[#102a43]`}
    >
      {value}
    </span>
  </div>
)

/** Personal route + metrics; all data is explicitly simulated, trip-scoped. */
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
  const s = snapshot(
    race,
    finished ? timeAt(race.paces, race.distance) : elapsed,
  )
  const ready = session.status === 'READY' && !finished
  const paused = session.status === 'PAUSED' && !finished
  const complete = () => {
    act('FINISH')
    onFinish()
  }

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
        <Badge variant="secondary">가상 GPS 시연</Badge>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        경로·거리·기록은 발표용 가상 데이터예요. 실제 GPS 위치를 수집하지
        않아요.
      </p>
      {ready ? (
        <Card className="overflow-visible border-primary/15">
          <CardHeader className="text-center">
            <CardDescription>
              {category} · 배번 {bib}
            </CardDescription>
            <CardTitle className="text-2xl">
              첫 걸음부터, 함께 달려요.
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <GullPose className="w-44 sm:w-48" />
            <div className="grid w-full grid-cols-2 gap-2 text-center">
              <Stat label="달린 거리" value="0.00 km" prominent />
              <Stat label="경과 시간" value="0:00" prominent />
            </div>
            <Button
              size="lg"
              className="min-h-12 w-full"
              onClick={() => act('START')}
            >
              <Play />
              마라톤 시작하기
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              시작하면 지도 위에 나의 이동 경로가 쌓여요.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="gap-3 overflow-hidden border-primary/20">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardDescription>
                {category} · 배번 {bib}
              </CardDescription>
              <Badge variant={s.finished ? 'default' : 'secondary'}>
                {s.finished ? '완주' : paused ? '일시정지' : '달리는 중'}
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <RaceRouteMap progress={s.distance / race.distance} />
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label="달린 거리"
                  value={`${s.distance.toFixed(2)} km`}
                  prominent
                />
                <Stat
                  label={s.finished ? '완주 기록' : '경과 시간'}
                  value={raceClock(s.elapsed)}
                  prominent
                />
                <Stat
                  label="내 평균 페이스"
                  value={s.avgPace === null ? '—' : `${pace(s.avgPace)}/km`}
                />
                <Stat
                  label={s.finished ? '완주 시간' : '예상 완주시간'}
                  value={s.projected === null ? '—' : raceClock(s.projected)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {s.finished
                  ? '10km 시연을 마쳤어요.'
                  : '예상 완주시간은 지금까지의 평균 페이스로 계산한 총 소요시간이에요.'}
              </p>
              {!s.finished && (
                <Button
                  variant="outline"
                  className="min-h-11 w-full"
                  onClick={() => act(paused ? 'RESUME' : 'PAUSE')}
                >
                  {paused ? <Play /> : <Pause />}
                  {paused ? '이어서 달리기' : '일시정지'}
                </Button>
              )}
            </CardContent>
          </Card>
          {!s.finished && (
            <details className="rounded-xl border bg-muted/30 px-4">
              <summary className="cursor-pointer py-3 text-sm font-medium">
                발표용 시연 조작
              </summary>
              <div className="flex flex-col gap-3 pb-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">
                    재생 속도
                  </span>
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
                <Button
                  variant="outline"
                  onClick={() => act('FINAL_KM')}
                  disabled={s.distance >= 9}
                >
                  <SkipForward />
                  마지막 1km로 이동 · 시연
                </Button>
              </div>
            </details>
          )}
          {s.finished && (
            <div className="mascot-panel mascot-message gap-3 rounded-2xl border border-primary/10 px-4 py-3">
              <GullPose pose="cheer" className="w-full" decorative />
              <div className="min-w-0">
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
        </>
      )}
    </div>
  )
}
