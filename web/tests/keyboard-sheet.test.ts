import { describe, expect, it } from 'vitest'
import { pulledUp, sheetFrame } from '#/app/keyboard-sheet'

describe('키보드가 열렸을 때 바텀시트 위치', () => {
  it('키보드가 없으면 원래 크기(88dvh) 그대로', () => {
    expect(
      sheetFrame({ layoutHeight: 844, height: 844, offsetTop: 0 }),
    ).toBeNull()
    // Collapsing browser toolbars are not a keyboard.
    expect(
      sheetFrame({ layoutHeight: 844, height: 780, offsetTop: 0 }),
    ).toBeNull()
  })

  it('보이는 영역을 채우고, 바탕은 화면 아래까지 — 내용은 키보드 위', () => {
    // iPhone: 336px keyboard (with its bars), the page not scrolled.
    expect(
      sheetFrame({ layoutHeight: 844, height: 508, offsetTop: 0 }),
    ).toEqual({
      bottom: 0,
      height: 844,
      maxHeight: 844,
      paddingBottom: 336,
    })
  })

  it('iOS가 화면을 위로 밀어도(offsetTop) 이중으로 올라가지 않음', () => {
    // iOS scrolled the visual viewport down by 336 to reveal the input:
    // the visible area is the bottom of the layout viewport.
    expect(
      sheetFrame({ layoutHeight: 844, height: 508, offsetTop: 336 }),
    ).toEqual({
      bottom: 0,
      height: 508,
      maxHeight: 508,
      paddingBottom: 0,
    })
  })
})

describe('위로 끌어 올려 전체 화면', () => {
  it('손잡이·머리말을 40px 이상 올리면 전체 화면', () => {
    expect(pulledUp(500, 470)).toBe(false)
    expect(pulledUp(500, 460)).toBe(true)
    // Pulling down never expands.
    expect(pulledUp(500, 600)).toBe(false)
  })
})
