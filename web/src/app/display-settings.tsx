import { useEffect, useState } from 'react'
import { Settings2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'

export const FONT_SIZE_KEY = 'run2-font-size'
export const fontSizes = [
  { value: 'normal', label: '기본', percent: '100%' },
  { value: 'large', label: '크게', percent: '112.5%' },
  { value: 'largest', label: '아주 크게', percent: '125%' },
] as const
export type FontSize = (typeof fontSizes)[number]['value']
export const validFontSize = (value: unknown): FontSize =>
  fontSizes.some((s) => s.value === value) ? (value as FontSize) : 'normal'
export const readFontSize = (): FontSize => {
  try {
    return validFontSize(localStorage.getItem(FONT_SIZE_KEY))
  } catch {
    return 'normal'
  }
}
export function applyFontSize(value: FontSize) {
  document.documentElement.dataset.fontSize = value
  try {
    localStorage.setItem(FONT_SIZE_KEY, value)
  } catch {
    /* Applies for this visit. */
  }
}
// Run before first paint; unknown or unavailable storage falls back to the browser default.
export const fontSizeBootstrap = `try{var s=localStorage.getItem('${FONT_SIZE_KEY}');document.documentElement.dataset.fontSize=['normal','large','largest'].includes(s)?s:'normal'}catch(e){}`

export function DisplaySettings() {
  const [size, setSize] = useState<FontSize>('normal')
  useEffect(() => {
    setSize(readFontSize())
    const sync = (event: StorageEvent) => {
      if (event.key === FONT_SIZE_KEY || event.key === null) {
        const next = readFontSize()
        document.documentElement.dataset.fontSize = next
        setSize(next)
      }
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label="화면 설정"
          title="화면 설정"
        >
          <Settings2 aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="max-h-[85dvh] overflow-y-auto"
      >
        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute right-2 top-2"
            aria-label="설정 닫기"
          >
            <X aria-hidden />
          </Button>
        </DialogClose>
        <DialogTitle>화면 설정</DialogTitle>
        <DialogDescription>
          편하게 읽을 수 있도록 글자 크기를 조절해요.
        </DialogDescription>
        <fieldset>
          <legend className="mb-3 font-semibold">글자 크기</legend>
          <div className="grid grid-cols-3 gap-2">
            {fontSizes.map((option) => (
              <label
                key={option.value}
                className="flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:checked]:text-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
              >
                <input
                  type="radio"
                  name="font-size"
                  value={option.value}
                  checked={size === option.value}
                  onChange={() => {
                    setSize(option.value)
                    applyFontSize(option.value)
                  }}
                />
                <span>{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.percent}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <p
          className="rounded-xl bg-secondary p-4 leading-relaxed"
          aria-live="polite"
        >
          포항에서의 하루, 나에게 편한 크기로 읽어요.
        </p>
        <p className="text-xs text-muted-foreground">
          이 기기에 저장되며 다음 방문에도 적용돼요.
        </p>
      </DialogContent>
    </Dialog>
  )
}
