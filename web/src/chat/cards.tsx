import { Check, CircleSlash, HeartPulse, Navigation, Phone } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Shimmer } from '@/components/ai-elements/shimmer'
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool'
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
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PlaceIcon } from '#/app/bits'
import { mapUrl } from '#/core/links'
import type { Decision, Itinerary } from '#/core/planner'
import type { ChoicePrompt } from '#/core/slots'
import type { Progress } from '#/core/stage'
import { progressOptions } from '#/core/stage'
import { courseById, departLabel, hubOf } from '#/core/route'
import { clock } from '#/core/time'
import type { PartOf, ToolPart } from './context'
import { useChatContext } from './context'

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
  const { config, view, answer } = useChatContext()
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
  const place = stop && config.places.find((p) => p.id === stop.id)
  const target =
    state.plan.stage === 'OUTBOUND'
      ? {
          title: `${course?.area ?? '코스'}로 이동`,
          desc: `${course?.outbound.via ?? '대중교통'} · 약 ${it.outbound}분`,
          url: map('COURSE'),
        }
      : state.plan.stage === 'LOCAL' && place
        ? {
            title: place.attrs.title,
            desc: `${clock(stop.start)}–${clock(stop.end)} · 다음 행동`,
            url: map(place.id, 'walk'),
          }
        : {
            title: `${hub.name}(으)로`,
            desc:
              it.planningArrival === null
                ? `${hub.name}(으)로 이동해요`
                : `계획상 ${clock(it.planningArrival)} 도착 · ${departLabel(config, state.plan)}`,
            url: map(hub.id),
          }

  return (
    <Card>
      <CardHeader>
        <CardDescription>지금 할 일</CardDescription>
        <CardTitle>{target.title}</CardTitle>
        <CardDescription>{target.desc}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
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
}: {
  it: Itinerary
  title: string
}) => {
  const { config, view } = useChatContext()
  const course = courseById(config, it.course)
  const hub = hubOf(config, view.state.plan)
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
            {departLabel(config, view.state.plan)}
          </Badge>
        </div>
      </CardHeader>
      {it.stops.length > 0 && (
        <CardContent>
          <ItemGroup>
            {it.stops.map((s) => {
              const place = config.places.find((p) => p.id === s.id)
              return (
                <Item key={s.id} size="sm" className="px-0">
                  <ItemMedia variant="icon">
                    <PlaceIcon name={place?.attrs.icon ?? ''} />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{place?.attrs.title ?? s.id}</ItemTitle>
                    <ItemDescription>
                      {clock(s.start)}–{clock(s.end)}
                    </ItemDescription>
                  </ItemContent>
                </Item>
              )
            })}
          </ItemGroup>
        </CardContent>
      )}
    </Card>
  )
}

const PlanCourseCard = ({ part }: CardProps<PartOf<'plan_course'>>) => {
  if (part.state === 'input-streaming' || part.state === 'input-available')
    return <Shimmer>코스를 계산하고 있어요…</Shimmer>
  if (part.state !== 'output-available') return null
  return (
    <CourseSummary
      it={part.output.itinerary}
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

const toolTitle: Record<string, string> = {
  explain_plan: '코스 근거 확인',
  check_live_conditions: '디지털 트윈 확인',
  compare_transport: '이동수단 비교',
  set_demo_observation: '시연 조건 적용',
  get_race_info: '대회 정보 조회',
  search_guide: '안내 자료 검색',
  compare_courses: '코스 비교',
  find_nearby: '주변 관광정보 (한국관광공사)',
  get_place_detail: '장소 상세 (한국관광공사)',
  get_directions: '길찾기·버스',
  get_bus_arrivals: '버스 도착정보 (TAGO)',
  get_train_times: '열차 시간표 (TAGO)',
  get_weather: '날씨 예보 (기상청)',
}

/** Lookups show only in presentation mode; the answer text says what they found. */
const GenericTool = ({ part }: CardProps<ToolPart>) =>
  useChatContext().showTools ? <ToolDetails part={part} /> : null

const ToolDetails = ({ part }: { part: ToolPart }) => (
  <Tool>
    <ToolHeader
      type={part.type}
      state={part.state}
      title={toolTitle[part.type.slice(5)] ?? part.type.slice(5)}
    />
    <ToolContent>
      <ToolInput input={part.input} />
      <ToolOutput
        output={'output' in part ? part.output : undefined}
        errorText={'errorText' in part ? part.errorText : undefined}
      />
    </ToolContent>
  </Tool>
)

/** Bookkeeping the conversation already shows in words. */
const Hidden = () => null

/** Data-directed dispatch: tool name → card. */
const cards: Record<string, (props: CardProps<never>) => ReactNode> = {
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
