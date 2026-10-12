import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  CircleAlert,
  Clock,
  Coffee,
  Flag,
  HeartPulse,
  Info,
  MapPin,
  SkipForward,
  TrainFront,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { RadioGroup } from '@/components/ui/radio-group'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { canTravel } from '#/core/planner'
import type { Decision } from '#/core/planner'
import {
  activeCourses,
  courseById,
  departLabel,
  hubOf,
  modeOf,
} from '#/core/route'
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
import { Choice, PageHeader } from './bits'
import {
  AdjustCard,
  ItineraryCard,
  ObservationCard,
  StatsCard,
  TrainCard,
} from './cards'
import { useApp } from './context'

const patch = (p: Partial<Plan>) => ({
  events: [{ type: 'plan.patched' as const, patch: p }],
})
const go = (screen: 'finish' | 'course') => ({
  events: [{ type: 'screen.changed' as const, screen }],
})

/** One column on phones, main + side rail on wide screens. */
const Columns = ({ main, rail }: { main: ReactNode; rail: ReactNode }) => (
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
    <div className="flex min-w-0 flex-col gap-4">{main}</div>
    <aside className="flex min-w-0 flex-col gap-4">{rail}</aside>
  </div>
)

/** A radio option rendered as shadcn's choice card (FieldLabel > Field). */
// ── S1 내 하루 만들기 ─────────────────────────────────────────────────────

export const PlanScreen = () => {
  const { state, config, run } = useApp()
  const { plan } = state
  const mode = modeOf(config, plan)
  const interests = config.conversation.slots.interests?.choices ?? []
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <PageHeader
        title="완주 후 포항, 어디까지 다녀올 수 있을까요?"
        description="돌아가는 방법과 시각을 알려주면 완주 후 일정과 복귀 시간을 함께 계산해요."
      />
      <Card>
        <CardHeader>
          <CardTitle>내 하루 만들기</CardTitle>
          <CardDescription>
            {config.event.name} · {config.event.dateLabel} {config.event.gun} ·{' '}
            {config.event.venue} (가상 행사)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="arrival">포항 도착 시간</FieldLabel>
              <Input
                id="arrival"
                type="datetime-local"
                max={`${config.event.date}T${config.event.gun}`}
                value={plan.arrivalAt}
                onChange={(e) =>
                  e.target.value && run(patch({ arrivalAt: e.target.value }))
                }
              />
            </Field>
            <FieldSet>
              <FieldLegend variant="label">돌아가는 방법</FieldLegend>
              <ToggleGroup
                type="single"
                variant="outline"
                className="flex-wrap"
                value={plan.departMode}
                onValueChange={(v) =>
                  v && run(patch({ departMode: v as Plan['departMode'] }))
                }
              >
                {config.modes.map((m) => (
                  <ToggleGroupItem key={m.id} value={m.id}>
                    {m.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>
            <Field>
              <FieldLabel htmlFor="train-time">
                {mode.noun === '귀가'
                  ? '돌아올 시각'
                  : `${mode.noun} 출발 시각`}
              </FieldLabel>
              <Input
                id="train-time"
                type="time"
                value={plan.departTime}
                onChange={(e) =>
                  e.target.value && run(patch({ departTime: e.target.value }))
                }
              />
              <FieldDescription>
                {config.event.dateLabel} · {hubOf(config, plan).name}
              </FieldDescription>
            </Field>
            <FieldSet>
              <FieldLegend variant="label">가 보고 싶은 곳</FieldLegend>
              <ToggleGroup
                type="single"
                variant="outline"
                className="flex-wrap"
                value={plan.course}
                onValueChange={(v) => v && run(patch({ course: v }))}
              >
                <ToggleGroupItem value="auto">추천</ToggleGroupItem>
                {activeCourses(config).map((c) => (
                  <ToggleGroupItem key={c.id} value={c.id}>
                    {c.title}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>
            <FieldSet>
              <FieldLegend variant="label">완주 후 하고 싶은 일</FieldLegend>
              <ToggleGroup
                type="multiple"
                variant="outline"
                className="flex-wrap"
                value={plan.interests}
                onValueChange={(v) =>
                  run(patch({ interests: v as Plan['interests'] }))
                }
              >
                {interests.map((c) => (
                  <ToggleGroupItem
                    key={String(c.value)}
                    value={String(c.value)}
                  >
                    {c.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>
            <FieldSet>
              <FieldLegend variant="label">관광 출발 장소</FieldLegend>
              <FieldDescription>
                숙소는 영일대 권역으로 가정해요.
              </FieldDescription>
              <RadioGroup
                value={plan.origin}
                onValueChange={(v) =>
                  run(
                    patch({
                      origin: v as Plan['origin'],
                      currentPlace: v as Plan['origin'],
                    }),
                  )
                }
              >
                <Choice
                  id="origin-race"
                  value="RACE"
                  title="대회장"
                  description="짐을 가지고 바로 이동"
                />
                <Choice
                  id="origin-hotel"
                  value="HOTEL"
                  title="숙소"
                  description="짐을 찾은 뒤 출발"
                />
              </RadioGroup>
            </FieldSet>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button
            className="w-full"
            onClick={() => run(createTrip(config, state))}
          >
            내 하루 만들기 <ArrowRight />
          </Button>
          <p className="text-xs text-muted-foreground">
            현지 이동은 버스를 기본으로 계산해요.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

// ── S2 내 하루 ────────────────────────────────────────────────────────────

const phases = [
  {
    title: '포항에 도착하면 알려주세요',
    description: '대회 전날, 영일대 근처 숙소에서 쉬어요.',
  },
  {
    title: '출발 준비',
    description: '대회장 집결 · 출발 30분 전까지 (가상 행사)',
  },
  { title: '달리는 중', description: '완주하면 다음 단계로 넘어가요.' },
]
const checklist = ['배번호와 러닝화', '마실 물과 간식', '완주 후 짐 회수 계획']

export const DayScreen = () => {
  const { state, run, map, config, itinerary } = useApp()
  const phase = phases[state.phase]
  const hub = hubOf(config, state.plan)
  const course = courseById(config, itinerary.course)
  const timeline: [string, string, string, LucideIcon][] = [
    [
      `전날 ${state.plan.arrivalAt.slice(11)}`,
      '포항 도착',
      '영일대 근처 숙소',
      TrainFront,
    ],
    [
      config.event.gun,
      `${config.event.course.distanceKm}km 달리기`,
      config.event.venue,
      Flag,
    ],
    [
      '완주 후',
      course?.title ?? '코스 추천',
      '컨디션 확인 뒤 코스 결정',
      MapPin,
    ],
    [
      state.plan.departTime,
      `${hub.name} ${hub.mode.noun}`,
      hub.mode.bufferMin
        ? `${hub.mode.bufferMin}분 전 도착 목표`
        : '돌아올 시각',
      TrainFront,
    ],
  ]
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="내 하루" description={config.event.dateLabel} />
      <Columns
        main={
          <>
            <Card>
              <CardHeader>
                <CardDescription>지금 할 일</CardDescription>
                <CardTitle>{phase.title}</CardTitle>
                <CardDescription>{phase.description}</CardDescription>
              </CardHeader>
              {state.phase === 1 && (
                <CardContent>
                  <FieldGroup className="gap-3">
                    {checklist.map((text, i) => (
                      <Field key={text} orientation="horizontal">
                        <Checkbox
                          id={`check-${i}`}
                          checked={state.checks[i]}
                          onCheckedChange={() =>
                            run({
                              events: [{ type: 'day.checkToggled', index: i }],
                            })
                          }
                        />
                        <FieldLabel
                          htmlFor={`check-${i}`}
                          className="font-normal"
                        >
                          {text}
                        </FieldLabel>
                      </Field>
                    ))}
                  </FieldGroup>
                </CardContent>
              )}
              <CardFooter className="gap-2">
                {state.phase === 0 && (
                  <Button
                    onClick={() =>
                      run({ events: [{ type: 'day.advanced', phase: 1 }] })
                    }
                  >
                    포항에 도착했어요
                  </Button>
                )}
                {state.phase === 1 && (
                  <>
                    <Button
                      onClick={() =>
                        run({ events: [{ type: 'day.advanced', phase: 2 }] })
                      }
                    >
                      출발해요
                    </Button>
                    <Button variant="outline" asChild>
                      <a href={map('RACE')} target="_blank" rel="noreferrer">
                        집결지 보기 <ArrowUpRight />
                      </a>
                    </Button>
                  </>
                )}
                {state.phase === 2 && (
                  <Button onClick={() => run(go('finish'))}>완주했어요</Button>
                )}
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>일정</CardTitle>
                <CardDescription>
                  이동수단별 시연 추정으로 계산해요.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ItemGroup>
                  {timeline.map(([time, title, desc, Icon]) => (
                    <Item key={title} size="sm">
                      <ItemMedia variant="icon">
                        <Icon />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>{title}</ItemTitle>
                        <ItemDescription>{desc}</ItemDescription>
                      </ItemContent>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {time}
                      </span>
                    </Item>
                  ))}
                </ItemGroup>
              </CardContent>
            </Card>
          </>
        }
        rail={
          <>
            <Card>
              <CardHeader>
                <CardTitle>
                  완주 후 후보: {course?.title ?? '추천 코스'}
                </CardTitle>
                <CardDescription>
                  {course?.desc ?? ''} 완주 후 컨디션에 맞춰 다시 계산해요.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    run({
                      events: [{ type: 'candidate.toggled' }],
                      notice: state.candidate
                        ? '후보에서 뺐어요.'
                        : '후보로 담았어요.',
                    })
                  }
                >
                  {state.candidate ? <Check /> : <Bookmark />}
                  {state.candidate ? '후보로 담음' : '후보로 담기'}
                </Button>
              </CardFooter>
            </Card>
            <Button variant="ghost" onClick={() => run(go('finish'))}>
              시연: 완주 직후로 이동 <ArrowRight />
            </Button>
          </>
        }
      />
    </div>
  )
}

// ── S3 완주 후 확인 ──────────────────────────────────────────────────────

export const FinishScreen = () => {
  const { state, run } = useApp()
  const { plan } = state
  const ready = plan.condition !== 'UNANSWERED' && plan.baggageCollected
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="완주했어요"
        description="지금 컨디션에 맞춰 코스를 계산할게요. 세 가지만 알려주세요."
      />
      <Columns
        main={
          <Card>
            <CardContent>
              <FieldGroup>
                <FieldSet>
                  <FieldLegend>지금 상태</FieldLegend>
                  <RadioGroup
                    value={
                      plan.condition === 'UNANSWERED' ? '' : plan.condition
                    }
                    onValueChange={(v) =>
                      run(patch({ condition: v as Plan['condition'] }))
                    }
                  >
                    <Choice id="c-ok" value="OK" title="괜찮아요" />
                    <Choice id="c-tired" value="TIRED" title="조금 지쳤어요" />
                    <Choice
                      id="c-unwell"
                      value="UNWELL"
                      title="몸이 안 좋아요"
                      description="관광 계산을 멈추고 도움을 안내해요."
                    />
                  </RadioGroup>
                </FieldSet>
                {plan.condition === 'UNWELL' ? (
                  <Alert variant="destructive">
                    <HeartPulse />
                    <AlertTitle>몸을 먼저 살펴주세요</AlertTitle>
                    <AlertDescription>
                      관광 계획을 멈췄어요. 현장 의료부스나 운영요원에게 도움을
                      요청해 주세요.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <FieldSet>
                      <FieldLegend>걷기</FieldLegend>
                      <FieldDescription>
                        정류장과 장소 사이를 걷는 시간도 포함해요.
                      </FieldDescription>
                      <RadioGroup
                        value={String(plan.walkingLimit)}
                        onValueChange={(v) =>
                          run(patch({ walkingLimit: Number(v) }))
                        }
                      >
                        <Choice
                          id="w-15"
                          value="15"
                          title="15분 이내"
                          description="최소한으로"
                        />
                        <Choice
                          id="w-30"
                          value="30"
                          title="30분 이내"
                          description="짧은 구경은 괜찮아요"
                        />
                      </RadioGroup>
                    </FieldSet>
                    <Field>
                      <FieldLabel htmlFor="ready">
                        출발 준비 완료 시각
                      </FieldLabel>
                      <div className="flex gap-2">
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
                        />
                        <Button
                          variant="outline"
                          onClick={() => {
                            const t = clock(minutes(plan.readyTime) + 30)
                            run(patch({ readyTime: t, currentTime: t }))
                          }}
                        >
                          +30분
                        </Button>
                      </div>
                      <FieldDescription>
                        {plan.origin === 'HOTEL'
                          ? '숙소에서 짐을 찾고 출발하는 시각이에요.'
                          : '휴식과 짐 회수를 마친 뒤의 시각이에요.'}
                      </FieldDescription>
                    </Field>
                    <Field orientation="horizontal">
                      <Checkbox
                        id="baggage"
                        checked={plan.baggageCollected}
                        onCheckedChange={(v) =>
                          run(patch({ baggageCollected: v === true }))
                        }
                      />
                      <FieldLabel htmlFor="baggage" className="font-normal">
                        출발 전에 짐을 모두 챙길 수 있어요
                      </FieldLabel>
                    </Field>
                  </>
                )}
              </FieldGroup>
            </CardContent>
            {plan.condition === 'UNWELL' ? (
              <CardFooter>
                <Button variant="destructive" className="w-full" asChild>
                  <a href="tel:119">긴급하면 119</a>
                </Button>
              </CardFooter>
            ) : (
              <CardFooter>
                <Button
                  className="w-full"
                  disabled={!ready}
                  onClick={() => run(go('course'))}
                >
                  가능한 코스 보기 <ArrowRight />
                </Button>
              </CardFooter>
            )}
          </Card>
        }
        rail={<TrainCard />}
      />
    </div>
  )
}

// ── S4 코스 ──────────────────────────────────────────────────────────────

const decisionLabel: Record<Decision, string> = {
  GO: '추천 코스',
  INDOOR: '실내 위주',
  SHORTEN: '단축 코스',
  CANCEL: '귀가 우선',
  MEDICAL_FIRST: '의료 우선',
  NEEDS_DATA: '확인 필요',
  INCOMPLETE: '입력 필요',
}

const emptyTitle: Partial<Record<Decision, string>> = {
  MEDICAL_FIRST: '오늘은 몸이 먼저예요',
  NEEDS_DATA: '이동 경로 확인이 필요해요',
  INCOMPLETE: '출발 조건을 먼저 확인해요',
  CANCEL: '오늘은 귀가를 먼저 챙겨요',
}

export const CourseScreen = () => {
  const { state, itinerary: it, run, open, config, map } = useApp()
  const travel = canTravel(it)
  const hub = hubOf(config, state.plan)
  const names = it.stops
    .map((s) => config.places.find((p) => p.id === s.id)?.attrs.short)
    .join(' → ')
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={courseById(config, it.course)?.title ?? '코스'}
        description={
          travel ? names : '지금 조건으로는 관광 코스를 만들 수 없어요.'
        }
        action={
          <Badge variant={travel ? 'secondary' : 'outline'}>
            {decisionLabel[it.decision]}
          </Badge>
        }
      />
      <Columns
        main={
          <>
            {travel ? (
              <>
                <Alert>
                  <Info />
                  <AlertTitle>이 코스인 이유</AlertTitle>
                  <AlertDescription>
                    <p>{it.reasons.join(' ')}</p>
                    <Button
                      variant="link"
                      className="h-auto p-0"
                      onClick={() => open('why')}
                    >
                      계산 근거 보기
                    </Button>
                  </AlertDescription>
                </Alert>
                <StatsCard />
                <ItineraryCard />
              </>
            ) : (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    {it.decision === 'MEDICAL_FIRST' ? (
                      <HeartPulse />
                    ) : (
                      <CircleAlert />
                    )}
                  </EmptyMedia>
                  <EmptyTitle>
                    {emptyTitle[it.decision] ?? '확인이 필요해요'}
                  </EmptyTitle>
                  <EmptyDescription>{it.reasons.join(' ')}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent className="flex-row justify-center gap-2">
                  <Button onClick={() => run(navigate(state, 'finish'))}>
                    조건 다시 확인
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={map(hub.id)} target="_blank" rel="noreferrer">
                      {hub.name} 길찾기 <ArrowUpRight />
                    </a>
                  </Button>
                </EmptyContent>
              </Empty>
            )}
            <ObservationCard />
            <p className="text-xs text-muted-foreground">
              이동시간과 관측값은 시연용 가정값이에요. 실제 버스편·영업시간·보행
              경로는 확인이 필요해요.
            </p>
          </>
        }
        rail={
          <>
            <TrainCard />
            <AdjustCard />
            <Button
              className="hidden lg:flex"
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

const stageLabel = (
  area: string,
  hub: string,
): Record<Plan['stage'], string> => ({
  BEFORE: '출발 전',
  OUTBOUND: `${area}(으)로 이동 중`,
  LOCAL: `${area}에 머무는 중`,
  RETURN: `${hub}(으)로 이동 중`,
  DONE: '도착',
})

export const NextScreen = () => {
  const { state, itinerary: it, run, config, map, open } = useApp()
  const { plan } = state
  const next = it.stops[0]
    ? config.places.find((p) => p.id === it.stops[0].id)
    : undefined
  const travel = canTravel(it)
  const hub = hubOf(config, plan)
  const area = courseById(config, it.course)?.area ?? '코스'

  if (plan.stage === 'DONE')
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Check />
          </EmptyMedia>
          <EmptyTitle>여행을 마쳤어요</EmptyTitle>
          <EmptyDescription>
            {hub.name} 도착 {plan.currentTime} · {departLabel(config, plan)}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap justify-center gap-2">
            {plan.completed.map((id) => (
              <Badge key={id} variant="secondary">
                {config.places.find((p) => p.id === id)?.attrs.short ?? id}
              </Badge>
            ))}
          </div>
          <Button variant="outline" onClick={() => open('demo')}>
            다른 시나리오 보기
          </Button>
        </EmptyContent>
      </Empty>
    )

  const headline =
    plan.stage === 'OUTBOUND'
      ? `${area}(으)로`
      : plan.stage === 'RETURN'
        ? `${hub.name}(으)로`
        : !travel || !next
          ? `${hub.name}(으)로 돌아갈 시간이에요`
          : next.attrs.short
  const description =
    plan.stage === 'OUTBOUND'
      ? '버스 경로와 승차 정류장은 지도에서 확인해 주세요.'
      : plan.stage === 'RETURN'
        ? `${departLabel(config, plan)} 전까지 여유 있게 이동해요.`
        : next
          ? next.attrs.desc
          : '남은 관광 대신 귀가 동선을 먼저 확인해요.'
  const actionable =
    plan.stage === 'OUTBOUND' || plan.stage === 'RETURN' || it.stops.length > 0
  const destination =
    plan.stage === 'OUTBOUND'
      ? 'COURSE'
      : plan.stage === 'RETURN'
        ? hub.id
        : (it.stops[0]?.id ?? hub.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="다음 행동"
        description="남은 일정과 복귀 시간을 계속 다시 계산해요."
        action={
          <Badge variant="outline">
            <Clock /> {plan.currentTime}
          </Badge>
        }
      />
      <Columns
        main={
          <>
            <Card>
              <CardHeader>
                <CardDescription>
                  {stageLabel(area, hub.name)[plan.stage]}
                </CardDescription>
                <CardTitle className="text-xl">{headline}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              {actionable && (
                <CardFooter className="flex-col gap-2">
                  <Button className="w-full" asChild>
                    <a
                      href={map(
                        destination,
                        plan.stage === 'LOCAL' ? 'walk' : 'traffic',
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {plan.stage === 'LOCAL' ? '길찾기' : '대중교통 경로'}{' '}
                      <ArrowUpRight />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => run(advance(state, it))}
                  >
                    {plan.stage === 'OUTBOUND'
                      ? `${area}에 도착했어요`
                      : plan.stage === 'RETURN'
                        ? `${hub.name}에 도착했어요`
                        : `${next?.attrs.actionLabel ?? '방문'} 마쳤어요`}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    위치를 추적하지 않아요. 도착·완료는 직접 눌러 주세요.
                  </p>
                </CardFooter>
              )}
            </Card>
            {plan.stage === 'LOCAL' && it.stops.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => run(skipStop(state, it))}
                >
                  <SkipForward /> 건너뛰기
                </Button>
                <Button
                  variant="outline"
                  onClick={() => run(restMore(config, state))}
                >
                  <Coffee /> 30분 더 쉬기
                </Button>
              </div>
            )}
            {plan.stage !== 'RETURN' && <ItineraryCard />}
          </>
        }
        rail={
          <>
            <TrainCard />
            <Button
              variant="outline"
              onClick={() => run(startReturn(state, it))}
            >
              <TrainFront /> {hub.name}(으)로 돌아가기
            </Button>
            <ObservationCard />
          </>
        }
      />
    </div>
  )
}
