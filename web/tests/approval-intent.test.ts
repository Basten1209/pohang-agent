import { expect, it } from 'vitest'
import { approvalAnsweredBy } from '#/chat/approval-intent'

const waiting = [
  { role: 'user', parts: [{ type: 'text' }] },
  {
    role: 'assistant',
    parts: [
      { type: 'tool-plan_course', state: 'output-available' },
      {
        type: 'tool-apply_plan_change',
        state: 'approval-requested',
        approval: { id: 'ap_1' },
      },
    ],
  },
]

it('변경 승인을 기다릴 때 "네·이걸로 갈게요"는 승인으로', () => {
  for (const yes of [
    '네',
    '좋아요',
    '적용해줘',
    '이 코스로 갈게요',
    '그걸로 해',
    'OK',
  ])
    expect(approvalAnsweredBy(waiting, yes), yes).toBe('ap_1')
})

it('다른 요청이나 기다리는 승인이 없으면 그대로 메시지로', () => {
  expect(approvalAnsweredBy(waiting, '왜 이 코스야?')).toBeNull()
  expect(approvalAnsweredBy(waiting, '카페는 빼 줘')).toBeNull()
  expect(
    approvalAnsweredBy(waiting, '네가 근처 맛집도 같이 추천해 줄 수 있어?'),
  ).toBeNull()
  const answered = [
    waiting[0]!,
    {
      role: 'assistant',
      parts: [{ type: 'tool-apply_plan_change', state: 'output-available' }],
    },
  ]
  expect(approvalAnsweredBy(answered, '네')).toBeNull()
  expect(approvalAnsweredBy([...waiting, waiting[0]!], '네')).toBeNull()
})
