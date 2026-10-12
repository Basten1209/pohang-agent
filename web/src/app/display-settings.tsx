import { useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field'
import { RadioGroup } from '@/components/ui/radio-group'
import { isLocale, localeNames, locales } from '#/i18n'
import { useI18n } from '#/i18n/react'
import { Choice } from './bits'

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
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label={t('display.button')}
          title={t('display.button')}
        >
          <Settings2 aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('display.title')}</DialogTitle>
          <DialogDescription>{t('display.description')}</DialogDescription>
        </DialogHeader>
        <FieldSet>
          <FieldLegend variant="label">{t('display.language')}</FieldLegend>
          <FieldDescription>{t('display.languageNote')}</FieldDescription>
          <RadioGroup
            value={locale}
            onValueChange={(v) => isLocale(v) && setLocale(v)}
            className="grid grid-cols-2"
          >
            {locales.map((l) => (
              <Choice
                key={l}
                id={`locale-${l}`}
                value={l}
                title={localeNames[l]}
              />
            ))}
          </RadioGroup>
        </FieldSet>
        <FieldSet>
          <FieldLegend variant="label">{t('display.fontSize')}</FieldLegend>
          <RadioGroup
            value={size}
            onValueChange={(v) => {
              const next = validFontSize(v)
              setSize(next)
              applyFontSize(next)
            }}
            className="grid grid-cols-3"
          >
            {fontSizes.map((option) => (
              <Choice
                key={option.value}
                id={`font-${option.value}`}
                value={option.value}
                title={t(`display.${option.value}`)}
                description={option.percent}
              />
            ))}
          </RadioGroup>
        </FieldSet>
        <p
          className="rounded-xl bg-secondary p-4 leading-relaxed"
          aria-live="polite"
        >
          {t('display.sample')}
        </p>
        <p className="text-xs text-muted-foreground">{t('display.saved')}</p>
      </DialogContent>
    </Dialog>
  )
}
