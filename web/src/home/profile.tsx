import { useState } from 'react'
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

/**
 * The profile: what the chat used to ask one question at a time, on one
 * form. It records the very same `slots.filled` events as the chat's
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
}: {
  config: TripConfig
  view: TripView
  tripId: string
  onSaved: (view: TripView) => void
  submitLabel?: string
}) => {
  const [form, setForm] = useState(() => initialForm(config, view))
  const [nickname, setNickname] = useState(view.state.plan.nickname ?? '')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }))
  const mode = modeOf(config, form)
  const interests = config.conversation.slots.interests?.choices ?? []
  const journeyStarted = view.state.plan.stage !== 'BEFORE'

  const save = async () => {
    setSaving(true)
    setFailed(false)
    const details: Partial<Details> = { ...form }
    const slots = Object.keys(form) as SlotId[]
    try {
      const { trip } = await postEvents(tripId, [
        ...fillSlots(config, view.state, details, slots),
        { type: 'plan.patched', patch: { nickname: nickname.trim() } },
      ])
      onSaved(trip)
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="nickname">
            어떻게 불러 드릴까요?{' '}
            <span className="font-normal text-muted-foreground">(선택)</span>
          </FieldLabel>
          <Input
            id="nickname"
            placeholder="러너"
            autoComplete="nickname"
            maxLength={20}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </Field>
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
              <ToggleGroupItem key={m.id} value={m.id}>
                {m.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </FieldSet>

        <Field>
          <FieldLabel htmlFor="depart-time">
            {mode.noun === '귀가' ? '돌아올 시각' : `${mode.noun} 출발 시각`}
          </FieldLabel>
          <Input
            id="depart-time"
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

        <FieldSet>
          <FieldLegend variant="label">완주하고 가 보고 싶은 곳</FieldLegend>
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
              <ToggleGroupItem key={String(c.value)} value={String(c.value)}>
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
            <Choice id="origin-hotel" value="HOTEL" title="숙소에 들렀다가" />
          </RadioGroup>
        </FieldSet>
      </FieldGroup>

      {failed && (
        <p role="alert" className="text-sm text-destructive">
          저장하지 못했어요. 다시 눌러 주세요.
        </p>
      )}
      <Button type="submit" size="lg" disabled={saving}>
        {saving ? '저장하고 있어요…' : submitLabel}
      </Button>
    </form>
  )
}
