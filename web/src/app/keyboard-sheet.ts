import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

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
 * viewport: its bottom sits on the keyboard and it fills the whole visible
 * area, like a full-screen chat — the little room left above a keyboard is
 * too small for a sheet with a rounded top and a drag handle.
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

/**
 * iOS floats its keyboard controls (hide-keyboard button, AutoFill strip)
 * *over the page*, just above the keyboard. Keep that strip free so they
 * never cover the composer's send button.
 */
const IOS_KEYBOARD_CONTROLS = 52

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

/** Below this, a smaller visual viewport is browser chrome, not a keyboard. */
const KEYBOARD_MIN = 120

/** Pure: where the sheet goes for a given viewport, or null when no keyboard is open. */
export const sheetFrame = (v: Viewport): CSSProperties | null => {
  const hidden = v.layoutHeight - v.height
  if (hidden < KEYBOARD_MIN) return null
  const height = Math.max(0, v.height)
  return {
    // The layout viewport's bottom is under the keyboard; sit on top of it.
    bottom: Math.max(0, v.layoutHeight - v.offsetTop - v.height),
    height,
    maxHeight: height,
  }
}

/** Props for `<Drawer>`, plus the style and keyboard state for `<DrawerContent>`. */
export const useKeyboardSheet = (open: boolean) => {
  const [frame, setFrame] = useState<CSSProperties | null>(null)

  useEffect(() => {
    const vv = typeof window === 'undefined' ? null : window.visualViewport
    if (!open || !vv) return
    const update = () =>
      setFrame(
        sheetFrame({
          layoutHeight: document.documentElement.clientHeight,
          height: vv.height,
          offsetTop: vv.offsetTop,
        }),
      )
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      setFrame(null)
    }
  }, [open])

  return {
    drawer: { repositionInputs: false } as const,
    style: frame ?? undefined,
    keyboardOpen: frame !== null,
    /** Bottom padding to leave inside the sheet while the keyboard is open. */
    bottomInset: frame !== null && isIOS() ? IOS_KEYBOARD_CONTROLS : 0,
    /** Full screen while typing: square corners, no top border, no drag handle. */
    className:
      frame === null
        ? ''
        : 'data-[vaul-drawer-direction=bottom]:rounded-none data-[vaul-drawer-direction=bottom]:border-t-0 [&>div:first-child]:hidden',
  }
}
