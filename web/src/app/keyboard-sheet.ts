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
 * viewport: its bottom sits on the keyboard and it fills the visible area.
 */

export type Viewport = {
  innerHeight: number
  height: number
  offsetTop: number
}

/** Below this, a smaller visual viewport is browser chrome, not a keyboard. */
const KEYBOARD_MIN = 120
/** Room left above the sheet so its rounded top stays visible. */
const TOP_GAP = 8

/** Pure: where the sheet goes for a given viewport, or null when no keyboard is open. */
export const sheetFrame = (v: Viewport): CSSProperties | null => {
  const hidden = v.innerHeight - v.height
  if (hidden < KEYBOARD_MIN) return null
  const height = Math.max(0, v.height - TOP_GAP)
  return {
    // The layout viewport's bottom is under the keyboard; sit on top of it.
    bottom: Math.max(0, v.innerHeight - v.offsetTop - v.height),
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
          innerHeight: window.innerHeight,
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
  }
}
