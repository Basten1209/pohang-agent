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
import { Checkbox } from '@/components/ui/checkbox'
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
import { Choice, PlaceIcon } from '#/app/bits'
import { mapUrl } from '#/core/links'
import type { Decision, Itinerary } from '#/core/planner'
import type { Plan } from '#/core/schema'
import type { Progress } from '#/core/stage'
import { progressOptions } from '#/core/stage'
import { clock, minutes } from '#/core/time'
import type { PartOf, ToolPart } from './context'
import { useChatContext } from './context'

/**
 * One component per agent tool. A card is interactive only while it is the
 * open question of the latest assistant message; afterwards it shows what
 * was answered. Tools without a card fall back to the AI Elements `Tool`.
 */

type CardProps<P> = { part: P; interactive: boolean }

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

// ── Ask: trip basics ───────────────────────────────────────────────────

const dateLabel = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split('-')
  return `${Number(m)}월 ${Number(d)}일 ${iso.slice(11, 16)}`
}

const BasicsCard = ({
  part,
  interactive,
}: CardProps<PartOf<'ask_trip_basics'>>) => {
  const { config, view, answer } = useChatContext()
  const places = config.places.filter((p) => p.active)
  const prefill = part.input?.prefill
  const plan = view.state.plan
  const [arrivalAt, setArrivalAt] = useState(
    prefill?.arrivalAt ?? plan.arrivalAt,
  )
  const [trainTime, setTrainTime] = useState(
    prefill?.trainTime ?? plan.trainTime,
  )
  const [interests, setInterests] = useState<string[]>(
    (prefill?.interests ?? plan.interests).filter(
      (id): id is string => typeof id === 'string',
    ),
  )
  const [origin, setOrigin] = useState<Plan['origin']>(plan.origin)
  const name = (id: string) =>
    places.find((p) => p.id === id)?.attrs.interestLabel ?? id

  if (part.state === 'output-available')
    return skipped(part.output) || !('arrivalAt' in part.output) ? (
      <Unanswered />
    ) : (
      <Answered>
        {dateLabel(part.output.arrivalAt)} 도착 · {part.output.trainTime} 열차 ·{' '}
        {part.output.interests.map(name).join(', ') || '바로 귀가'}
      </Answered>
    )
  if (!interactive)
    return part.state === 'input-available' ? <Unanswered /> : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>포항 일정</CardTitle>
        <CardDescription>
          다 몰라도 괜찮아요. 나중에 채팅으로 바꿀 수 있어요.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="basics-arrival">포항 도착</FieldLabel>
            <Input
              id="basics-arrival"
              type="datetime-local"
              value={arrivalAt}
              onChange={(e) => e.target.value && setArrivalAt(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="basics-train">서울행 열차 출발</FieldLabel>
            <Input
              id="basics-train"
              type="time"
              value={trainTime}
              onChange={(e) => e.target.value && setTrainTime(e.target.value)}
            />
            <FieldDescription>대회 다음 날 · 포항역</FieldDescription>
          </Field>
          <FieldSet>
            <FieldLegend variant="label">완주 후 하고 싶은 일</FieldLegend>
            <ToggleGroup
              type="multiple"
              variant="outline"
              className="flex-wrap"
              value={interests}
              onValueChange={setInterests}
            >
              {places.map((p) => (
                <ToggleGroupItem key={p.id} value={p.id}>
                  <PlaceIcon name={p.attrs.icon} />
                  {p.attrs.interestLabel}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FieldSet>
          <FieldSet>
            <FieldLegend variant="label">관광 출발 장소</FieldLegend>
            <RadioGroup
              value={origin}
              onValueChange={(v) => setOrigin(v as Plan['origin'])}
            >
              <Choice
                id="basics-race"
                value="RACE"
                title="대회장"
                description="짐을 가지고 바로 이동"
              />
              <Choice
                id="basics-hotel"
                value="HOTEL"
                title="숙소"
                description="짐을 찾은 뒤 출발"
              />
            </RadioGroup>
          </FieldSet>
        </FieldGroup>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={() =>
            answer('ask_trip_basics', part.toolCallId, {
              arrivalAt,
              trainTime,
              interests,
              origin,
            })
          }
        >
          이렇게 저장할게요
        </Button>
      </CardFooter>
    </Card>
  )
}

// ── Ask: condition after the race ──────────────────────────────────────

const conditionLabel = {
  OK: '괜찮아요',
  TIRED: '조금 지쳤어요',
  UNWELL: '몸이 안 좋아요',
}

const ConditionCard = ({
  part,
  interactive,
}: CardProps<PartOf<'ask_condition'>>) => {
  const { view, answer } = useChatContext()
  const plan = view.state.plan
  const [condition, setCondition] = useState<'OK' | 'TIRED' | 'UNWELL' | ''>('')
  const [walkingLimit, setWalkingLimit] = useState<15 | 30>(
    plan.walkingLimit === 15 ? 15 : 30,
  )
  const [readyTime, setReadyTime] = useState(plan.readyTime)
  const [baggageCollected, setBaggage] = useState(plan.baggageCollected)

  if (part.state === 'output-available')
    return skipped(part.output) || !('condition' in part.output) ? (
      <Unanswered />
    ) : (
      <Answered>
        {conditionLabel[part.output.condition]} · 걷기{' '}
        {part.output.walkingLimit}분 · {part.output.readyTime} 출발
      </Answered>
    )
  if (!interactive)
    return part.state === 'input-available' ? <Unanswered /> : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>지금 상태</CardTitle>
        <CardDescription>이 값으로 코스를 계산해요.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <FieldSet>
            <FieldLegend variant="label">컨디션</FieldLegend>
            <RadioGroup
              value={condition}
              onValueChange={(v) => setCondition(v as typeof condition)}
            >
              <Choice id="cond-ok" value="OK" title="괜찮아요" />
              <Choice id="cond-tired" value="TIRED" title="조금 지쳤어요" />
              <Choice
                id="cond-unwell"
                value="UNWELL"
                title="몸이 안 좋아요"
                description="관광 계산을 멈추고 도움을 안내해요."
              />
            </RadioGroup>
          </FieldSet>
          {condition !== 'UNWELL' && (
            <>
              <FieldSet>
                <FieldLegend variant="label">걷기</FieldLegend>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={String(walkingLimit)}
                  onValueChange={(v) =>
                    v && setWalkingLimit(v === '15' ? 15 : 30)
                  }
                >
                  <ToggleGroupItem value="15">15분 이내</ToggleGroupItem>
                  <ToggleGroupItem value="30">30분 이내</ToggleGroupItem>
                </ToggleGroup>
              </FieldSet>
              <Field>
                <FieldLabel htmlFor="cond-ready">출발 준비 완료</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="cond-ready"
                    type="time"
                    value={readyTime}
                    onChange={(e) =>
                      e.target.value && setReadyTime(e.target.value)
                    }
                  />
                  <Button
                    variant="outline"
                    onClick={() => setReadyTime(clock(minutes(readyTime) + 30))}
                  >
                    +30분
                  </Button>
                </div>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="cond-baggage"
                  checked={baggageCollected}
                  onCheckedChange={(v) => setBaggage(v === true)}
                />
                <FieldLabel htmlFor="cond-baggage" className="font-normal">
                  출발 전에 짐을 모두 챙길 수 있어요
                </FieldLabel>
              </Field>
            </>
          )}
        </FieldGroup>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          disabled={!condition}
          onClick={() =>
            condition &&
            answer('ask_condition', part.toolCallId, {
              condition,
              walkingLimit,
              readyTime,
              baggageCollected,
            })
          }
        >
          {condition === 'UNWELL' ? '도움 안내 받기' : '코스 계산하기'}
        </Button>
      </CardFooter>
    </Card>
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

const progressLabel: Record<Progress, string> = {
  ARRIVED: '구룡포 도착',
  STOP_DONE: '다 봤어요',
  SKIP: '건너뛰기',
  REST: '30분 더 쉬기',
  START_RETURN: '역으로 출발',
  AT_STATION: '포항역 도착',
}

const ProgressCard = ({
  part,
  interactive,
}: CardProps<PartOf<'await_progress'>>) => {
  const { config, view, answer } = useChatContext()
  if (part.state === 'output-available')
    return skipped(part.output) || !('event' in part.output) ? null : (
      <Answered>{progressLabel[part.output.event]}</Answered>
    )
  if (part.state !== 'input-available' || !interactive) return null

  const { state, itinerary: it } = view
  const options = progressOptions(state, it)
  if (!options.length) return null
  const map = mapUrl(config)
  const [stop] = it.stops
  const place = stop && config.places.find((p) => p.id === stop.id)
  const target =
    state.plan.stage === 'OUTBOUND'
      ? {
          title: '구룡포로 이동',
          desc: '버스로 이동해요',
          url: map('GURYONGPO'),
        }
      : state.plan.stage === 'LOCAL' && place
        ? {
            title: place.attrs.title,
            desc: `${clock(stop.start)}–${clock(stop.end)} · 다음 행동`,
            url: map(place.id, 'walk'),
          }
        : {
            title: '포항역으로',
            desc:
              it.planningArrival === null
                ? '역으로 이동해요'
                : `계획상 ${clock(it.planningArrival)} 도착`,
            url: map('STATION'),
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
            {progressLabel[o]}
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
  const { config } = useChatContext()
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle>
          {it.planningArrival === null
            ? '관광 없이 귀가'
            : `포항역 ${clock(it.planningArrival)} 도착`}
        </CardTitle>
        <div>
          <Badge variant="secondary">{decisionLabel[it.decision]}</Badge>
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
          {part.output.arrivedAt} 포항역 도착 · {part.output.trainTime} 열차
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {part.output.visited.length
          ? part.output.visited.join(' → ')
          : '구룡포는 다음에 들러요'}
      </CardContent>
    </Card>
  )

// ── Everything else: the stock AI Elements tool view ───────────────────

const toolTitle: Record<string, string> = {
  explain_plan: '코스 근거 확인',
  check_live_conditions: '디지털 트윈 확인',
  compare_transport: '이동수단 비교',
  record_race_progress: '진행 기록',
  set_demo_observation: '시연 조건 적용',
}

const GenericTool = ({ part }: CardProps<ToolPart>) => (
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

/** Data-directed dispatch: tool name → card. */
const cards: Record<string, (props: CardProps<never>) => ReactNode> = {
  ask_trip_basics: BasicsCard,
  ask_condition: ConditionCard,
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
