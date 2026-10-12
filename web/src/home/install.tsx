import { Download, Share, Smartphone, Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Gull } from '#/brand/brand'
import { Rich, useI18n } from '#/i18n/react'

interface InstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** iPhone Chrome uses the system share sheet, not beforeinstallprompt. */
export function InstallApp({
  compact = false,
  open: openProp,
  onOpenChange,
}: {
  compact?: boolean
  /** Opened from elsewhere (the menu): no button of its own. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [openState, setOpenState] = useState(false)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : openState
  const setOpen = (next: boolean) =>
    controlled ? onOpenChange?.(next) : setOpenState(next)
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [installed, setInstalled] = useState(false)
  const [standalone, setStandalone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [platform, setPlatform] = useState<'iphone' | 'chrome'>('iphone')
  const [error, setError] = useState('')
  const { t } = useI18n()
  useEffect(() => {
    const display = window.matchMedia('(display-mode: standalone)')
    const sync = () => {
      const runningAsApp =
        display.matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
      setStandalone(runningAsApp)
      if (runningAsApp) setInstalled(true)
    }
    const offer = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPrompt)
    }
    const accepted = () => {
      setInstalled(true)
      setPrompt(null)
    }
    sync()
    window.addEventListener('beforeinstallprompt', offer)
    window.addEventListener('appinstalled', accepted)
    display.addEventListener('change', sync)
    return () => {
      window.removeEventListener('beforeinstallprompt', offer)
      window.removeEventListener('appinstalled', accepted)
      display.removeEventListener('change', sync)
    }
  }, [])
  const install = async () => {
    if (!prompt) return
    setBusy(true)
    setError('')
    try {
      await prompt.prompt()
      const choice = await prompt.userChoice
      if (choice.outcome === 'accepted') setInstalled(true)
      setPrompt(null)
    } catch {
      setError(t('install.failed'))
      setPrompt(null)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      {!controlled && (
        <Button
          type="button"
          variant="outline"
          size={compact ? 'sm' : 'default'}
          onClick={() => setOpen(true)}
        >
          {installed ? <Check /> : <Download />}
          {standalone
            ? t('install.running')
            : installed
              ? t('install.installed')
              : t('install.button')}
        </Button>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-lg rounded-t-3xl pb-safe data-[side=bottom]:max-h-[90dvh] overflow-y-auto"
        >
          <SheetHeader>
            <Gull className="mb-2 size-16 rounded-2xl" />
            <SheetTitle className="text-2xl">{t('install.title')}</SheetTitle>
            <SheetDescription>{t('install.description')}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-5 px-4 pb-4 text-sm">
            {installed ? (
              <p
                role="status"
                className="rounded-xl bg-secondary p-4 font-medium"
              >
                {standalone
                  ? t('install.runningNote')
                  : t('install.installedNote')}
              </p>
            ) : (
              <>
                {prompt && (
                  <Button onClick={() => void install()} disabled={busy}>
                    {busy ? t('install.opening') : t('install.now')}
                  </Button>
                )}
                <div
                  className="flex gap-2"
                  role="group"
                  aria-label={t('install.devices')}
                >
                  <Button
                    type="button"
                    variant={platform === 'iphone' ? 'default' : 'outline'}
                    onClick={() => setPlatform('iphone')}
                  >
                    iPhone · Chrome
                  </Button>
                  <Button
                    type="button"
                    variant={platform === 'chrome' ? 'default' : 'outline'}
                    onClick={() => setPlatform('chrome')}
                  >
                    Android · PC
                  </Button>
                </div>
                {platform === 'iphone' ? (
                  <ol className="list-decimal space-y-3 pl-5 leading-relaxed">
                    <li>
                      <Rich text={t('install.ios1')} />
                    </li>
                    <li>
                      <Rich
                        text={t('install.ios2')}
                        icon={
                          <Share
                            className="inline size-4"
                            aria-label={t('install.share')}
                          />
                        }
                      />
                    </li>
                    <li>
                      <Rich text={t('install.ios3')} />
                    </li>
                    <li>{t('install.ios4')}</li>
                  </ol>
                ) : (
                  <ol className="list-decimal space-y-3 pl-5 leading-relaxed">
                    <li>
                      <Rich text={t('install.android1')} />
                    </li>
                    <li>{t('install.android2')}</li>
                  </ol>
                )}
              </>
            )}
            <p className="flex gap-2 rounded-xl bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
              <Smartphone className="size-4 shrink-0" />
              {t('install.note')}
            </p>
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
