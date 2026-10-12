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
import { transportLabel } from '#/core/mobility'
import { mapUrl, pointOf, directionsUrl } from '#/core/links'
import type { Decision, Itinerary } from '#/core/planner'
import type { ChoicePrompt } from '#/core/slots'
import type { Progress } from '#/core/stage'
import { progressOptions } from '#/core/stage'
import { courseById, departLabel, hubOf } from '#/core/route'
import { clock } from '#/core/time'
import type { PartOf, ToolPart } from './context'
import { useChatContext } from './context'
import { VisitPhotoCard } from './visit-photo-card'

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
            <ToggleGroupItem key={String(c.value)} value={String(c.value)}>
              {icon(c.value)}
              {c.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button
          size="sm"
          disabled={!picked.length}
          onClick={() =>
            choose(prompt.slot, picked, `${labels.join(', ')} 할래요`)
          }
        >
          이걸로 할게요
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

const Unanswered = () => (
  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
    <CircleSlash className="size-4" /> 답하지 않고 넘어갔어요
  </p>
)

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
  area: string,
  hub: string,
): Record<Progress, string> => ({
  ARRIVED: `${area} 도착`,
  STOP_DONE: '다 봤어요',
  SKIP: '건너뛰기',
  REST: '30분 더 쉬기',
  START_RETURN: '돌아가기 시작',
  AT_STATION: `${hub} 도착`,
})

const ProgressCard = ({
  part,
  interactive,
}: CardProps<PartOf<'await_progress'>>) => {
  const { config, view, answer, send } = useChatContext()
  const { state, itinerary: it } = view
  const course = courseById(config, it.course)
  const hub = hubOf(config, state.plan)
  const labels = progressLabel(course?.area ?? '코스', hub.name)
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
  const target =
    state.plan.stage === 'OUTBOUND'
      ? {
          title: `${course?.area ?? '코스'}로 이동`,
          desc: `${it.legs.find((l) => l.kind === 'OUTBOUND')?.mode ? transportLabel[it.legs.find((l) => l.kind === 'OUTBOUND')!.mode] : '이동'} · 시연 추정 약 ${it.outbound}분`,
          url: legUrl ?? map('COURSE'),
        }
      : state.plan.stage === 'LOCAL' && place
        ? {
            title: place.attrs.title,
            desc: `${place.attrs.short} · ${place.attrs.subtitle} · ${clock(stop.start)}–${clock(stop.end)}`,
            url: legUrl ?? map(place.id, 'walk'),
          }
        : {
            title: `${hub.name}(으)로`,
            desc:
              it.planningArrival === null
                ? `${hub.name}(으)로 이동해요`
                : `계획상 ${clock(it.planningArrival)} 도착 · ${departLabel(config, state.plan)}`,
            url: legUrl ?? map(hub.id),
          }

  return (
    <Card>
      <CardHeader>
        <CardDescription>지금 할 일</CardDescription>
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
                send(`${place.attrs.short}에서 찍은 사진을 커뮤니티에 올릴래요`)
              }
            >
              <Camera />
              이곳에서 찍은 사진 올리기
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
            <Navigation /> 길찾기
          </a>
        </Button>
      </CardFooter>
    </Card>
  )
}

// ── Read: course preview ───────────────────────────────────────────────

const decisionLabel: Record<Decision, string> = {
  GO: '추천 코스',
  INDOOR: '실내 위주',
  SHORTEN: '단축 코스',
  CANCEL: '귀가 우선',
  MEDICAL_FIRST: '의료 우선',
  NEEDS_DATA: '확인 필요',
  INCOMPLETE: '입력 필요',
}

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
  const course = courseById(config, it.course)
  const hub =
    config.anchors.find((anchor) => anchor.id === it.hub) ??
    hubOf(config, view.state.plan)
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>
          {title}
          {course && it.stops.length > 0 && ` · ${course.title}`}
        </CardDescription>
        <CardTitle>
          {it.planningArrival === null
            ? '관광 없이 귀가'
            : `${hub.name} ${clock(it.planningArrival)} 도착`}
        </CardTitle>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">{decisionLabel[it.decision]}</Badge>
          <Badge variant="outline">
            {depart ?? `귀가 거점 도착 목표 ${clock(it.stationTarget)}`}
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
  if (part.state === 'input-streaming' || part.state === 'input-available')
    return null
  if (part.state !== 'output-available') return null
  if ('validationErrors' in part.output && part.output.validationErrors?.length)
    return null
  return (
    <CourseSummary
      it={part.output.itinerary}
      depart={part.output.depart}
      title={part.output.isChange ? '바꾸면 이렇게 돼요' : '지금 조건의 코스'}
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
    return <Shimmer>반영하고 있어요…</Shimmer>
  if (part.state === 'output-denied') return <Answered>{declined}</Answered>
  if (part.state === 'output-available')
    return <Answered>{done(part.output)}</Answered>
  return null
}

const ApplyChangeCard = (props: CardProps<PartOf<'apply_plan_change'>>) => (
  <ApprovalCard
    {...props}
    question="이 변경을 적용할까요?"
    yes="적용"
    no="그대로 두기"
    declined="기존 계획을 유지했어요"
    done={(o) =>
      (o as { applied: boolean }).applied
        ? '변경을 반영했어요'
        : '조건이 바뀌어 반영하지 않았어요'
    }
  />
)

const StartJourneyCard = (props: CardProps<PartOf<'start_journey'>>) => (
  <ApprovalCard
    {...props}
    question="이 코스로 출발할까요?"
    yes="출발"
    no="아직이요"
    declined="출발을 미뤘어요"
    done={(o) =>
      (o as { started: boolean }).started
        ? '여정을 시작했어요'
        : '출발할 수 있는 코스가 없어요'
    }
  />
)

// ── Read: safety and summary ───────────────────────────────────────────

const SafetyCard = ({ part }: CardProps<PartOf<'show_safety_help'>>) =>
  part.state !== 'output-available' ? null : (
    <Alert variant="destructive">
      <HeartPulse />
      <AlertTitle>몸을 먼저 살펴주세요</AlertTitle>
      <AlertDescription>
        <p>{part.output.message}</p>
        <Button asChild variant="destructive" size="sm" className="mt-2">
          <a href={`tel:${part.output.emergency}`}>
            <Phone /> 긴급하면 {part.output.emergency}
          </a>
        </Button>
      </AlertDescription>
    </Alert>
  )

const SummaryCard = ({ part }: CardProps<PartOf<'summarize_trip'>>) =>
  part.state !== 'output-available' ? null : (
    <Card size="sm">
      <CardHeader>
        <CardDescription>오늘의 여정</CardDescription>
        <CardTitle>
          {part.output.arrivedAt} {part.output.hub} 도착 · {part.output.depart}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {part.output.visited.length
          ? part.output.visited.join(' → ')
          : '관광은 다음에 해요'}
      </CardContent>
    </Card>
  )

// ── Everything else: the stock AI Elements tool view ───────────────────

/** Read-tool telemetry is transient; completed results live in the answer. */
const GenericTool = ({ part }: CardProps<ToolPart>) =>
  part.state === 'output-error' ? (
    <p role="status" className="text-xs text-muted-foreground">
      정보를 확인하지 못했어요. 답변에서 대체 안내를 확인해 주세요.
    </p>
  ) : null

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
