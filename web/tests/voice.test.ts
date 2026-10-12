import { describe, expect, it } from 'vitest'
import { seedConfig } from '#/core/defaults'
import { liveSessionConfig, spokenReply, utterance } from '#/core/voice'

const voice = seedConfig.agent.voice!

describe('음성 모드 (OpenAI Live 위임)', () => {
  it('Live 세션은 서버가 정함: 클라이언트 위임, 목소리, 허용 이벤트', () => {
    const c = liveSessionConfig(voice)
    expect(c.providerOptions.openai.delegation).toEqual({ type: 'client' })
    expect(c.providerOptions.openai.voice).toEqual({ id: voice.voice })
    expect(c.providerOptions.openai.store).toBe(false)
    const { allowedClientEvents, allowedServerEvents } =
      c.providerOptions.openai.client.dataChannel
    expect(allowedClientEvents).toContain('session.commentary.append')
    expect(allowedServerEvents.map((e) => e.type)).toContain(
      'session.delegation.created',
    )
    // Live decides nothing: its instructions send every request to the agent.
    expect(c.instructions).toContain('위임')
  })

  it('받아 적은 조각을 한 문장으로', () =>
    expect(utterance(['구룡포 ', '가는  버스', ' 뭐 타요?'])).toBe(
      '구룡포 가는 버스 뭐 타요?',
    ))

  it('답변은 링크·마크다운 없이 소리 내 읽을 문장으로', () => {
    const said = spokenReply(
      [
        { type: 'step-start' },
        {
          type: 'text',
          text: '**버스 번호**는 [카카오맵 길찾기](https://map.kakao.com/x)에서 확인해 주세요.',
        },
      ],
      400,
    )
    expect(said).toBe('버스 번호는 카카오맵 길찾기에서 확인해 주세요.')
  })

  it('승인이 필요한 변경은 화면에서 누르도록 말함', () =>
    expect(
      spokenReply(
        [
          { type: 'text', text: '16시 열차로 바꾸면 카페가 빠져요.' },
          { type: 'tool-apply_plan_change', state: 'approval-requested' },
        ],
        400,
      ),
    ).toContain('화면에서 적용을 눌러 주세요'))

  it('긴 답은 Live 한도 안에서 문장 끝으로 자르고 화면을 안내', () => {
    const long = '구룡포 코스는 점심과 골목 구경으로 짰어요. '.repeat(30)
    const said = spokenReply([{ type: 'text', text: long }], 120)
    expect(said.length).toBeLessThanOrEqual(150)
    expect(said).toContain('나머지는 화면에서 볼 수 있어요')
  })

  it('말할 내용이 없으면 화면으로 안내', () =>
    expect(spokenReply([{ type: 'tool-plan_course' }], 400)).toContain(
      '화면에서',
    ))
})
