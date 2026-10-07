import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  BusFront,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coffee,
  Flag,
  Footprints,
  Heart,
  MapPin,
  Meh,
  Smile,
  Sparkles,
  TrainFront,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Checkbox } from '#/components/ui/checkbox'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { canTravel } from '#/core/planner'
import type { Plan } from '#/core/schema'
import { clock, minutes } from '#/core/time'
import {
  accept,
  advance,
  createTrip,
  navigate,
  restMore,
  skipStop,
  startReturn,
} from '#/core/trip'
import { toggle } from '#/core/fp'
import { cn } from '#/lib/utils'
import { AgentPanel } from './agent-panel'
import { Dot, Eyebrow, PageHeading, PlaceIcon, SectionTitle } from './bits'
import {
  AdjustCard,
  DataStrip,
  ItineraryList,
  RouteMap,
  TicketCard,
  TripStats,
} from './cards'
import { useApp } from './context'

const patch = (p: Partial<Plan>) => ({
  events: [{ type: 'plan.patched' as const, patch: p }],
})

/** Two columns on wide screens, one on phones. */
const Columns = ({
  main,
  rail,
}: {
  main: React.ReactNode
  rail: React.ReactNode
}) => (
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
    <div className="min-w-0 space-y-4">{main}</div>
    <aside className="min-w-0 space-y-4 lg:sticky lg:top-24">{rail}</aside>
  </div>
)

// ── S1 내 하루 만들기 ─────────────────────────────────────────────────────

export const PlanScreen = () => {
  const { state, config, run } = useApp()
  const { plan } = state
  const places = config.places.filter((p) => p.active)
  return (
    <div className="space-y-5">
      <PageHeading
        eyebrow="YOUR RUN, YOUR LITTLE TRIP"
        title={
          <>
            완주 다음엔,
            <br />
            구룡포 어때요<span className="text-harbor">?</span>
          </>
        }
        lead="잘 달린 하루에 작은 여행을 더해요. 돌아갈 기차 시간까지, 우리가 함께 계산할게요."
      />
      <Columns
        main={
          <div className="relative overflow-hidden rounded-3xl">
            <img
              src="/images/guryongpo-harbor.jpg"
              alt="바다와 어선이 있는 구룡포항 전경"
              className="aspect-[4/3] w-full object-cover lg:aspect-[16/11]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 space-y-2 p-5 text-primary-foreground">
              <p className="text-xs text-primary-foreground/80">
                달리기만 하고 돌아가기엔 아쉬우니까.
              </p>
              <p className="text-xl font-extrabold leading-snug">
                항구 앞 한 끼, 골목에서 만나는 포항.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {places.map((p) => (
                  <Badge
                    key={p.id}
                    className="gap-1 bg-primary-foreground/15 text-primary-foreground"
                  >
                    <PlaceIcon name={p.attrs.icon} className="size-3" />{' '}
                    {p.attrs.interestLabel}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        }
        rail={
          <Card className="py-5">
            <CardContent className="space-y-4 px-5">
              <div>
                <Eyebrow>LET’S MAKE A DAY</Eyebrow>
                <h2 className="mt-1 text-lg font-extrabold text-primary">
                  민준님의 하루를 준비해요
                </h2>
                <p className="text-sm text-muted-foreground">
                  예약한 열차 시각만 알려주세요.
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-secondary p-3">
                <Flag className="size-5 text-harbor" />
                <div className="text-sm">
                  <p className="font-bold text-primary">
                    포항 해안 러닝 · 10km
                  </p>
                  <p className="text-xs text-muted-foreground">
                    10월 13일 09:00 · 영일대 인근 · 가상 행사
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="arrival">포항에 도착하는 시간</Label>
                <Input
                  id="arrival"
                  type="datetime-local"
                  max="2026-10-13T08:59"
                  value={plan.arrivalAt}
                  onChange={(e) =>
                    e.target.value && run(patch({ arrivalAt: e.target.value }))
                  }
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="train-time">
                  서울행 열차 출발{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    10월 13일 · 포항역
                  </span>
                </Label>
                <Input
                  id="train-time"
                  type="time"
                  value={plan.trainTime}
                  onChange={(e) =>
                    e.target.value && run(patch({ trainTime: e.target.value }))
                  }
                  className="h-12 text-base"
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  완주 후, 하고 싶은 일
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {places.map((p) => {
                    const on = plan.interests.includes(p.id)
                    return (
                      <Button
                        key={p.id}
                        type="button"
                        variant={on ? 'default' : 'outline'}
                        aria-pressed={on}
                        className="h-auto flex-col gap-1 py-3 text-xs"
                        onClick={() =>
                          run(
                            patch({ interests: toggle(plan.interests, p.id) }),
                          )
                        }
                      >
                        <PlaceIcon name={p.attrs.icon} />
                        {p.attrs.interestLabel}
                      </Button>
                    )
                  })}
                </div>
              </fieldset>
              <details className="rounded-2xl border p-3 text-sm">
                <summary className="cursor-pointer font-medium">
                  숙소·짐 회수 계획{' '}
                  <span className="text-xs text-muted-foreground">
                    선택사항
                  </span>
                </summary>
                <div className="mt-3 grid gap-2">
                  {(
                    [
                      ['RACE', '영일대 대회장 · 짐을 가지고 이동'],
                      ['HOTEL', '영일대 인근 숙소 · 짐 회수 후 출발'],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      variant={plan.origin === value ? 'default' : 'outline'}
                      className="justify-start"
                      onClick={() =>
                        run(patch({ origin: value, currentPlace: value }))
                      }
                    >
                      {label}
                    </Button>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    숙소는 영일대 권역으로 가정해요. 실제 숙소 주소·행사
                    집결지는 확인이 필요해요.
                  </p>
                </div>
              </details>
              <Button
                className="h-12 w-full text-base"
                onClick={() => run(createTrip(config, state))}
              >
                내 하루 만들기 <ArrowRight />
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <BusFront className="size-3.5" /> 현지 이동은 버스를 기본으로
                준비해요.
              </p>
            </CardContent>
          </Card>
        }
      />
    </div>
  )
}

// ── S2 내 하루 ────────────────────────────────────────────────────────────

const phases = [
  {
    title: '포항에 도착하면 알려주세요',
    lead: '내일의 달리기를 위해 오늘은 영일대 근처에서 쉬어가요.',
  },
  {
    title: '가볍게 준비하고, 출발해 볼까요?',
    lead: '09:00 출발 · 영일대 인근 집결지 (가상 행사)',
  },
  {
    title: '지금은 달리기에 집중해요',
    lead: '도착하면 다시 만나요. 오늘의 작은 여행이 기다리고 있어요.',
  },
]
const checklist = [
  '배번호와 러닝화',
  '마실 물과 작은 간식',
  '완주 후 짐 회수 계획',
]

export const DayScreen = () => {
  const { state, run, map } = useApp()
  const phase = phases[state.phase]
  const timeline: [string, string, string, LucideIcon][] = [
    [
      `전날 ${state.plan.arrivalAt.slice(11)}`,
      '포항역 도착',
      '영일대 근처 숙소에서 하룻밤',
      TrainFront,
    ],
    ['09:00', '영일대, 10km 달리기', '내 페이스대로 끝까지', Flag],
    [
      '완주 후',
      '구룡포에서 작은 여행',
      '컨디션을 확인한 뒤 코스를 정해요',
      MapPin,
    ],
    [
      state.plan.trainTime,
      '포항역에서 서울로',
      '출발 30분 전 역 도착 목표',
      TrainFront,
    ],
  ]
  return (
    <div className="space-y-5">
      <PageHeading
        eyebrow="A GOOD DAY TO RUN & WANDER"
        title={
          <>
            민준님, 포항에서의
            <br />
            하루가 기다려요
            <Dot />
          </>
        }
        lead="달리기부터 여행까지, 한 번에 한 걸음씩."
        aside={
          <Badge variant="secondary" className="hidden gap-1 sm:flex">
            <CalendarDays className="size-3.5" /> 2026. 10. 12 — 13
          </Badge>
        }
      />
      <Columns
        main={
          <>
            <Card className="border-0 bg-primary py-5 text-primary-foreground">
              <CardContent className="space-y-4 px-5">
                <Eyebrow className="text-lime">지금 할 일</Eyebrow>
                <h2 className="text-xl font-extrabold">{phase.title}</h2>
                <p className="text-sm text-primary-foreground/75">
                  {phase.lead}
                </p>
                {state.phase === 0 && (
                  <Button
                    className="bg-lime text-lime-foreground hover:bg-lime/90"
                    onClick={() =>
                      run({ events: [{ type: 'day.advanced', phase: 1 }] })
                    }
                  >
                    포항에 도착했어요 <Check />
                  </Button>
                )}
                {state.phase === 1 && (
                  <>
                    <div className="space-y-2">
                      {checklist.map((text, i) => (
                        <label
                          key={text}
                          className="flex items-center gap-3 rounded-xl bg-primary-foreground/10 px-3 py-2.5 text-sm"
                        >
                          <Checkbox
                            checked={state.checks[i]}
                            onCheckedChange={() =>
                              run({
                                events: [
                                  { type: 'day.checkToggled', index: i },
                                ],
                              })
                            }
                            className="border-primary-foreground/50 data-[state=checked]:bg-lime data-[state=checked]:text-lime-foreground"
                          />
                          {text}
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        className="bg-lime text-lime-foreground hover:bg-lime/90"
                        onClick={() =>
                          run({ events: [{ type: 'day.advanced', phase: 2 }] })
                        }
                      >
                        출발해요 <ArrowRight />
                      </Button>
                      <a
                        href={map('RACE')}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-sm text-primary-foreground/80 underline-offset-4 hover:underline"
                      >
                        집결지 권역 보기 <ArrowUpRight className="size-4" />
                      </a>
                    </div>
                  </>
                )}
                {state.phase === 2 && (
                  <Button
                    className="bg-lime text-lime-foreground hover:bg-lime/90"
                    onClick={() =>
                      run({
                        events: [{ type: 'screen.changed', screen: 'finish' }],
                      })
                    }
                  >
                    완주했어요! <Flag />
                  </Button>
                )}
              </CardContent>
            </Card>
            <Card className="py-5">
              <CardContent className="space-y-4 px-5">
                <SectionTitle
                  title="나의 하루"
                  meta="버스와 기차로 잇는 여행"
                />
                <ol className="space-y-4">
                  {timeline.map(([time, title, desc, Icon]) => (
                    <li key={title} className="flex gap-3">
                      <span className="w-16 shrink-0 pt-1 text-xs font-semibold text-muted-foreground">
                        {time}
                      </span>
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                        <Icon className="size-4" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-primary">
                          {title}
                        </p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </>
        }
        rail={
          <>
            <Card className="gap-0 overflow-hidden py-0">
              <img
                src="/images/guryongpo-street.jpg"
                alt="구룡포 일본인 가옥거리"
                className="aspect-[16/9] w-full object-cover"
              />
              <CardContent className="space-y-3 p-5">
                <Eyebrow>완주 후 여행 후보</Eyebrow>
                <h2 className="text-lg font-extrabold text-primary">
                  기념 메달 옆에, 구룡포의 추억 하나.
                </h2>
                <p className="text-sm text-muted-foreground">
                  점심 한 끼, 짧은 골목 구경, 그리고 커피. 완주 후 몸 상태에
                  맞춰 다시 살펴봐요.
                </p>
                <Button
                  variant={state.candidate ? 'secondary' : 'default'}
                  className="w-full"
                  onClick={() =>
                    run({
                      events: [{ type: 'candidate.toggled' }],
                      notice: state.candidate
                        ? '후보에서 뺐어요.'
                        : '완주 후 다시 확인할 코스로 담았어요.',
                    })
                  }
                >
                  {state.candidate ? <Check /> : <Bookmark />}
                  {state.candidate
                    ? '완주 후 후보로 담았어요'
                    : '완주 후 후보로 담기'}
                </Button>
              </CardContent>
            </Card>
            <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Heart className="size-4 text-harbor" /> 지금 방문을 결정하지
              않아도 괜찮아요. 완주 후의 컨디션이 먼저니까요.
            </p>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() =>
                run({ events: [{ type: 'screen.changed', screen: 'finish' }] })
              }
            >
              시연: 완주 직후로 이동 <ArrowRight />
            </Button>
          </>
        }
      />
    </div>
  )
}

// ── S3 완주 후 확인 ──────────────────────────────────────────────────────

const conditions: [Plan['condition'], string, LucideIcon][] = [
  ['OK', '괜찮아요', Smile],
  ['TIRED', '조금 지쳤어요', Meh],
  ['UNWELL', '몸이 안 좋아요', Activity],
]

const Question = ({
  n,
  children,
}: {
  n: string
  children: React.ReactNode
}) => (
  <legend className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
    <span className="text-xs text-harbor">{n}</span>
    {children}
  </legend>
)

export const FinishScreen = () => {
  const { state, run } = useApp()
  const { plan } = state
  const ready = plan.condition !== 'UNANSWERED' && plan.baggageCollected
  return (
    <div className="space-y-5">
      <PageHeading
        eyebrow="YOU DID IT, FINISHER!"
        title={
          <>
            10km, 잘 달렸어요<span className="text-harbor">!</span>
          </>
        }
        lead="다음 여행은 지금의 컨디션에 맞출게요. 잠깐 숨을 고르고, 세 가지만 알려주세요."
      />
      <Columns
        main={
          <Card className="py-5">
            <CardContent className="space-y-6 px-5">
              <fieldset>
                <Question n="01">지금 상태는 어떤가요?</Question>
                <div className="grid grid-cols-3 gap-2">
                  {conditions.map(([value, label, Icon]) => (
                    <Button
                      key={value}
                      variant={plan.condition === value ? 'default' : 'outline'}
                      aria-pressed={plan.condition === value}
                      className={cn(
                        'h-auto flex-col gap-2 py-4 text-xs',
                        value === 'UNWELL' &&
                          plan.condition === value &&
                          'bg-destructive hover:bg-destructive/90',
                      )}
                      onClick={() => run(patch({ condition: value }))}
                    >
                      <Icon className="size-6" />
                      {label}
                    </Button>
                  ))}
                </div>
              </fieldset>
              {plan.condition === 'UNWELL' ? (
                <div
                  role="alert"
                  className="space-y-3 rounded-2xl bg-destructive/10 p-4 text-sm"
                >
                  <Activity className="size-6 text-destructive" />
                  <h2 className="text-lg font-extrabold text-destructive">
                    지금은 몸을 먼저 살펴주세요.
                  </h2>
                  <p>
                    관광 계획을 잠시 멈췄어요. 현장 의료부스나 운영요원에게
                    도움을 요청해 주세요.
                  </p>
                  <Button asChild variant="destructive" className="w-full">
                    <a href="tel:119">긴급한 도움이 필요하면 119</a>
                  </Button>
                </div>
              ) : (
                <>
                  <fieldset>
                    <Question n="02">얼마나 걷고 싶나요?</Question>
                    <div className="grid grid-cols-2 gap-2">
                      {([15, 30] as const).map((v) => (
                        <Button
                          key={v}
                          variant={
                            plan.walkingLimit === v ? 'default' : 'outline'
                          }
                          aria-pressed={plan.walkingLimit === v}
                          className="h-auto flex-col items-start gap-0.5 px-4 py-3 text-left"
                          onClick={() => run(patch({ walkingLimit: v }))}
                        >
                          <span className="flex items-center gap-1.5 font-bold">
                            <Footprints className="size-4" /> {v}분 이내
                          </span>
                          <span className="text-xs opacity-75">
                            {v === 15
                              ? '걷기는 최소한으로'
                              : '짧은 구경은 좋아요'}
                          </span>
                        </Button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      정류장과 장소 사이를 걷는 시간도 포함해요.
                    </p>
                  </fieldset>
                  <fieldset className="space-y-3">
                    <Question n="03">언제 출발할 수 있나요?</Question>
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1.5">
                        <Label htmlFor="ready">출발 준비 완료 시각</Label>
                        <Input
                          id="ready"
                          type="time"
                          value={plan.readyTime}
                          onChange={(e) =>
                            e.target.value &&
                            run(
                              patch({
                                readyTime: e.target.value,
                                currentTime: e.target.value,
                              }),
                            )
                          }
                          className="h-12 text-base"
                        />
                      </div>
                      <Button
                        variant="secondary"
                        className="h-12"
                        onClick={() => {
                          const t = clock(minutes(plan.readyTime) + 30)
                          run(patch({ readyTime: t, currentTime: t }))
                        }}
                      >
                        30분 더 준비
                      </Button>
                    </div>
                    <label className="flex items-center gap-3 text-sm">
                      <Checkbox
                        checked={plan.baggageCollected}
                        onCheckedChange={(v) =>
                          run(patch({ baggageCollected: v === true }))
                        }
                      />
                      출발 전에 짐을 모두 챙길 수 있어요
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {plan.origin === 'HOTEL'
                        ? '숙소에서 짐을 찾고 영일대 권역에서 출발하는 시각이에요.'
                        : '휴식과 짐 회수를 모두 마친 뒤의 시각이에요.'}
                    </p>
                  </fieldset>
                  <Button
                    className="h-12 w-full text-base"
                    disabled={!ready}
                    onClick={() =>
                      run({
                        events: [{ type: 'screen.changed', screen: 'course' }],
                      })
                    }
                  >
                    지금 가능한 코스 보기 <ArrowRight />
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        }
        rail={
          <>
            <TicketCard />
            <Card className="gap-0 overflow-hidden py-0">
              <CardContent className="space-y-1 p-5">
                <Heart className="size-5 text-harbor" />
                <h3 className="font-bold text-primary">
                  오늘은 충분히 달렸으니까.
                </h3>
                <p className="text-sm text-muted-foreground">
                  많이 걷는 여행 대신, 앉아서 즐기는 시간을 넉넉히 둘게요.
                </p>
              </CardContent>
            </Card>
          </>
        }
      />
    </div>
  )
}

// ── S4 구룡포 코스 ───────────────────────────────────────────────────────

export const CourseScreen = () => {
  const { state, itinerary: it, run, open, config, map } = useApp()
  const travel = canTravel(it)
  const names = it.stops
    .map((s) => config.places.find((p) => p.id === s.id)?.attrs.short)
    .join('  →  ')
  return (
    <div className="space-y-5">
      <PageHeading
        eyebrow="THE FINISH LINE IS A NEW START"
        title={
          <>
            잘 달렸어요. 이제, 구룡포
            <Dot />
          </>
        }
        lead="맛있는 한 끼와 짧은 구경. 민준님의 페이스에 맞춘 여행이에요."
      />
      <Columns
        main={
          <>
            {travel ? (
              <>
                <div className="relative overflow-hidden rounded-3xl">
                  <img
                    src="/images/guryongpo-harbor.jpg"
                    alt="구룡포항의 바다와 항구 마을"
                    className="aspect-[4/3] w-full object-cover sm:aspect-[16/9]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/10 to-transparent" />
                  <Badge className="absolute top-3 left-3 gap-1 bg-card/90 text-primary">
                    <MapPin className="size-3" /> 구룡포, 포항
                  </Badge>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute top-3 right-3 rounded-full bg-card/90"
                    aria-label={
                      state.candidate ? '후보 저장 해제' : '코스 후보 저장'
                    }
                    onClick={() =>
                      run({
                        events: [{ type: 'candidate.toggled' }],
                        notice: state.candidate
                          ? '저장한 후보를 해제했어요.'
                          : '코스를 후보로 저장했어요.',
                      })
                    }
                  >
                    <Bookmark
                      className={cn(state.candidate && 'fill-current')}
                    />
                  </Button>
                  <div className="absolute inset-x-0 bottom-0 space-y-1 p-5 text-primary-foreground">
                    <Badge className="bg-lime text-lime-foreground">
                      {it.decision === 'GO'
                        ? '오늘의 추천 코스'
                        : it.decision === 'INDOOR'
                          ? '앉아서 즐기는 코스'
                          : '시간에 맞춘 짧은 코스'}
                    </Badge>
                    <h2 className="text-xl font-extrabold leading-snug">
                      {it.stops.length === 1
                        ? '점심 한 끼에도, 구룡포는 남으니까.'
                        : '바다 마을에서 보내는 느긋한 완주 후 한때.'}
                    </h2>
                    <p className="text-xs text-primary-foreground/80">
                      {names}
                    </p>
                  </div>
                </div>
                <TripStats />
                <button
                  type="button"
                  onClick={() => open('why')}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-2xl p-4 text-left text-sm',
                    it.decision === 'GO'
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-harbor/10 text-primary',
                  )}
                  aria-label="코스 추천 이유 자세히"
                >
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-harbor" />
                  <span className="flex-1 leading-relaxed">
                    {it.reasons.join(' ')}
                  </span>
                  <ChevronRight className="size-4 shrink-0" />
                </button>
                <ItineraryList />
                <RouteMap />
              </>
            ) : (
              <Card className="py-6">
                <CardContent className="space-y-3 px-5 text-center">
                  <span className="mx-auto grid size-14 place-items-center rounded-full bg-secondary text-primary">
                    {it.decision === 'MEDICAL_FIRST' ? (
                      <Heart className="size-7" />
                    ) : (
                      <Clock3 className="size-7" />
                    )}
                  </span>
                  <Eyebrow>TAKE IT AT YOUR OWN PACE</Eyebrow>
                  <h2 className="text-xl font-extrabold text-primary">
                    {it.decision === 'MEDICAL_FIRST'
                      ? '오늘은 몸이 먼저예요.'
                      : it.decision === 'NEEDS_DATA'
                        ? '이동 경로 확인이 필요해요.'
                        : it.decision === 'INCOMPLETE'
                          ? '출발 조건을 먼저 확인해요.'
                          : '오늘은 귀가를 먼저 챙겨요.'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {it.reasons.join(' ')}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button onClick={() => run(navigate(state, 'finish'))}>
                      내 조건 다시 확인
                    </Button>
                    <Button asChild variant="outline">
                      <a href={map('STATION')} target="_blank" rel="noreferrer">
                        포항역 길찾기 <ArrowUpRight />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            <DataStrip />
            <p className="px-1 text-xs text-muted-foreground">
              시연 코스 · 이동시간과 관측값은 가정값이에요. 실제 버스편·상점
              영업·보행 경로는 확인이 필요해요.
            </p>
          </>
        }
        rail={
          <>
            <TicketCard />
            <AdjustCard />
            <AgentPanel />
            <Button
              className="hidden h-12 w-full text-base lg:flex"
              disabled={!travel}
              onClick={() => run(accept(state, it))}
            >
              이 코스로 갈게요 <ArrowRight />
            </Button>
          </>
        }
      />
    </div>
  )
}

// ── S5 다음 행동 ──────────────────────────────────────────────────────────

export const NextScreen = () => {
  const { state, itinerary: it, run, config, map, open } = useApp()
  const { plan } = state
  const next = it.stops[0]
    ? config.places.find((p) => p.id === it.stops[0].id)
    : undefined
  const travel = canTravel(it)

  if (plan.stage === 'DONE')
    return (
      <div className="space-y-5">
        <PageHeading
          eyebrow="ONE LITTLE STEP AT A TIME"
          title="달리고, 머물고, 기억한 하루."
          lead="민준님의 작은 구룡포 여행을 마쳤어요."
        />
        <Card className="py-6">
          <CardContent className="space-y-4 px-5 text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-lime text-lime-foreground">
              <Check className="size-8" />
            </span>
            <Eyebrow>A RUN TO REMEMBER</Eyebrow>
            <h2 className="text-xl font-extrabold text-primary">
              완주 너머의 추억도, 잘 챙겼어요.
            </h2>
            <p className="text-sm text-muted-foreground">
              직접 도착을 확인한 여행이에요. 오늘 다녀온 장소들을 오래 기억해
              주세요.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {plan.completed.map((id) => {
                const p = config.places.find((x) => x.id === id)
                return p ? (
                  <Badge key={id} variant="secondary" className="gap-1">
                    <PlaceIcon name={p.attrs.icon} className="size-3" />{' '}
                    {p.attrs.short}
                  </Badge>
                ) : null
              })}
            </div>
            <p className="flex items-center justify-center gap-2 rounded-2xl bg-secondary p-3 text-sm font-semibold text-primary">
              <TrainFront className="size-4" /> 포항역 도착 {plan.currentTime} ·
              서울행 {plan.trainTime}
            </p>
            <Button onClick={() => open('demo')}>
              다른 시나리오 둘러보기 <ArrowRight />
            </Button>
          </CardContent>
        </Card>
      </div>
    )

  const headline =
    plan.stage === 'OUTBOUND'
      ? '첫 목적지, 구룡포시장'
      : plan.stage === 'RETURN'
        ? '이제 포항역으로 가요'
        : !travel || !next
          ? '포항역으로 돌아갈 시간이에요'
          : next.attrs.short
  const lead =
    plan.stage === 'OUTBOUND'
      ? '버스 경로와 승차 정류장은 외부 지도에서 확인해 주세요.'
      : plan.stage === 'RETURN'
        ? '열차 탑승 전까지 여유 있게 이동해요.'
        : next
          ? next.attrs.desc
          : '남은 관광 대신 귀가 동선을 먼저 확인해요.'
  const actionable =
    plan.stage === 'OUTBOUND' || plan.stage === 'RETURN' || it.stops.length > 0
  const destination =
    plan.stage === 'OUTBOUND'
      ? 'GURYONGPO'
      : plan.stage === 'RETURN'
        ? 'STATION'
        : (it.stops[0]?.id ?? 'STATION')

  return (
    <div className="space-y-5">
      <PageHeading
        eyebrow="ONE LITTLE STEP AT A TIME"
        title={
          plan.stage === 'RETURN'
            ? '좋은 기억을 안고, 포항역으로.'
            : '다음 한 걸음만 생각해요.'
        }
        lead="남은 일정과 돌아갈 시간은 계속 함께 살펴볼게요."
        aside={
          <Badge variant="secondary" className="gap-1">
            <Clock3 className="size-3.5" /> 시연 {plan.currentTime}
          </Badge>
        }
      />
      <Columns
        main={
          <>
            <Card className="border-0 bg-primary py-5 text-primary-foreground">
              <CardContent className="space-y-4 px-5">
                <div className="flex items-center justify-between">
                  <Eyebrow className="text-lime">
                    {plan.stage === 'OUTBOUND'
                      ? '구룡포로 이동 중'
                      : plan.stage === 'RETURN'
                        ? '포항역으로 귀가 중'
                        : '구룡포에 머무는 중'}
                  </Eyebrow>
                  <span className="size-2.5 animate-pulse rounded-full bg-lime" />
                </div>
                <span className="grid size-14 place-items-center rounded-2xl bg-primary-foreground/10">
                  {plan.stage === 'OUTBOUND' ? (
                    <BusFront className="size-7" />
                  ) : plan.stage === 'RETURN' ? (
                    <TrainFront className="size-7" />
                  ) : next ? (
                    <PlaceIcon name={next.attrs.icon} className="size-7" />
                  ) : (
                    <CheckCircle2 className="size-7" />
                  )}
                </span>
                <h2 className="text-2xl font-extrabold">{headline}</h2>
                <p className="text-sm text-primary-foreground/75">{lead}</p>
                {actionable && (
                  <div className="grid gap-2">
                    <Button
                      asChild
                      className="h-12 bg-lime text-lime-foreground hover:bg-lime/90"
                    >
                      <a
                        href={map(
                          destination,
                          plan.stage === 'LOCAL' ? 'walk' : 'traffic',
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {plan.stage === 'LOCAL'
                          ? '다음 장소 길찾기'
                          : '대중교통 경로 열기'}{' '}
                        <ArrowUpRight />
                      </a>
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-12 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
                      onClick={() => run(advance(config, state, it))}
                    >
                      {plan.stage === 'OUTBOUND'
                        ? '구룡포에 도착했어요'
                        : plan.stage === 'RETURN'
                          ? '역에 도착했어요'
                          : `${next?.attrs.actionLabel ?? '방문'} 마쳤어요`}
                      <Check />
                    </Button>
                  </div>
                )}
                <p className="text-[11px] text-primary-foreground/55">
                  시연 시각으로 직접 도착·완료를 확인해요. 위치를 추적하지
                  않아요.
                </p>
              </CardContent>
            </Card>
            {plan.stage === 'LOCAL' && it.stops.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => run(skipStop(state, it))}
                >
                  <ArrowRight /> 이 장소 건너뛰기
                </Button>
                <Button
                  variant="outline"
                  onClick={() => run(restMore(config, state))}
                >
                  <Coffee /> 30분 더 쉬기
                </Button>
              </div>
            )}
            {plan.stage !== 'RETURN' && <ItineraryList />}
            <RouteMap />
          </>
        }
        rail={
          <>
            <TicketCard />
            <AgentPanel />
            <Button
              variant="outline"
              className="h-12 w-full"
              onClick={() => run(startReturn(state))}
            >
              <TrainFront /> 포항역으로 돌아가기
            </Button>
            <DataStrip />
          </>
        }
      />
    </div>
  )
}
