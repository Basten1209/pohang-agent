import { useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { isLocale, localeNames, locales } from '#/i18n'
import { useI18n } from '#/i18n/react'

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
  const { t, locale, setLocale } = useI18n()
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
  const choose = (v: string) => {
    const next = validFontSize(v)
    setSize(next)
    applyFontSize(next)
  }
  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      className="shrink-0"
      aria-label={t('display.button')}
      title={t('display.button')}
    >
      <Settings2 aria-hidden />
    </Button>
  )
  return (
    // No scroll lock: hiding the scrollbar would shift the header.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t('display.language')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(v) => isLocale(v) && setLocale(v)}
        >
          {locales.map((l) => (
            <DropdownMenuRadioItem key={l} value={l}>
              {localeNames[l]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('display.fontSize')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={size} onValueChange={choose}>
          {fontSizes.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {t(`display.${option.value}`)}
              <span className="ml-auto text-xs text-muted-foreground">
                {option.percent}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
