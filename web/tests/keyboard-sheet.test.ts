import { describe, expect, it } from 'vitest'
import { sheetFrame } from '#/app/keyboard-sheet'

describe('키보드가 열렸을 때 바텀시트 위치', () => {
  it('키보드가 없으면 원래 크기(88dvh) 그대로', () => {
    expect(
      sheetFrame({ innerHeight: 844, height: 844, offsetTop: 0 }),
    ).toBeNull()
    // Collapsing browser toolbars are not a keyboard.
    expect(
      sheetFrame({ innerHeight: 844, height: 780, offsetTop: 0 }),
    ).toBeNull()
  })

  it('키보드 바로 위에 붙고 보이는 영역을 채움', () => {
    // iPhone: 336px keyboard, the page not scrolled.
    expect(sheetFrame({ innerHeight: 844, height: 508, offsetTop: 0 })).toEqual(
      {
        bottom: 336,
        height: 500,
        maxHeight: 500,
      },
    )
  })

  it('iOS가 화면을 위로 밀어도(offsetTop) 이중으로 올라가지 않음', () => {
    // iOS scrolled the visual viewport down by 336 to reveal the input:
    // the visible area is the bottom of the layout viewport.
    expect(
      sheetFrame({ innerHeight: 844, height: 508, offsetTop: 336 }),
    ).toEqual({
      bottom: 0,
      height: 500,
      maxHeight: 500,
    })
  })
})
