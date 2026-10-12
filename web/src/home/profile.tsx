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
import { useI18n } from '#/i18n/react'
import { eventIn } from '#/core/race-event'
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
  submitLabel,
  onboarding = false,
}: {
  config: TripConfig
  view: TripView
  tripId: string
  onSaved: (view: TripView) => void
  submitLabel?: string
  onboarding?: boolean
}) => {
  const { t, d, locale } = useI18n()
  const event = eventIn(config.event, locale)
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
  const steps = [
    t('profile.step1'),
    t('profile.step2'),
    t('profile.step3'),
    t('profile.step4'),
  ]
  const titles = [
    t('profile.title1'),
    t('profile.title2'),
    t('profile.title3'),
    t('profile.title4'),
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
          {t('profile.preparing', { name: nickname || t('common.runner') })}
        </h1>
        <ol className="space-y-3" aria-live="polite">
          {[t('profile.prep1'), t('profile.prep2'), t('profile.prep3')].map(
            (label, i) => (
              <li
                key={label}
                className={`flex items-center gap-3 rounded-xl border p-4 text-sm ${i === preparing ? 'border-primary bg-secondary text-primary' : 'bg-card text-muted-foreground'}`}
              >
                {i < preparing ? (
                  <Check
                    className="size-5 text-primary"
                    aria-label={t('profile.done')}
                  />
                ) : (
                  <span className="grid size-5 shrink-0 place-items-center rounded-full border text-xs">
                    {i + 1}
                  </span>
                )}
                {label}
              </li>
            ),
          )}
        </ol>
        {preparing === 3 && (
          <p role="status" className="text-center text-sm text-primary">
            {t('profile.ready')}
          </p>
        )}
        {failed && (
          <>
            <p role="alert" className="text-sm text-destructive">
              {t('profile.prepFailed')}
            </p>
            <Button className="h-12" onClick={() => void save()}>
              {t('profile.prepRetry')}
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
              aria-label={t('profile.stepLabel', { n: step + 1 })}
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
                  t('profile.lead1'),
                  t('profile.lead2'),
                  t('profile.lead3'),
                  t('profile.lead4'),
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
                  {t('profile.demoEvent')}
                </ItemDescription>
                <ItemTitle>{event.name}</ItemTitle>
                <ItemDescription>
                  {event.dateLabel} · {event.gun}
                  <br />
                  {event.venue} · {event.category}
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
            {t('profile.eventNote')}
          </p>
        </div>
      )}
      <FieldGroup>
        {at(1) && (
          <>
            {onboarding && <GullPose pose="wave" className="mx-auto w-40" />}
            <Field>
              <FieldLabel htmlFor="nickname">
                {t('profile.nickname')}{' '}
                <span className="font-normal text-muted-foreground">
                  {t('profile.optional')}
                </span>
              </FieldLabel>
              <Input
                id="nickname"
                className="h-12 bg-card"
                placeholder={t('common.runner')}
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
                {t('profile.modeLegend')}
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
                    {d(`mode.${m.id}`, m.label)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>

            <Field>
              <FieldLabel htmlFor="depart-time">
                {mode.noun === '귀가'
                  ? t('profile.returnTime')
                  : t('profile.departTime', {
                      noun: d(`noun.${mode.id}`, mode.noun),
                    })}
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
                  ? t('profile.arriveBy', {
                      hub: d(`hub.${mode.hub}`, hubOf(config, form).name),
                      min: mode.bufferMin,
                    })
                  : t('profile.backBy')}
              </FieldDescription>
            </Field>
          </>
        )}

        {at(3) && (
          <>
            <FieldSet>
              <FieldLegend variant="label">
                {t('profile.courseLegend')}
              </FieldLegend>
              {journeyStarted && (
                <FieldDescription>{t('profile.courseLocked')}</FieldDescription>
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
                    title={d(`course.${c.id}`, c.title)}
                    description={d(
                      `tags.${c.id}`,
                      c.tags.slice(0, 3).join(' · '),
                    )}
                  />
                ))}
                <Choice
                  id="course-auto"
                  value={AUTO_COURSE}
                  title={t('profile.recommend')}
                  description={t('profile.recommendDesc')}
                />
              </RadioGroup>
            </FieldSet>

            <FieldSet>
              <FieldLegend variant="label">
                {t('profile.interests')}
              </FieldLegend>
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
                    {d(`interest.${String(c.value)}`, c.label)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>

            <FieldSet>
              <FieldLegend variant="label">{t('profile.origin')}</FieldLegend>
              <RadioGroup
                value={form.origin}
                onValueChange={(v) => set('origin', v as Form['origin'])}
              >
                <Choice
                  id="origin-race"
                  value="RACE"
                  title={t('profile.originRace')}
                />
                <Choice
                  id="origin-hotel"
                  value="HOTEL"
                  title={t('profile.originHotel')}
                />
              </RadioGroup>
            </FieldSet>
          </>
        )}
      </FieldGroup>

      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t('profile.saveFailed')}
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
            {t('profile.prev')}
          </Button>
        )}
        <Button
          type="submit"
          size="lg"
          className="h-12 min-w-0 flex-1 whitespace-normal leading-snug"
          disabled={saving || (onboarding && step === 0 && !eventSelected)}
        >
          {saving
            ? t('profile.saving')
            : onboarding && step < 3
              ? step === 1
                ? t('profile.useName')
                : t('profile.next')
              : (submitLabel ?? t('profile.submit'))}
          {onboarding && step < 3 && <ArrowRight />}
        </Button>
      </div>
    </form>
  )
}
