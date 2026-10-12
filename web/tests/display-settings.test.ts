// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import {
  applyFontSize,
  FONT_SIZE_KEY,
  fontSizeBootstrap,
  readFontSize,
  validFontSize,
} from '#/app/display-settings'
import { ExternalLinkDialog, chatUrlTransform } from '#/chat/external-link'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  delete document.documentElement.dataset.fontSize
})
it('읽기 크기를 저장하고 새 방문의 첫 화면에서도 복원한다', () => {
  applyFontSize('largest')
  expect(readFontSize()).toBe('largest')
  delete document.documentElement.dataset.fontSize
  window.eval(fontSizeBootstrap)
  expect(document.documentElement.dataset.fontSize).toBe('largest')
  localStorage.setItem(FONT_SIZE_KEY, 'bad-value')
  window.eval(fontSizeBootstrap)
  expect(document.documentElement.dataset.fontSize).toBe('normal')
  expect(validFontSize(null)).toBe('normal')
})
it('저장이 차단되어도 현재 화면의 글자 크기는 바꾼다', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  applyFontSize('large')
  expect(document.documentElement.dataset.fontSize).toBe('large')
})
it('옛 대화의 깨진 링크는 갱신하고 위험한 프로토콜은 차단한다', () => {
  const node = {
    type: 'element' as const,
    tagName: 'a',
    properties: {},
    children: [],
  }
  expect(
    chatUrlTransform('https://oceang.kr/ko/cafe/food/?i=237', 'href', node),
  ).toBe('https://place.map.kakao.com/9570020')
  expect(chatUrlTransform('javascript:alert(1)', 'href', node)).toBe('')
  expect(
    chatUrlTransform(
      'https://oceang.kr.evil.test/ko/cafe/food/?i=237',
      'href',
      node,
    ),
  ).toContain('evil.test')
})
it('링크 복사는 창을 열지 않고, 열기와 닫기는 각각 정확한 콜백을 호출한다', async () => {
  const clipboard = { writeText: vi.fn(async () => undefined) }
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: clipboard,
  })
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host),
    close = vi.fn(),
    confirm = vi.fn()
  try {
    await act(async () =>
      root.render(
        createElement(ExternalLinkDialog, {
          url: 'https://pohang.go.kr',
          isOpen: true,
          onClose: close,
          onConfirm: confirm,
        }),
      ),
    )
    const click = async (text: string) =>
      act(async () =>
        [...document.querySelectorAll('button')]
          .find((b) => b.textContent === text)!
          .click(),
      )
    await click('링크 복사')
    expect(clipboard.writeText).toHaveBeenCalledWith('https://pohang.go.kr')
    expect(confirm).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
    await click('링크 열기')
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
    await click('닫기')
    expect(close).toHaveBeenCalledTimes(2)
    expect(confirm).toHaveBeenCalledTimes(1)
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
