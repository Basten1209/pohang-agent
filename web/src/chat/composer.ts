import { useLayoutEffect } from 'react'
import type { KeyboardEvent, RefObject } from 'react'

/**
 * The chat composer: one line to start, one more line per line of text.
 *
 * Browsers with `field-sizing: content` grow the textarea by CSS alone. Older
 * WebKit does not, so measure it there.
 */

/** Tallest the composer grows before it scrolls (matches `max-h-48`). */
const MAX_HEIGHT = 192

const sizesByCss = () =>
  typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content')

export const useAutosize = (
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
) => {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || sizesByCss()) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }, [ref, value])
}

/** A phone keyboard has no Shift+Enter, so there return adds a line; the send button sends. */
export const isTouchKeyboard = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(pointer: coarse)').matches === true

/**
 * On touch keyboards, insert a line break instead of sending. Runs before the
 * composer's own Enter-to-send, which skips a prevented event.
 */
export const newlineOnTouch =
  (setValue: (value: string) => void) =>
  (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    if (!isTouchKeyboard()) return
    e.preventDefault()
    // Insert at the caret in the DOM itself, so the caret lands after the
    // break at once; React then sees the same value and leaves the caret be.
    const el = e.currentTarget
    el.setRangeText('\n', el.selectionStart, el.selectionEnd, 'end')
    setValue(el.value)
  }
