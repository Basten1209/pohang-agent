import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'

/**
 * Bottom sheets and the on-screen keyboard.
 *
 * When the keyboard opens, mobile browsers shrink the *visual* viewport and
 * (on iOS) also scroll it to reveal the focused input. vaul's own
 * `repositionInputs` lifts the sheet by the keyboard height as well, so the
 * two shifts add up and the composer ends up at the top of the screen with
 * blank space below it.
 *
 * Instead, turn vaul's repositioning off and pin the sheet to the visual
 * viewport: it fills the whole visible area, like a full-screen chat — the
 * little room left above a keyboard is too small for a sheet with a rounded
 * top and a drag handle.
 *
 * The sheet itself still reaches the bottom of the screen; only its content
 * stops at the keyboard (bottom padding). iOS counts its floating, see-through
 * bars (Safari's ∧ ∨ ✓ form bar, Chrome's keyboard buttons) as part of the
 * keyboard, so cutting the sheet at the visible edge let the page behind it
 * show through around them.
 */

/**
 * `layoutHeight` is the layout viewport (`documentElement.clientHeight`),
 * which a keyboard does not shrink. Not `window.innerHeight`: on WebKit
 * (Safari and every iOS browser) that follows the visual viewport, so the
 * keyboard would look like it is not there.
 */
export type Viewport = {
  layoutHeight: number
  height: number
  offsetTop: number
}

/** Below this, a smaller visual viewport is browser chrome, not a keyboard. */
const KEYBOARD_MIN = 120

/** Pure: where the sheet goes for a given viewport, or null when no keyboard is open. */
export const sheetFrame = (v: Viewport): CSSProperties | null => {
  const hidden = v.layoutHeight - v.height
  if (hidden < KEYBOARD_MIN) return null
  // From the top of the visible area to the bottom of the screen…
  const height = Math.max(0, v.layoutHeight - v.offsetTop)
  return {
    bottom: 0,
    height,
    maxHeight: height,
    // …with the content kept above the keyboard and its bars.
    paddingBottom: Math.max(0, height - v.height),
  }
}

/** Full screen without a keyboard: the whole dynamic viewport. */
const FULL_SCREEN: CSSProperties = {
  bottom: 0,
  height: '100dvh',
  maxHeight: '100dvh',
}

/** How far the handle or header must be pulled up to go full screen. */
export const PULL_TO_EXPAND = 40

/** Pure: a drag from `startY` to `y` (px, down is positive) asks for full screen. */
export const pulledUp = (startY: number, y: number) =>
  startY - y >= PULL_TO_EXPAND

/** Square corners, no top border, no drag handle; clear of the status bar. */
const FULL_SCREEN_CLASS =
  'pt-safe data-[vaul-drawer-direction=bottom]:rounded-none data-[vaul-drawer-direction=bottom]:border-t-0 [&>div:first-child]:hidden'

/**
 * A bottom sheet that becomes a full-screen page — when the keyboard opens,
 * or when its handle or header is pulled up — and stays full screen (also
 * after the keyboard closes) until the sheet is closed.
 *
 * Returns props for `<Drawer>` and `<DrawerContent>`.
 */
export const useKeyboardSheet = (open: boolean) => {
  const [frame, setFrame] = useState<CSSProperties | null>(null)
  const [pinned, setPinned] = useState(false)
  const pull = useRef<number | null>(null)

  useEffect(() => {
    if (!open) setPinned(false)
  }, [open])

  useEffect(() => {
    const vv = typeof window === 'undefined' ? null : window.visualViewport
    if (!open || !vv) return
    const update = () => {
      const next = sheetFrame({
        layoutHeight: document.documentElement.clientHeight,
        height: vv.height,
        offsetTop: vv.offsetTop,
      })
      setFrame(next)
      if (next) setPinned(true)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      setFrame(null)
    }
  }, [open])

  const fullScreen = pinned || frame !== null

  /** Only the top strip and header pull the sheet up; the conversation scrolls. */
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const target = e.target as Element
    // The strip above the header (the sheet itself or its handle bar) and the header.
    const grip =
      target === e.currentTarget ||
      target === e.currentTarget.firstElementChild ||
      target.closest('[data-slot="drawer-header"]') !== null
    pull.current = !fullScreen && grip ? e.clientY : null
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (pull.current !== null && pulledUp(pull.current, e.clientY)) {
      pull.current = null
      setPinned(true)
    }
  }
  const onPointerUp = () => {
    pull.current = null
  }

  return {
    drawer: { repositionInputs: false } as const,
    content: {
      style: frame ?? (fullScreen ? FULL_SCREEN : undefined),
      className: fullScreen ? FULL_SCREEN_CLASS : '',
      onPointerDown,
      onPointerMove,
      onPointerUp,
    },
    keyboardOpen: frame !== null,
    fullScreen,
  }
}
