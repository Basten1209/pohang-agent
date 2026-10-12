import {
  Check,
  CircleSlash,
  HeartPulse,
  Camera,
  Navigation,
  Phone,
} from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Shimmer } from '@/components/ai-elements/shimmer'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PlaceIcon } from '#/app/bits'
import { photoEligiblePlaces } from '#/core/community'
import { ItineraryTimeline } from '#/home/timeline'
import { CourseCandidates } from '#/home/candidates'
import { mapUrl, pointOf, directionsUrl } from '#/core/links'
import type { Itinerary } from '#/core/planner'
import type { ChoicePrompt } from '#/core/slots'
import type { Progress } from '#/core/stage'
import { progressOptions } from '#/core/stage'
import { courseById, hubOf } from '#/core/route'
import { clock } from '#/core/time'
import type { PartOf, ToolPart } from './context'
import { useChatContext } from './context'
import { VisitPhotoCard } from './visit-photo-card'
import { chipOn } from '#/app/bits'
import { useI18n } from '#/i18n/react'

/**
 * One component per agent tool. A card is interactive only while it is the
 * open question of the latest assistant message; afterwards it shows what
 * was answered. Tools without a card fall back to the AI Elements `Tool`.
 */

type CardProps<P> = { part: P; interactive: boolean }

// ── The app's question: reply chips ────────────────────────────────────

/**
 * Chips under the open question. A chip is a shortcut for typing: it sends
 * its sentence as the user's message, with the value attached. Typing a
 * free answer instead works just as well.
 */
export const Choices = ({
  prompt,
  interactive,
}: {
  prompt: ChoicePrompt
  interactive: boolean
}) => {
  const { config, choose, view } = useChatContext()
  const { t } = useI18n()
  const [picked, setPicked] = useState<string[]>([])
  // A question already answered elsewhere (the profile form) is not asked again.
  if (!interactive || view.state.answered.includes(prompt.slot)) return null
  const icon = (value: unknown) => {
    const place = config.places.find((p) => p.id === value)
    return place ? <PlaceIcon name={place.attrs.icon} /> : null
  }

  if (prompt.multiple) {
    const labels = prompt.choices
      .filter((c) => picked.includes(String(c.value)))
      .map((c) => c.label)
    return (
      <div className="flex flex-col items-start gap-2">
        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          className="flex-wrap"
          value={picked}
          onValueChange={setPicked}
        >
          {prompt.choices.map((c) => (
            <ToggleGroupItem
              className={chipOn}
              key={String(c.value)}
              value={String(c.value)}
            >
              {icon(c.value)}
              {c.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button
          size="sm"
          disabled={!picked.length}
          onClick={() =>
            choose(
              prompt.slot,
              picked,
              t('chatx.sayPicked', { labels: labels.join(', ') }),
            )
          }
        >
          {t('chatx.pickThese')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {prompt.choices.map((c) => (
        <Button
          key={c.label}
          size="sm"
          variant="outline"
          onClick={() => choose(prompt.slot, c.value, c.say)}
        >
          {icon(c.value)}
          {c.label}
        </Button>
      ))}
    </div>
  )
}

const Answered = ({ children }: { children: ReactNode }) => (
  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
    <Check className="size-4" /> {children}
  </p>
)

const skipped = (output: unknown) =>
  typeof output === 'object' && output !== null && 'skipped' in output

const Unanswered = () => {
  const { t } = useI18n()
  return (
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <CircleSlash className="size-4" /> {t('chatx.unanswered')}
    </p>
  )
}

// ── Ask: quick reply ───────────────────────────────────────────────────

const QuickReplyCard = ({
  part,
  interactive,
}: CardProps<PartOf<'ask_quick_reply'>>) => {
  const { answer } = useChatContext()
  if (part.state === 'output-available')
    return skipped(part.output) || !('label' in part.output) ? (
      <Unanswered />
    ) : (
      <Answered>{part.output.label}</Answered>
    )
  if (part.state !== 'input-available') return null
  if (!interactive) return <Unanswered />
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">{part.input.question}</p>
      <div className="flex flex-wrap gap-2">
        {part.input.options.map((o) => (
          <Button
            key={o.id}
            variant="outline"
            size="sm"
            onClick={() => answer('ask_quick_reply', part.toolCallId, o)}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

// ── Ask: next action while travelling ──────────────────────────────────

const progressLabel = (
  t: ReturnType<typeof useI18n>['t'],
  area: string,
  hub: string,
): Record<Progress, string> => ({
  ARRIVED: t('chatx.progress.ARRIVED', { area }),
  STOP_DONE: t('chatx.progress.STOP_DONE'),
  SKIP: t('chatx.progress.SKIP'),
  REST: t('chatx.progress.REST'),
  START_RETURN: t('chatx.progress.START_RETURN'),
  AT_STATION: t('chatx.progress.AT_STATION', { hub }),
})

const ProgressCard = ({
  part,
  interactive,
}: CardProps<PartOf<'await_progress'>>) => {
  const { config, view, answer, send } = useChatContext()
  const { t, d } = useI18n()
  const { state, itinerary: it } = view
  const course = courseById(config, it.course)
  const hub = hubOf(config, state.plan)
  const hubName = d(`hub.${hub.id}`, hub.name)
  const area = course?.area ?? t('chatx.course')
  const labels = progressLabel(t, area, hubName)
  if (part.state === 'output-available')
    return skipped(part.output) || !('event' in part.output) ? null : (
      <Answered>{labels[part.output.event]}</Answered>
    )
  if (part.state !== 'input-available' || !interactive) return null

  const options = progressOptions(state, it)
  if (!options.length) return null
  const map = mapUrl(config, it.course)
  const [stop] = it.stops
  const leg = it.legs[0]
  const points = pointOf(config, it.course)
  const a = leg && points(leg.from),
    b = leg && points(leg.to)
  const legUrl =
    a && b
      ? directionsUrl(
          a,
          b,
          leg.mode === 'TAXI'
            ? 'car'
            : leg.mode === 'WALK'
              ? 'walk'
              : 'traffic',
        )
      : null
  const place = stop && config.places.find((p) => p.id === stop.id)
  const outboundMode = it.legs.find((l) => l.kind === 'OUTBOUND')?.mode
  const target =
    state.plan.stage === 'OUTBOUND'
      ? {
          title: t('chatx.toArea', { area }),
          desc: t('chatx.outboundDesc', {
            mode: outboundMode
              ? t(`chatx.transport.${outboundMode}`)
              : t('chatx.move'),
            min: it.outbound,
          }),
          url: legUrl ?? map('COURSE'),
        }
      : state.plan.stage === 'LOCAL' && place
        ? {
            title: place.attrs.title,
            desc: `${place.attrs.short} · ${place.attrs.subtitle} · ${clock(stop.start)}–${clock(stop.end)}`,
            url: legUrl ?? map(place.id, 'walk'),
          }
        : {
            title: t('chatx.toHub', { hub: hubName }),
            desc:
              it.planningArrival === null
                ? t('chatx.moveToHub', { hub: hubName })
                : t('chatx.plannedArrival', {
                    time: clock(it.planningArrival),
                    depart: `${state.plan.departTime} ${d(`noun.${hub.mode.id}`, hub.mode.noun)}`,
                  }),
            url: legUrl ?? map(hub.id),
          }

  return (
    <Card>
      <CardHeader>
        <CardDescription>{t('chatx.nowTodo')}</CardDescription>
        <CardTitle>{target.title}</CardTitle>
        <CardDescription>{target.desc}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {place &&
          state.plan.stage === 'LOCAL' &&
          photoEligiblePlaces(config, state).some((p) => p.id === place.id) && (
            <Button
              className="h-11 w-full"
              onClick={() =>
                send(t('say.sharePhotoAt', { place: place.attrs.short }))
              }
            >
              <Camera />
              {t('chatx.uploadHere')}
            </Button>
          )}
        {options.map((o, i) => (
          <Button
            key={o}
            size="sm"
            variant={i === 0 ? 'default' : 'outline'}
            onClick={() =>
              answer('await_progress', part.toolCallId, { event: o })
            }
          >
            {labels[o]}
          </Button>
        ))}
      </CardContent>
      <CardFooter>
        <Button asChild variant="ghost" size="sm">
          <a href={target.url} target="_blank" rel="noopener noreferrer">
            <Navigation /> {t('chatx.directions')}
          </a>
        </Button>
      </CardFooter>
    </Card>
  )
}

// ── Read: course preview ───────────────────────────────────────────────

export const CourseSummary = ({
  it,
  title,
  depart,
}: {
  it: Itinerary
  title: string
  depart?: string
}) => {
  const { config, view } = useChatContext()
  const { t, d } = useI18n()
  const course = courseById(config, it.course)
  const hub =
    config.anchors.find((anchor) => anchor.id === it.hub) ??
    hubOf(config, view.state.plan)
  const hubName = d(`hub.${hub.id}`, hub.name)
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>
          {title}
          {course &&
            it.stops.length > 0 &&
            ` · ${d(`course.${course.id}`, course.title)}`}
        </CardDescription>
        <CardTitle>
          {it.planningArrival === null
            ? t('chatx.homeNoTour')
            : t('chatx.hubArrival', {
                hub: hubName,
                time: clock(it.planningArrival),
              })}
        </CardTitle>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">
            {t(`chatx.decision.${it.decision}`)}
          </Badge>
          <Badge variant="outline">
            {depart ?? t('chatx.hubTarget', { time: clock(it.stationTarget) })}
          </Badge>
        </div>
      </CardHeader>
      {it.stops.length > 0 && (
        <CardContent>
          <ItineraryTimeline config={config} itinerary={it} />
          <div className="mt-5 border-t pt-4">
            <CourseCandidates
              key={it.course}
              config={config}
              course={it.course}
            />
          </div>
        </CardContent>
      )}
    </Card>
  )
}

const PlanCourseCard = ({ part }: CardProps<PartOf<'plan_course'>>) => {
  const { t } = useI18n()
  if (part.state === 'input-streaming' || part.state === 'input-available')
    return null
  if (part.state !== 'output-available') return null
  if ('validationErrors' in part.output && part.output.validationErrors?.length)
    return null
  return (
    <CourseSummary
      it={part.output.itinerary}
      depart={part.output.depart}
      title={
        part.output.isChange ? t('chatx.ifChanged') : t('chatx.currentCourse')
      }
    />
  )
}

// ── Commit: approvals ──────────────────────────────────────────────────

const ApprovalCard = ({
  part,
  interactive,
  question,
  yes,
  no,
  done,
  declined,
}: CardProps<ToolPart> & {
  question: string
  yes: string
  no: string
  done: (output: unknown) => string
  declined: string
}) => {
  const { approve } = useChatContext()
  const { t } = useI18n()
  if (part.state === 'approval-requested')
    return interactive && part.approval ? (
      <div className="flex flex-col gap-2">
        <p className="text-sm">{question}</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => approve(part.approval!.id, true)}>
            {yes}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => approve(part.approval!.id, false)}
          >
            {no}
          </Button>
        </div>
      </div>
    ) : (
      <Unanswered />
    )
  if (part.state === 'approval-responded')
    return <Shimmer>{t('chatx.applying')}</Shimmer>
  if (part.state === 'output-denied') return <Answered>{declined}</Answered>
  if (part.state === 'output-available')
    return <Answered>{done(part.output)}</Answered>
  return null
}

const ApplyChangeCard = (props: CardProps<PartOf<'apply_plan_change'>>) => {
  const { t } = useI18n()
  return (
    <ApprovalCard
      {...props}
      question={t('chatx.apply.question')}
      yes={t('chatx.apply.yes')}
      no={t('chatx.apply.no')}
      declined={t('chatx.apply.declined')}
      done={(o) =>
        (o as { applied: boolean }).applied
          ? t('chatx.apply.done')
          : t('chatx.apply.notDone')
      }
    />
  )
}

const StartJourneyCard = (props: CardProps<PartOf<'start_journey'>>) => {
  const { t } = useI18n()
  return (
    <ApprovalCard
      {...props}
      question={t('chatx.start.question')}
      yes={t('chatx.start.yes')}
      no={t('chatx.start.no')}
      declined={t('chatx.start.declined')}
      done={(o) =>
        (o as { started: boolean }).started
          ? t('chatx.start.done')
          : t('chatx.start.notDone')
      }
    />
  )
}

// ── Read: safety and summary ───────────────────────────────────────────

const SafetyCard = ({ part }: CardProps<PartOf<'show_safety_help'>>) => {
  const { t } = useI18n()
  return part.state !== 'output-available' ? null : (
    <Alert variant="destructive">
      <HeartPulse />
      <AlertTitle>{t('chatx.safety.title')}</AlertTitle>
      <AlertDescription>
        <p>{part.output.message}</p>
        <Button asChild variant="destructive" size="sm" className="mt-2">
          <a href={`tel:${part.output.emergency}`}>
            <Phone />{' '}
            {t('chatx.safety.call', { number: part.output.emergency })}
          </a>
        </Button>
      </AlertDescription>
    </Alert>
  )
}

const SummaryCard = ({ part }: CardProps<PartOf<'summarize_trip'>>) => {
  const { t } = useI18n()
  return part.state !== 'output-available' ? null : (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{t('chatx.summary.label')}</CardDescription>
        <CardTitle>
          {t('chatx.summary.title', {
            time: part.output.arrivedAt,
            hub: part.output.hub,
            depart: part.output.depart,
          })}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {part.output.visited.length
          ? part.output.visited.join(' → ')
          : t('chatx.summary.noTour')}
      </CardContent>
    </Card>
  )
}

// ── Everything else: the stock AI Elements tool view ───────────────────

/** Read-tool telemetry is transient; completed results live in the answer. */
const GenericTool = ({ part }: CardProps<ToolPart>) => {
  const { t } = useI18n()
  return part.state === 'output-error' ? (
    <p role="status" className="text-xs text-muted-foreground">
      {t('chatx.toolError')}
    </p>
  ) : null
}

/** Bookkeeping the conversation already shows in words. */
const Hidden = () => null

/** Data-directed dispatch: tool name → card. */
const cards: Record<string, (props: CardProps<never>) => ReactNode> = {
  prepare_visit_photo: VisitPhotoCard,
  update_trip_details: Hidden,
  record_race_progress: Hidden,
  ask_quick_reply: QuickReplyCard,
  await_progress: ProgressCard,
  plan_course: PlanCourseCard,
  apply_plan_change: ApplyChangeCard,
  start_journey: StartJourneyCard,
  show_safety_help: SafetyCard,
  summarize_trip: SummaryCard,
}

export const ToolCard = ({ part, interactive }: CardProps<ToolPart>) => {
  const Card = cards[part.type.slice(5)] ?? GenericTool
  return <Card part={part as never} interactive={interactive} />
}
