import { expect, it } from 'vitest'
import type { UIMessage } from 'ai'
import { outgoing } from '#/chat/outgoing'
import { mergeIncoming } from '#/server/agent/ingest'

// A plan-change turn: two planning contexts (~28k chars each), reasoning
// steps, an itinerary preview and the approval the runner just answered.
const big = { places: 'x'.repeat(28_000) }
const stored: UIMessage = {
  id: 'a1',
  role: 'assistant',
  parts: [
    ...Array.from({ length: 13 }, (_, i) => [
      { type: 'step-start' },
      { type: 'reasoning', text: 'r'.repeat(3_000) },
      {
        type: 'tool-get_planning_context',
        toolCallId: `ctx${i}`,
        state: 'output-available',
        input: {},
        output: big,
      },
    ]).flat(),
    { type: 'text', text: '이렇게 바꿔 볼까요?' },
    {
      type: 'tool-ask_quick_reply',
      toolCallId: 'q1',
      state: 'input-available',
      input: {},
    },
    {
      type: 'tool-apply_plan_change',
      toolCallId: 'ap',
      state: 'approval-requested',
      input: {},
      approval: { id: 'ap_1' },
    },
  ] as UIMessage['parts'],
}
const answered = {
  ...stored,
  parts: stored.parts.map((p) =>
    'toolCallId' in p && p.toolCallId === 'ap'
      ? {
          ...p,
          state: 'approval-responded',
          approval: { id: 'ap_1', approved: true },
        }
      : 'toolCallId' in p && p.toolCallId === 'q1'
        ? { ...p, state: 'output-available', output: { value: 'yes' } }
        : p,
  ),
} as UIMessage

it('sends only the answers of an assistant message, small enough for the request limit', () => {
  // The whole message is what the request used to carry: over 128k and 40 parts.
  expect(JSON.stringify(answered).length).toBeGreaterThan(128_000)
  expect(answered.parts.length).toBeGreaterThan(40)
  const slim = outgoing(answered)
  expect(JSON.stringify(slim).length).toBeLessThan(1_000)
  expect(slim.parts.map((p) => p.type)).toEqual([
    'tool-ask_quick_reply',
    'tool-apply_plan_change',
  ])
})

it('the server applies the slim answers exactly like the full message', () => {
  const merged = (incoming: UIMessage) =>
    mergeIncoming([stored], incoming).at(-1)!.parts
  expect(merged(outgoing(answered))).toEqual(merged(answered))
  const approval = merged(outgoing(answered)).find(
    (p) => 'toolCallId' in p && p.toolCallId === 'ap',
  )
  expect(approval).toMatchObject({
    state: 'approval-responded',
    approval: { id: 'ap_1', approved: true },
  })
})

it('sends user messages unchanged', () => {
  const user = {
    id: 'u1',
    role: 'user' as const,
    parts: [{ type: 'text' as const, text: '네' }],
    metadata: { choice: { slot: 'course', value: 'guryongpo' } },
  }
  expect(outgoing(user)).toBe(user)
})
