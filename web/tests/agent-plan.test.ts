import { describe, expect, it } from 'vitest'
import { seedConfig } from '#/core/defaults'
import {
  observationsKey,
  planningContext,
  preferencesKey,
} from '#/core/agent-plan'
import { fillSlots } from '#/core/slots'
import { canTravel, planner } from '#/core/planner'
import type { ItineraryProposal, Observations, Plan } from '#/core/schema'
import { planSchema } from '#/core/schema'
import {
  accept,
  advance,
  initialTrip,
  replay,
  tripStateSchema,
} from '#/core/trip'
import { tripView } from '#/core/view'
import { makeTools } from '#/server/agent/tools'
import type { TripRecord } from '#/server/trips'

const config = seedConfig
const obs: Observations = {
  ...config.defaults.observations,
  freshness: 'FRESH',
  readings: { congestion: 82, pm25: 60, uvIndex: 9 },
  sources: {
    congestion: {
      provenance: 'DEMO',
      sourceId: null,
      observedAt: null,
      fetchedAt: null,
      note: null,
    },
  },
}
const proposal: ItineraryProposal = {
  contextRevision: 0,
  course: 'guryongpo',
  stops: [
    {
      place: 'street',
      dwell: 5,
      travelMode: 'WALK',
      reason:
        '바다를 잠깐 보고 싶다는 요청에 맞춰 야외 체류를 짧게 선택했어요.',
    },
    {
      place: 'cafe',
      dwell: 35,
      travelMode: 'WALK',
      reason: '야외 활동 뒤 실내에서 쉬어요.',
    },
  ],
  outboundMode: 'TRANSIT',
  returnMode: 'TRANSIT',
  trafficBufferMin: 7,
  reasons: [
    '피곤하지만 비용을 아끼고 싶다는 요청을 고려해 버스와 짧은 산책, 실내 휴식을 골랐어요. 시연 환경 관측을 고려해 야외 체류를 짧게 잡았어요.',
  ],
}
const bare: Plan = {
  ...config.defaults.plan,
  condition: 'TIRED',
  course: 'guryongpo',
  walkingLimit: 120,
  baggageCollected: true,
}
const selected = (p: ItineraryProposal = proposal): Plan => ({
  ...bare,
  agentPlan: {
    proposal: p,
    observationsKey: observationsKey(obs),
    preferencesKey: preferencesKey(bare),
    model: 'test-model',
    createdAt: '2026-10-12T00:00:00Z',
  },
})
const calculate = planner(config)

const fixture = (ai = true, allowInitial = true) => {
  let record: TripRecord = {
    id: 'test',
    state: {
      ...initialTrip(config),
      created: true,
      phase: 3,
      plan: bare,
      observations: obs,
    },
    messages: [],
    meta: { ingested: [], previews: {}, liveSyncedAt: null },
  }
  const tools = makeTools({
    config,
    trip: () => record,
    isAI: () => ai,
    canStoreInitialPlan: allowInitial,
    canProposeChanges: true,
    observe: async () => [],
    newId: () => 'preview-1',
    commit: async (events) =>
      (record = { ...record, state: replay(record.state, events) }),
    remember: (p) => {
      record.meta.previews[p.id] = p
    },
  })
  const invoke = async (name: keyof typeof tools, input: unknown = {}) => {
    const execute = tools[name].execute as (
      input: unknown,
      opts: unknown,
    ) => Promise<any>
    return execute(input, { toolCallId: 'test', messages: [] })
  }
  return { invoke, record: () => record }
}

describe('model-selected itinerary and deterministic validation', () => {
  it('keeps model-selected buses, outdoor stop, dwell, ordering and buffer despite legacy thresholds', () => {
    const it = calculate(selected(), obs)
    expect(canTravel(it)).toBe(true)
    expect(it.planningSource).toBe('OPENAI')
    expect(it.stops.map((s) => [s.id, s.dwell])).toEqual([
      ['street', 5],
      ['cafe', 35],
    ])
    expect(
      it.legs
        .filter((l) => l.kind === 'OUTBOUND' || l.kind === 'RETURN')
        .map((l) => l.mode),
    ).toEqual(['TRANSIT', 'TRANSIT'])
    expect(it.trafficReserve).toBe(14)
    expect(it.reasons).toEqual(proposal.reasons)
    const rows = [...it.legs, ...it.stops].sort((a, b) => a.start - b.start)
    for (let i = 1; i < rows.length; i++)
      expect(rows[i].start).toBe(rows[i - 1].end)
    expect(rows.at(-1)!.end).toBe(it.planningArrival)
  })

  it('survives schema persistence, start, arrival and visit completion without reselecting stops', () => {
    let state = {
      ...initialTrip(config),
      plan: planSchema.parse(JSON.parse(JSON.stringify(selected()))),
      observations: obs,
    }
    const first = tripView(config, state).itinerary
    state = tripStateSchema.parse(JSON.parse(JSON.stringify(state)))
    expect(tripView(config, state).itinerary.needsReview).toBe(false)
    state = replay(state, accept(state, first).events)
    state = replay(
      state,
      advance(state, tripView(config, state).itinerary).events,
    )
    expect(tripView(config, state).itinerary.stops).toEqual(first.stops)
    state = replay(
      state,
      advance(state, tripView(config, state).itinerary).events,
    )
    const after = tripView(config, state).itinerary
    expect(after.stops.map((s) => s.id)).toEqual(['cafe'])
    expect(after.legs[0].from).toBe('street')
    expect(after.stops[0]).toEqual(first.stops[1])
  })

  it.each([
    ['unknown place', { stops: [{ ...proposal.stops[0], place: 'invented' }] }],
    ['duplicate', { stops: [proposal.stops[0], proposal.stops[0]] }],
    [
      'unavailable transport',
      {
        stops: [
          { ...proposal.stops[0], place: 'food', travelMode: 'TAXI' as const },
        ],
      },
    ],
  ])('rejects %s without substituting a rule-based itinerary', (_, patch) => {
    const it = calculate(selected({ ...proposal, ...patch }), obs)
    expect(it.decision).toBe('NEEDS_DATA')
    expect(it.validationErrors?.length).toBeGreaterThan(0)
    expect(it.stops).toEqual([])
    expect(it.planningSource).toBe('OPENAI')
  })

  it('rejects impossible deadlines, walking limits and missing routes, while retaining safety gates', () => {
    for (const patch of [{ departTime: '11:00' }, { walkingLimit: 5 }]) {
      expect(
        calculate({ ...selected(), ...patch }, obs).validationErrors?.length,
      ).toBeGreaterThan(0)
    }
    expect(
      calculate(selected(), { ...obs, routeAvailable: false }).decision,
    ).toBe('NEEDS_DATA')
    expect(
      calculate({ ...selected(), condition: 'UNWELL' }, obs).decision,
    ).toBe('MEDICAL_FIRST')
    expect(
      calculate({ ...selected(), baggageCollected: false }, obs).decision,
    ).toBe('INCOMPLETE')
  })

  it('flags new evidence for review without silently changing model choices', () => {
    const newer = { ...obs, readings: { ...obs.readings, congestion: 10 } }
    const it = calculate(selected(), newer)
    expect(it.needsReview).toBe(true)
    expect(it.stops.map((s) => s.id)).toEqual(['street', 'cafe'])
    expect(it.trafficReserve).toBe(14)
    const fetched = structuredClone(obs)
    fetched.sources.congestion.fetchedAt = '2026-10-12T02:00:00Z'
    expect(observationsKey(fetched)).toBe(observationsKey(obs))
  })

  it('context exposes unfiltered facts, outdoor candidates and unbuffered route options', () => {
    const ctx = planningContext(config, bare, obs)
    const gp = ctx.courses.find((c) => c.id === 'guryongpo')!
    expect(gp.places.some((p) => p.id === 'street' && p.outdoor)).toBe(true)
    expect(gp.outbound.map((o) => o.bufferMin)).toEqual([0, 0])
    expect(ctx.observations).toEqual(obs)
  })

  it('flags changed preferences for review while preserving the selected itinerary', () => {
    const state = {
      ...initialTrip(config),
      plan: selected(),
      observations: obs,
    }
    const changed = replay(
      state,
      fillSlots(config, state, { interests: ['indoor'] }),
    )
    expect(calculate(changed.plan, obs).needsReview).toBe(true)
    expect(calculate(changed.plan, obs).stops.map((s) => s.id)).toEqual([
      'street',
      'cafe',
    ])
    expect(
      calculate({ ...state.plan, revision: 123, currentTime: '13:15' }, obs)
        .needsReview,
    ).toBe(false)
  })
})

describe('nearby spots added to a trip', () => {
  const harbour = {
    id: 'tour-2610501',
    contentId: '2610501',
    title: '구룡포항',
    address: '경상북도 포항시 남구 구룡포읍',
    image: '',
    interest: 'view' as const,
    course: 'guryongpo',
    geo: { lat: 35.9879, lng: 129.5556 },
    dwell: 20,
  }
  const withHarbour: ItineraryProposal = {
    ...proposal,
    stops: [
      proposal.stops[0],
      {
        place: harbour.id,
        dwell: 20,
        travelMode: 'WALK',
        reason: '항구를 보고 싶다는 요청이에요.',
      },
      proposal.stops[1],
    ],
  }

  it('plans a model-selected nearby spot once the trip has added it', () => {
    const plan = planSchema.parse({
      ...selected(withHarbour),
      extraPlaces: [harbour],
    })
    const it = calculate(plan, obs)
    expect(it.validationErrors ?? []).toEqual([])
    expect(it.stops.map((s) => s.id)).toEqual(['street', harbour.id, 'cafe'])
    expect(
      tripView(config, { ...initialTrip(config), plan }).itinerary.stops,
    ).toHaveLength(3)
  })

  it('still rejects a spot the trip never added', () => {
    const it = calculate(selected(withHarbour), obs)
    expect(it.validationErrors?.join(' ')).toContain('이 권역에 없는 장소')
  })
})

describe('proposal tool lifecycle', () => {
  it('requires approval when adopting AI planning during an existing rule-based journey', async () => {
    const f = fixture()
    f.record().state.plan = {
      ...bare,
      stage: 'LOCAL',
      currentPlace: 'COURSE',
      currentTime: '13:00',
    }
    await f.invoke('get_planning_context')
    const result = await f.invoke('plan_course', { changes: null, proposal })
    expect(result.validationErrors).toEqual([])
    expect(result.isChange).toBe(true)
    expect(f.record().state.plan.agentPlan).toBeUndefined()
  })
  it('requires current context and a real proposal, then stores the same selection the UI reads', async () => {
    const f = fixture()
    expect(
      (await f.invoke('plan_course', { changes: null })).validationErrors
        .length,
    ).toBeGreaterThan(0)
    expect(
      (await f.invoke('plan_course', { changes: null, proposal })).previewId,
    ).toBeNull()
    expect(f.record().state.plan.agentPlan).toBeUndefined()
    await f.invoke('get_planning_context')
    const accepted = await f.invoke('plan_course', { changes: null, proposal })
    expect(accepted.validationErrors).toEqual([])
    expect(accepted.itinerary).toEqual(
      tripView(config, f.record().state).itinerary,
    )
    expect(f.record().state.plan.agentPlan?.proposal).toEqual(proposal)
  })

  it('returns actionable violations to the model and permits a corrected retry', async () => {
    const f = fixture()
    await f.invoke('get_planning_context')
    const invalid = await f.invoke('plan_course', {
      changes: null,
      proposal: {
        ...proposal,
        stops: [
          { ...proposal.stops[0], dwell: 180 },
          { ...proposal.stops[1], dwell: 180 },
        ],
      },
    })
    expect(invalid.validationErrors.length).toBeGreaterThan(0)
    expect(f.record().state.plan.agentPlan).toBeUndefined()
    expect(
      (await f.invoke('plan_course', { changes: null, proposal }))
        .validationErrors,
    ).toEqual([])
  })

  it('previews subsequent changes, preserves the current plan until approval, rejects stale revisions', async () => {
    const f = fixture()
    await f.invoke('get_planning_context')
    await f.invoke('plan_course', { changes: null, proposal })
    await f.invoke('get_planning_context')
    const next = { ...proposal, contextRevision: 1, stops: [proposal.stops[1]] }
    const preview = await f.invoke('plan_course', {
      changes: null,
      proposal: next,
    })
    expect(preview.isChange).toBe(true)
    expect(f.record().state.plan.agentPlan!.proposal.stops).toHaveLength(2)
    expect(
      (await f.invoke('apply_plan_change', { previewId: preview.previewId }))
        .applied,
    ).toBe(true)
    expect(f.record().state.plan.agentPlan!.proposal.stops).toHaveLength(1)
    expect(
      (await f.invoke('apply_plan_change', { previewId: preview.previewId }))
        .reason,
    ).toBe('STALE')
    expect(
      (
        await f.invoke('plan_course', { changes: null, proposal: next })
      ).validationErrors.join(),
    ).toContain('다시 조회')
  })

  it('does not save initial suggestions in a read-only comparison or mislabel fallback output as AI', async () => {
    const readOnly = fixture(true, false)
    await readOnly.invoke('get_planning_context')
    const result = await readOnly.invoke('plan_course', {
      changes: null,
      proposal,
    })
    expect(result.isChange).toBe(true)
    expect(readOnly.record().state.plan.agentPlan).toBeUndefined()
    const fallback = fixture(false)
    const legacy = await fallback.invoke('plan_course', {
      changes: null,
      proposal,
    })
    expect(legacy.itinerary.planningSource).toBe('RULES')
    expect(fallback.record().state.plan.agentPlan).toBeUndefined()
  })
})
