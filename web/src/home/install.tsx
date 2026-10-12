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

interface InstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** iPhone Chrome uses the system share sheet, not beforeinstallprompt. */
export function InstallApp({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [installed, setInstalled] = useState(false)
  const [standalone, setStandalone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [platform, setPlatform] = useState<'iphone' | 'chrome'>('iphone')
  const [error, setError] = useState('')
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
      setError(
        '설치 창을 열지 못했어요. 아래 브라우저 메뉴로 추가할 수 있어요.',
      )
      setPrompt(null)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={compact ? 'sm' : 'default'}
        onClick={() => setOpen(true)}
      >
        {installed ? <Check /> : <Download />}
        {standalone
          ? '앱으로 실행 중'
          : installed
            ? '설치 완료'
            : '홈 화면에 추가'}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-lg rounded-t-3xl pb-safe data-[side=bottom]:max-h-[90dvh] overflow-y-auto"
        >
          <SheetHeader>
            <Gull className="mb-2 size-16 rounded-2xl" />
            <SheetTitle className="text-2xl">홈 화면에서 만나요</SheetTitle>
            <SheetDescription>
              RUN2구룡포를 앱처럼 바로 열어 보세요.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-5 px-4 pb-4 text-sm">
            {installed ? (
              <p
                role="status"
                className="rounded-xl bg-secondary p-4 font-medium"
              >
                {standalone
                  ? '지금 독립된 앱 화면으로 실행하고 있어요.'
                  : '설치했어요. 앱 아이콘을 눌러 독립된 앱 화면으로 열어 주세요.'}
              </p>
            ) : (
              <>
                {prompt && (
                  <Button onClick={() => void install()} disabled={busy}>
                    {busy ? '설치 창을 여는 중…' : '이 기기에 설치하기'}
                  </Button>
                )}
                <div
                  className="flex gap-2"
                  role="group"
                  aria-label="설치 안내 기기"
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
                      iPhone의 <strong>Chrome</strong>에서 이 페이지를 열어요.
                    </li>
                    <li>
                      주소창의{' '}
                      <Share className="inline size-4" aria-label="공유" />{' '}
                      <strong>공유</strong> → <strong>홈 화면에 추가</strong>를
                      선택해요.
                    </li>
                    <li>
                      갈매기 아이콘과 <strong>RUN2구룡포</strong> 이름을
                      확인하고 <strong>추가</strong>를 눌러요.
                    </li>
                    <li>홈 화면으로 나가 새 아이콘을 눌러 실행해요.</li>
                  </ol>
                ) : (
                  <ol className="list-decimal space-y-3 pl-5 leading-relaxed">
                    <li>
                      Chrome 메뉴 또는 주소창에서 <strong>설치</strong> /{' '}
                      <strong>홈 화면에 추가</strong>를 선택해요.
                    </li>
                    <li>RUN2구룡포를 추가하고 앱 아이콘으로 다시 열어요.</li>
                  </ol>
                )}
              </>
            )}
            <p className="flex gap-2 rounded-xl bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
              <Smartphone className="size-4 shrink-0" />
              설치한 앱에서 처음 한 번 일정을 입력해 주세요. 여행 추천·실시간
              관측·사진 공유에는 인터넷 연결이 필요해요.
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
