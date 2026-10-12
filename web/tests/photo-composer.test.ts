// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PhotoComposer } from '#/home/finish'
import { seedConfig } from '#/core/defaults'

let host: HTMLDivElement
let root: Root
const place = seedConfig.places.find((p) => p.id === 'street')!
const post = {
  id: 'post-1',
  placeId: 'street',
  image: '/api/community/post-1/image',
  photoKind: 'UPLOAD',
  caption: '골목에서 한 장',
}
let published: boolean
let failure: boolean
let requests: { method: string; body?: unknown }[]
const shared = vi.fn()
const resume = vi.fn()
const render = async () =>
  act(async () => {
    root.render(
      createElement(PhotoComposer, {
        tripId: '00000000-0000-4000-8000-000000000001',
        course: 'guryongpo',
        place,
        finish: async () => undefined,
        onShared: shared,
        onContinue: resume,
      }),
    )
  })
const button = (name: string) =>
  [...host.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === name,
  )!
const click = async (name: string) => act(async () => button(name).click())

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  requests = []
  published = false
  failure = false
  shared.mockClear()
  resume.mockClear()
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 100, height: 100, close: vi.fn() })),
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  } as never)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
    'data:image/jpeg;base64,/9j/2Q==',
  )
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (_url === '/api/community/caption')
        return new Response(
          JSON.stringify({ caption: '골목에서 쉬어가는 오늘의 한 장.' }),
        )
      if (_url.startsWith('/images/'))
        return {
          ok: true,
          blob: async () => new Blob(['image'], { type: 'image/webp' }),
        } as Response
      const method = init?.method ?? 'GET'
      requests.push({
        method,
        ...(init?.body && { body: JSON.parse(String(init.body)) }),
      })
      if (method === 'POST') {
        if (failure) return new Response('{}', { status: 503 })
        published = true
      }
      return new Response(JSON.stringify({ post: published ? post : null }))
    }),
  )
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('명시적으로 사진을 공유하는 폼', () => {
  it('늦게 도착한 AI 초안이 사용자가 수정한 글을 덮어쓰지 않는다', async () => {
    const original = globalThis.fetch
    let resolve!: (response: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) =>
        url === '/api/community/caption'
          ? new Promise<Response>((done) => {
              resolve = done
            })
          : original(url, init),
      ),
    )
    await render()
    await click('샘플 사진 사용')
    const textarea = host.querySelector('textarea')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )!.set!.call(textarea, '내가 직접 쓴 오늘의 기록')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () =>
      resolve(new Response(JSON.stringify({ caption: '늦게 도착한 AI 글' }))),
    )
    expect(textarea.value).toBe('내가 직접 쓴 오늘의 기록')
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(0)
  })

  it('AI 초안 실패 후 사진과 글을 보존하고 재시도할 수 있다', async () => {
    const original = globalThis.fetch
    let failDraft = true
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) =>
        url === '/api/community/caption' && failDraft
          ? Promise.resolve(new Response('{}', { status: 503 }))
          : original(url, init),
      ),
    )
    await render()
    await click('샘플 사진 사용')
    expect(host.textContent).toContain('AI 글을 만들지 못했어요')
    expect(host.querySelector('img[alt*=미리보기]')?.getAttribute('src')).toBe(
      '/images/demo/sample-street.webp',
    )
    expect(button('사진 공유하기').disabled).toBe(false)
    failDraft = false
    await click('AI로 글 다시 쓰기')
    expect(host.querySelector('textarea')?.value).toBe(
      '골목에서 쉬어가는 오늘의 한 장.',
    )
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(0)
  })

  it('사진 선택과 취소는 게시하지 않으며 공개 안내 뒤 공유 버튼만 POST한다', async () => {
    await render()
    expect(button('사진 공유하기').disabled).toBe(true)
    await click('샘플 사진 사용')
    expect(host.textContent).toContain('직접 촬영 아님')
    expect(host.textContent).toContain('커뮤니티에 공개돼요')
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(0)
    await click('나중에 할게요')
    expect(resume).toHaveBeenCalledOnce()
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(0)
    await click('사진 공유하기')
    expect(requests.filter((r) => r.method === 'POST')).toEqual([
      expect.objectContaining({
        body: expect.objectContaining({
          placeId: 'street',
          photo: { kind: 'DEMO' },
        }),
      }),
    ])
    expect(shared).toHaveBeenCalledOnce()
    expect(host.textContent).toContain(
      '일본인 가옥거리 사진이 커뮤니티에 공유됐어요',
    )
    expect(host.querySelector('input[type=file]')).toBeNull()
  })

  it('업로드는 로컬 JPEG 변환 뒤 전송하며 실패하면 사진을 보존해 다시 시도한다', async () => {
    const close = vi.fn()
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 2000, height: 1000, close })),
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,/9j/2Q==',
    )
    await render()
    const input = host.querySelector('input[type=file]')!
    Object.defineProperty(input, 'files', {
      value: [new File(['photo'], 'photo.png', { type: 'image/png' })],
    })
    await act(async () =>
      input.dispatchEvent(new Event('change', { bubbles: true })),
    )
    expect(close).toHaveBeenCalledOnce()
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(0)
    failure = true
    await click('사진 공유하기')
    expect(host.querySelector('[role=alert]')?.textContent).toContain(
      '다시 시도',
    )
    expect(host.querySelector('img[alt*=미리보기]')?.getAttribute('src')).toBe(
      'data:image/jpeg;base64,/9j/2Q==',
    )
    failure = false
    await click('사진 공유하기')
    expect(requests.filter((r) => r.method === 'POST')[1].body).toMatchObject({
      photo: { kind: 'UPLOAD', data: 'data:image/jpeg;base64,/9j/2Q==' },
    })
    expect(shared).toHaveBeenCalledOnce()
  })

  it('재실행하면 이미 공유한 사진을 읽어 새 게시 버튼 없이 보여준다', async () => {
    published = true
    await render()
    expect(host.textContent).toContain('골목에서 한 장')
    expect(host.querySelector('input[type=file]')).toBeNull()
    expect(requests).toEqual([{ method: 'GET' }])
  })
})
