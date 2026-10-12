import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Flag } from 'lucide-react'
import { GullPose } from '#/brand/brand'
import { InstallApp } from '#/home/install'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup } from '@/components/ui/radio-group'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Choice } from '#/app/bits'
import { postEvents } from '#/app/trip-client'
import { activeCourses, hubOf, modeOf } from '#/core/route'
import type { Interest, Plan, SlotId, TripConfig } from '#/core/schema'
import { AUTO_COURSE } from '#/core/schema'
import type { Details } from '#/core/slots'
import { fillSlots } from '#/core/slots'
import type { TripView } from '#/core/view'
import { chipOn } from '#/app/bits'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'

/**
 * Onboarding asks one group at a time; later edits remain a single form.
 * Both record the very same `slots.filled` events as the chat's
 * `update_trip_details`, so the agent never asks these again.
 */

type Form = {
  departMode: Plan['departMode']
  departTime: string
  course: string
  interests: Interest[]
  origin: Plan['origin']
}

const initialForm = (config: TripConfig, view: TripView): Form => {
  const { plan, answered } = view.state
  const has = (slot: SlotId) => answered.includes(slot)
  return {
    departMode: plan.departMode,
    departTime: plan.departTime,
    // Guryongpo is the default; "추천" stays one tap away.
    course:
      has('course') &&
      (plan.course === AUTO_COURSE ||
        activeCourses(config).some((c) => c.id === plan.course))
        ? plan.course
        : (config.policy.featuredCourse ?? AUTO_COURSE),
    interests: plan.interests,
    origin: plan.origin,
  }
}

export const ProfileForm = ({
  config,
  view,
  tripId,
  onSaved,
  submitLabel = '저장하고 시작하기',
  onboarding = false,
}: {
  config: TripConfig
  view: TripView
  tripId: string
  onSaved: (view: TripView) => void
  submitLabel?: string
  onboarding?: boolean
}) => {
  const [step, setStep] = useState(0)
  const [eventSelected, setEventSelected] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (onboarding) {
      window.scrollTo({ top: 0 })
      heading.current?.focus({ preventScroll: true })
    }
  }, [step, onboarding])
  const [form, setForm] = useState(() => initialForm(config, view))
  const [nickname, setNickname] = useState(view.state.plan.nickname ?? '')
  const [saving, setSaving] = useState(false)
  const [preparing, setPreparing] = useState(0)
  const saved = useRef<TripView | null>(null)
  const [failed, setFailed] = useState(false)
  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }))
  const mode = modeOf(config, form)
  const interests = config.conversation.slots.interests?.choices ?? []
  const journeyStarted = view.state.plan.stage !== 'BEFORE'
  const at = (n: number) => !onboarding || step === n
  const steps = ['참가 대회', '이름 확인', '귀가 일정', '완주 후 여행']
  const titles = [
    '어떤 대회에 참가하나요?',
    '어떻게 불러 드릴까요?',
    '돌아갈 시간도 챙겨요',
    '완주 다음은, 구룡포.',
  ]
  const next = () => setStep((s) => Math.min(s + 1, 3))

  const save = async () => {
    if (saving) return
    setSaving(true)
    setPreparing(0)
    setFailed(false)
    const details: Partial<Details> = { ...form }
    const slots = Object.keys(form) as SlotId[]
    try {
      const { trip } =
        saved.current && onboarding
          ? { trip: saved.current }
          : await postEvents(tripId, [
              ...fillSlots(config, view.state, details, slots),
              { type: 'plan.patched', patch: { nickname: nickname.trim() } },
            ])
      saved.current = trip
      if (onboarding) {
        for (const [index, part] of ['event', 'guide'].entries()) {
          setPreparing(index + 1)
          const response = await fetch('/api/onboarding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify({ tripId, part }),
          })
          if (!response.ok) throw new Error('preparation')
          await response.json()
        }
        setPreparing(3)
        // Brief completion acknowledgement, not simulated work/progress.
        await new Promise((resolve) => setTimeout(resolve, 700))
      }
      onSaved(trip)
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  if (onboarding && (saving || (failed && saved.current)))
    return (
      <section
        className="flex min-h-[75dvh] flex-col justify-center gap-6"
        aria-labelledby="preparing-title"
      >
        <GullPose pose="think" className="mx-auto w-40" decorative />
        <h1 id="preparing-title" className="brand-heading text-center text-2xl">
          {nickname || '러너'}님의 하루를 준비해요
        </h1>
        <ol className="space-y-3" aria-live="polite">
          {[
            'Agent에게 정보를 전달하고 있어요',
            '참여하는 대회 정보를 정리하고 있어요',
            '주변 여행 정보를 사전 탐색하고 있어요',
          ].map((label, i) => (
            <li
              key={label}
              className={`flex items-center gap-3 rounded-xl border p-4 text-sm ${i === preparing ? 'border-primary bg-secondary text-primary' : 'bg-card text-muted-foreground'}`}
            >
              {i < preparing ? (
                <Check className="size-5 text-primary" aria-label="완료" />
              ) : (
                <span className="grid size-5 shrink-0 place-items-center rounded-full border text-xs">
                  {i + 1}
                </span>
              )}
              {label}
            </li>
          ))}
        </ol>
        {preparing === 3 && (
          <p role="status" className="text-center text-sm text-primary">
            준비됐어요. 오늘의 여정을 시작해요!
          </p>
        )}
        {failed && (
          <>
            <p role="alert" className="text-sm text-destructive">
              준비를 마치지 못했어요. 저장한 정보는 그대로예요.
            </p>
            <Button className="h-12" onClick={() => void save()}>
              다시 준비하기
            </Button>
          </>
        )}
      </section>
    )

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        if (onboarding && step < 3) {
          if (step > 0 || eventSelected) next()
        } else void save()
      }}
    >
      {onboarding && (
        <>
          <div className="flex items-center justify-between">
            <span className="font-extrabold tracking-tight text-foreground">
              RUN2구룡포
            </span>
            <InstallApp compact />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
              <span>{steps[step]}</span>
              <span>{step + 1} / 4</span>
            </div>
            <Progress
              value={((step + 1) / 4) * 100}
              aria-label={`가입 준비 ${step + 1}단계`}
            />
            <h1
              ref={heading}
              tabIndex={-1}
              className="brand-heading pt-3 text-3xl outline-none"
            >
              {titles[step]}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {
                [
                  '달리고, 구룡포를 만나다. 오늘의 출발을 함께해요.',
                  '갈매기 여행 친구가 이 이름으로 불러 드려요.',
                  '열차·버스 출발 전에 여유 있게 도착하도록 도와드려요.',
                  '가고 싶은 곳을 알려주시면 완주 후 컨디션에 맞춰 조정해요.',
                ][step]
              }
            </p>
          </div>
        </>
      )}
      {onboarding && step === 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-center">
            <GullPose className="w-52" />
          </div>
          <Item
            asChild
            variant="outline"
            className="aria-pressed:border-primary aria-pressed:bg-secondary"
          >
            <button
              type="button"
              aria-pressed={eventSelected}
              onClick={() => setEventSelected(true)}
            >
              <ItemMedia variant="icon">
                <Flag className="text-primary" />
              </ItemMedia>
              <ItemContent>
                <ItemDescription className="font-semibold text-primary">
                  발표용 가상 대회
                </ItemDescription>
                <ItemTitle>{config.event.name}</ItemTitle>
                <ItemDescription>
                  {config.event.dateLabel} · {config.event.gun}
                  <br />
                  {config.event.venue} · {config.event.category}
                </ItemDescription>
              </ItemContent>
              {eventSelected && (
                <ItemActions>
                  <Check className="size-5 text-primary" />
                </ItemActions>
              )}
            </button>
          </Item>
          <p className="text-xs leading-relaxed text-muted-foreground">
            현재는 이 대회로 체험할 수 있어요. 완주 후 여행은 구룡포·호미곶을
            중심으로 안내해요.
          </p>
        </div>
      )}
      <FieldGroup>
        {at(1) && (
          <>
            {onboarding && <GullPose pose="wave" className="mx-auto w-40" />}
            <Field>
              <FieldLabel htmlFor="nickname">
                어떻게 불러 드릴까요?{' '}
                <span className="font-normal text-muted-foreground">
                  (선택)
                </span>
              </FieldLabel>
              <Input
                id="nickname"
                className="h-12 bg-card"
                placeholder="러너"
                autoComplete="nickname"
                maxLength={20}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </Field>
          </>
        )}
        {at(2) && (
          <>
            <FieldSet>
              <FieldLegend variant="label">
                대회 끝나고 어떻게 돌아가요?
              </FieldLegend>
              <ToggleGroup
                type="single"
                variant="outline"
                className="flex-wrap"
                value={form.departMode}
                onValueChange={(v) =>
                  v && set('departMode', v as Form['departMode'])
                }
              >
                {config.modes.map((m) => (
                  <ToggleGroupItem className={chipOn} key={m.id} value={m.id}>
                    {m.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>

            <Field>
              <FieldLabel htmlFor="depart-time">
                {mode.noun === '귀가'
                  ? '돌아올 시각'
                  : `${mode.noun} 출발 시각`}
              </FieldLabel>
              <Input
                id="depart-time"
                className="h-12 bg-card"
                type="time"
                required
                value={form.departTime}
                onChange={(e) =>
                  e.target.value && set('departTime', e.target.value)
                }
              />
              <FieldDescription>
                {mode.bufferMin
                  ? `${hubOf(config, form).name}에 ${mode.bufferMin}분 전 도착을 목표로 계산해요.`
                  : '이 시각까지 대회장 근처로 돌아오도록 계산해요.'}
              </FieldDescription>
            </Field>
          </>
        )}

        {at(3) && (
          <>
            <FieldSet>
              <FieldLegend variant="label">
                완주하고 가 보고 싶은 곳
              </FieldLegend>
              {journeyStarted && (
                <FieldDescription>
                  이미 출발해서 코스는 대화로만 바꿀 수 있어요.
                </FieldDescription>
              )}
              <RadioGroup
                value={form.course}
                onValueChange={(v) => set('course', v)}
                disabled={journeyStarted}
              >
                {activeCourses(config).map((c) => (
                  <Choice
                    key={c.id}
                    id={`course-${c.id}`}
                    value={c.id}
                    title={c.title}
                    description={c.tags.slice(0, 3).join(' · ')}
                  />
                ))}
                <Choice
                  id="course-auto"
                  value={AUTO_COURSE}
                  title="추천해 주세요"
                  description="시간과 컨디션에 맞춰 골라 드려요"
                />
              </RadioGroup>
            </FieldSet>

            <FieldSet>
              <FieldLegend variant="label">하고 싶은 일 (여러 개)</FieldLegend>
              <ToggleGroup
                type="multiple"
                variant="outline"
                className="flex-wrap"
                value={form.interests}
                onValueChange={(v) => set('interests', v as Interest[])}
              >
                {interests.map((c) => (
                  <ToggleGroupItem
                    className={chipOn}
                    key={String(c.value)}
                    value={String(c.value)}
                  >
                    {c.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>

            <FieldSet>
              <FieldLegend variant="label">완주 후 출발 장소</FieldLegend>
              <RadioGroup
                value={form.origin}
                onValueChange={(v) => set('origin', v as Form['origin'])}
              >
                <Choice
                  id="origin-race"
                  value="RACE"
                  title="대회장(영일대)에서 바로"
                />
                <Choice
                  id="origin-hotel"
                  value="HOTEL"
                  title="숙소에 들렀다가"
                />
              </RadioGroup>
            </FieldSet>
          </>
        )}
      </FieldGroup>

      {failed && (
        <p role="alert" className="text-sm text-destructive">
          저장하지 못했어요. 다시 눌러 주세요.
        </p>
      )}
      <div className="flex gap-2">
        {onboarding && step > 0 && (
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-12 w-24 shrink-0"
            disabled={saving}
            onClick={() => setStep((s) => s - 1)}
          >
            <ArrowLeft />
            이전
          </Button>
        )}
        <Button
          type="submit"
          size="lg"
          className="h-12 min-w-0 flex-1 whitespace-normal leading-snug"
          disabled={saving || (onboarding && step === 0 && !eventSelected)}
        >
          {saving
            ? '저장하고 있어요…'
            : onboarding && step < 3
              ? step === 1
                ? '이 이름으로 계속하기'
                : '다음'
              : submitLabel}
          {onboarding && step < 3 && <ArrowRight />}
        </Button>
      </div>
    </form>
  )
}
