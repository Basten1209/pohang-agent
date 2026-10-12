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
import { activeCourses, courseById, hubOf, modeOf } from '#/core/route'
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
import type { MessageKey } from '#/i18n'
import { useI18n } from '#/i18n/react'
import { Choice, PageHeader } from './bits'
import {
  AdjustCard,
  ItineraryCard,
  ObservationCard,
  StatsCard,
  TrainCard,
  useNames,
} from './cards'
import { useApp } from './context'
import { chipOn } from './bits'

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
  const { t, d } = useI18n()
  const names = useNames()
  const { plan } = state
  const mode = modeOf(config, plan)
  const interests = config.conversation.slots.interests?.choices ?? []
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <PageHeader
        title={t('classic.plan.title')}
        description={t('classic.plan.lead')}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t('classic.plan.make')}</CardTitle>
          <CardDescription>
            {config.event.name} · {config.event.dateLabel} {config.event.gun} ·{' '}
            {config.event.venue} {t('classic.plan.virtual')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="arrival">
                {t('classic.plan.arrival')}
              </FieldLabel>
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
              <FieldLegend variant="label">
                {t('classic.plan.mode')}
              </FieldLegend>
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
                  <ToggleGroupItem className={chipOn} key={m.id} value={m.id}>
                    {d(`mode.${m.id}`, m.label)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>
            <Field>
              <FieldLabel htmlFor="train-time">
                {mode.id === 'LOCAL'
                  ? t('classic.plan.returnTime')
                  : t('classic.plan.departTime', { noun: names.noun(plan) })}
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
                {config.event.dateLabel} · {names.hub(plan)}
              </FieldDescription>
            </Field>
            <FieldSet>
              <FieldLegend variant="label">
                {t('classic.plan.course')}
              </FieldLegend>
              <ToggleGroup
                type="single"
                variant="outline"
                className="flex-wrap"
                value={plan.course}
                onValueChange={(v) => v && run(patch({ course: v }))}
              >
                <ToggleGroupItem className={chipOn} value="auto">
                  {t('classic.plan.auto')}
                </ToggleGroupItem>
                {activeCourses(config).map((c) => (
                  <ToggleGroupItem className={chipOn} key={c.id} value={c.id}>
                    {d(`course.${c.id}`, c.title)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>
            <FieldSet>
              <FieldLegend variant="label">
                {t('classic.plan.interests')}
              </FieldLegend>
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
                    className={chipOn}
                    key={String(c.value)}
                    value={String(c.value)}
                  >
                    {d(`interest.${String(c.value)}`, c.label)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>
            <FieldSet>
              <FieldLegend variant="label">
                {t('classic.plan.origin')}
              </FieldLegend>
              <FieldDescription>
                {t('classic.plan.originHint')}
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
                  title={t('classic.plan.race')}
                  description={t('classic.plan.raceHint')}
                />
                <Choice
                  id="origin-hotel"
                  value="HOTEL"
                  title={t('classic.plan.hotel')}
                  description={t('classic.plan.hotelHint')}
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
            {t('classic.plan.make')} <ArrowRight />
          </Button>
          <p className="text-xs text-muted-foreground">
            {t('classic.plan.bus')}
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

// ── S2 내 하루 ────────────────────────────────────────────────────────────

const phases: { title: MessageKey; description: MessageKey }[] = [
  { title: 'classic.day.phase0', description: 'classic.day.phase0Desc' },
  { title: 'classic.day.phase1', description: 'classic.day.phase1Desc' },
  { title: 'classic.day.phase2', description: 'classic.day.phase2Desc' },
]
const checklist: MessageKey[] = [
  'classic.day.check0',
  'classic.day.check1',
  'classic.day.check2',
]

export const DayScreen = () => {
  const { state, run, map, config, itinerary } = useApp()
  const { t } = useI18n()
  const names = useNames()
  const phase = phases[state.phase]
  const hub = hubOf(config, state.plan)
  const course = courseById(config, itinerary.course)
  const courseTitle = names.course(itinerary.course)
  const timeline: [string, string, string, LucideIcon][] = [
    [
      t('classic.day.eve', { time: state.plan.arrivalAt.slice(11) }),
      t('classic.day.arrive'),
      t('classic.day.hotel'),
      TrainFront,
    ],
    [
      config.event.gun,
      t('classic.day.run', { km: config.event.course.distanceKm }),
      config.event.venue,
      Flag,
    ],
    [
      t('classic.day.after'),
      courseTitle ?? t('classic.day.pick'),
      t('classic.day.decide'),
      MapPin,
    ],
    [
      state.plan.departTime,
      `${names.hub(state.plan)} ${names.noun(state.plan)}`,
      hub.mode.bufferMin
        ? t('classic.day.buffer', { n: hub.mode.bufferMin })
        : t('classic.plan.returnTime'),
      TrainFront,
    ],
  ]
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('classic.step.day')}
        description={config.event.dateLabel}
      />
      <Columns
        main={
          <>
            <Card>
              <CardHeader>
                <CardDescription>{t('classic.day.now')}</CardDescription>
                <CardTitle>{t(phase.title)}</CardTitle>
                <CardDescription>{t(phase.description)}</CardDescription>
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
                          {t(text)}
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
                    {t('classic.day.arrived')}
                  </Button>
                )}
                {state.phase === 1 && (
                  <>
                    <Button
                      onClick={() =>
                        run({ events: [{ type: 'day.advanced', phase: 2 }] })
                      }
                    >
                      {t('classic.day.start')}
                    </Button>
                    <Button variant="outline" asChild>
                      <a href={map('RACE')} target="_blank" rel="noreferrer">
                        {t('classic.day.meet')} <ArrowUpRight />
                      </a>
                    </Button>
                  </>
                )}
                {state.phase === 2 && (
                  <Button onClick={() => run(go('finish'))}>
                    {t('classic.day.finished')}
                  </Button>
                )}
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('classic.day.schedule')}</CardTitle>
                <CardDescription>
                  {t('classic.day.scheduleHint')}
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
                  {t('classic.day.candidate', {
                    course: courseTitle ?? t('classic.day.recommended'),
                  })}
                </CardTitle>
                <CardDescription>
                  {course?.desc ?? ''} {t('classic.day.recalc')}
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
                        ? t('classic.day.removed')
                        : t('classic.day.added'),
                    })
                  }
                >
                  {state.candidate ? <Check /> : <Bookmark />}
                  {state.candidate
                    ? t('classic.day.saved')
                    : t('classic.day.save')}
                </Button>
              </CardFooter>
            </Card>
            <Button variant="ghost" onClick={() => run(go('finish'))}>
              {t('classic.day.skip')} <ArrowRight />
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
  const { t } = useI18n()
  const { plan } = state
  const ready = plan.condition !== 'UNANSWERED' && plan.baggageCollected
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('classic.day.finished')}
        description={t('classic.finish.lead')}
      />
      <Columns
        main={
          <Card>
            <CardContent>
              <FieldGroup>
                <FieldSet>
                  <FieldLegend>{t('classic.finish.state')}</FieldLegend>
                  <RadioGroup
                    value={
                      plan.condition === 'UNANSWERED' ? '' : plan.condition
                    }
                    onValueChange={(v) =>
                      run(patch({ condition: v as Plan['condition'] }))
                    }
                  >
                    <Choice
                      id="c-ok"
                      value="OK"
                      title={t('classic.finish.ok')}
                    />
                    <Choice
                      id="c-tired"
                      value="TIRED"
                      title={t('classic.finish.tired')}
                    />
                    <Choice
                      id="c-unwell"
                      value="UNWELL"
                      title={t('classic.finish.unwell')}
                      description={t('classic.finish.unwellHint')}
                    />
                  </RadioGroup>
                </FieldSet>
                {plan.condition === 'UNWELL' ? (
                  <Alert variant="destructive">
                    <HeartPulse />
                    <AlertTitle>{t('classic.finish.alertTitle')}</AlertTitle>
                    <AlertDescription>
                      {t('classic.finish.alertBody')}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <FieldSet>
                      <FieldLegend>{t('classic.stats.walk')}</FieldLegend>
                      <FieldDescription>
                        {t('classic.finish.walkHint')}
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
                          title={t('classic.finish.w15')}
                          description={t('classic.finish.w15Hint')}
                        />
                        <Choice
                          id="w-30"
                          value="30"
                          title={t('classic.finish.w30')}
                          description={t('classic.finish.w30Hint')}
                        />
                      </RadioGroup>
                    </FieldSet>
                    <Field>
                      <FieldLabel htmlFor="ready">
                        {t('classic.finish.ready')}
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
                          {t('classic.finish.plus30')}
                        </Button>
                      </div>
                      <FieldDescription>
                        {plan.origin === 'HOTEL'
                          ? t('classic.finish.readyHotel')
                          : t('classic.finish.readyRace')}
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
                        {t('classic.finish.baggage')}
                      </FieldLabel>
                    </Field>
                  </>
                )}
              </FieldGroup>
            </CardContent>
            {plan.condition === 'UNWELL' ? (
              <CardFooter>
                <Button variant="destructive" className="w-full" asChild>
                  <a href="tel:119">{t('classic.finish.sos')}</a>
                </Button>
              </CardFooter>
            ) : (
              <CardFooter>
                <Button
                  className="w-full"
                  disabled={!ready}
                  onClick={() => run(go('course'))}
                >
                  {t('classic.finish.see')} <ArrowRight />
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

const decisionLabel: Record<Decision, MessageKey> = {
  GO: 'classic.decision.GO',
  INDOOR: 'classic.decision.INDOOR',
  SHORTEN: 'classic.decision.SHORTEN',
  CANCEL: 'classic.decision.CANCEL',
  MEDICAL_FIRST: 'classic.decision.MEDICAL_FIRST',
  NEEDS_DATA: 'classic.decision.NEEDS_DATA',
  INCOMPLETE: 'classic.decision.INCOMPLETE',
}

const emptyTitle: Partial<Record<Decision, MessageKey>> = {
  MEDICAL_FIRST: 'classic.empty.MEDICAL_FIRST',
  NEEDS_DATA: 'classic.empty.NEEDS_DATA',
  INCOMPLETE: 'classic.empty.INCOMPLETE',
  CANCEL: 'classic.empty.CANCEL',
}

export const CourseScreen = () => {
  const { state, itinerary: it, run, open, config, map } = useApp()
  const { t } = useI18n()
  const names = useNames()
  const travel = canTravel(it)
  const hub = hubOf(config, state.plan)
  const empty = emptyTitle[it.decision]
  const stops = it.stops
    .map((s) => config.places.find((p) => p.id === s.id)?.attrs.short)
    .join(' → ')
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={names.course(it.course) ?? t('classic.step.course')}
        description={travel ? stops : t('classic.course.none')}
        action={
          <Badge variant={travel ? 'secondary' : 'outline'}>
            {t(decisionLabel[it.decision])}
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
                  <AlertTitle>{t('classic.course.why')}</AlertTitle>
                  <AlertDescription>
                    <p>{it.reasons.join(' ')}</p>
                    <Button
                      variant="link"
                      className="h-auto p-0"
                      onClick={() => open('why')}
                    >
                      {t('classic.course.basis')}
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
                    {empty ? t(empty) : t('classic.empty.other')}
                  </EmptyTitle>
                  <EmptyDescription>{it.reasons.join(' ')}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent className="flex-row justify-center gap-2">
                  <Button onClick={() => run(navigate(state, 'finish'))}>
                    {t('classic.course.retry')}
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={map(hub.id)} target="_blank" rel="noreferrer">
                      {t('classic.course.directions', {
                        hub: names.hub(state.plan),
                      })}{' '}
                      <ArrowUpRight />
                    </a>
                  </Button>
                </EmptyContent>
              </Empty>
            )}
            <ObservationCard />
            <p className="text-xs text-muted-foreground">
              {t('classic.course.note')}
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
              {t('classic.go')} <ArrowRight />
            </Button>
          </>
        }
      />
    </div>
  )
}

// ── S5 다음 행동 ──────────────────────────────────────────────────────────

const stageLabel: Record<Plan['stage'], MessageKey> = {
  BEFORE: 'classic.stage.BEFORE',
  OUTBOUND: 'classic.stage.OUTBOUND',
  LOCAL: 'classic.stage.LOCAL',
  RETURN: 'classic.stage.RETURN',
  DONE: 'classic.stage.DONE',
}

export const NextScreen = () => {
  const { state, itinerary: it, run, config, map, open } = useApp()
  const { t } = useI18n()
  const names = useNames()
  const { plan } = state
  const next = it.stops[0]
    ? config.places.find((p) => p.id === it.stops[0].id)
    : undefined
  const travel = canTravel(it)
  const hub = hubOf(config, plan)
  const hubName = names.hub(plan)
  const area = names.area(it.course) ?? t('classic.step.course')

  if (plan.stage === 'DONE')
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Check />
          </EmptyMedia>
          <EmptyTitle>{t('classic.next.doneTitle')}</EmptyTitle>
          <EmptyDescription>
            {t('classic.next.doneDesc', {
              hub: hubName,
              time: plan.currentTime,
              depart: names.depart(plan),
            })}
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
            {t('classic.next.other')}
          </Button>
        </EmptyContent>
      </Empty>
    )

  const headline =
    plan.stage === 'OUTBOUND'
      ? t('classic.next.to', { place: area })
      : plan.stage === 'RETURN'
        ? t('classic.next.to', { place: hubName })
        : !travel || !next
          ? t('classic.next.backTime', { hub: hubName })
          : next.attrs.short
  const description =
    plan.stage === 'OUTBOUND'
      ? t('classic.next.outboundDesc')
      : plan.stage === 'RETURN'
        ? t('classic.next.returnDesc', { depart: names.depart(plan) })
        : next
          ? next.attrs.desc
          : t('classic.next.noneDesc')
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
        title={t('classic.step.next')}
        description={t('classic.next.lead')}
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
                  {t(stageLabel[plan.stage], { area, hub: hubName })}
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
                      {plan.stage === 'LOCAL'
                        ? t('classic.next.walkRoute')
                        : t('classic.next.transit')}{' '}
                      <ArrowUpRight />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => run(advance(state, it))}
                  >
                    {plan.stage === 'OUTBOUND'
                      ? t('classic.next.arrivedAt', { place: area })
                      : plan.stage === 'RETURN'
                        ? t('classic.next.arrivedAt', { place: hubName })
                        : t('classic.next.done', {
                            action:
                              next?.attrs.actionLabel ??
                              t('classic.next.visit'),
                          })}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {t('classic.next.manual')}
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
                  <SkipForward /> {t('classic.next.skip')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => run(restMore(config, state))}
                >
                  <Coffee /> {t('classic.next.rest')}
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
              <TrainFront /> {t('classic.next.goBack', { hub: hubName })}
            </Button>
            <ObservationCard />
          </>
        }
      />
    </div>
  )
}
