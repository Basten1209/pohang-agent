import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleHelp,
  Flag,
  MapPin,
  Navigation,
  SlidersHorizontal,
  Sun,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '#/components/ui/button'
import { Toaster } from '#/components/ui/sonner'
import { canTravel } from '#/core/planner'
import type { Screen, TripConfig } from '#/core/schema'
import { clock } from '#/core/time'
import { accept, navigate } from '#/core/trip'
import { cn } from '#/lib/utils'
import { AppProvider, useApp } from './context'
import {
  CourseScreen,
  DayScreen,
  FinishScreen,
  NextScreen,
  PlanScreen,
} from './screens'
import { Sheets } from './sheets'
import { useTrip } from './use-trip'

const steps: { id: Screen; label: string; icon: LucideIcon }[] = [
  { id: 'plan', label: '내 하루 만들기', icon: CalendarDays },
  { id: 'day', label: '내 하루', icon: Sun },
  { id: 'finish', label: '완주 후 확인', icon: Flag },
  { id: 'course', label: '구룡포 코스', icon: MapPin },
  { id: 'next', label: '다음 행동', icon: Navigation },
]

/** Screen components by id — the shell never switches on screen names itself. */
const screens: Record<Screen, () => React.ReactNode> = {
  plan: PlanScreen,
  day: DayScreen,
  finish: FinishScreen,
  course: CourseScreen,
  next: NextScreen,
}

const Header = () => {
  const { state, run, open } = useApp()
  const current = steps.findIndex((s) => s.id === state.screen)
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 pt-safe backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <button
          type="button"
          className="flex items-center gap-2"
          onClick={() => run(navigate(state, state.created ? 'day' : 'plan'))}
        >
          <img src="/favicon.svg" alt="" className="size-8" />
          <span className="text-base font-extrabold tracking-tight text-primary">
            RUN2<span className="text-harbor">구룡포</span>
          </span>
        </button>
        <span className="ml-auto hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wider text-muted-foreground sm:flex">
          <span className="size-1.5 rounded-full bg-harbor" /> INTERACTIVE DEMO
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto sm:ml-0"
          aria-label="데모 컨트롤"
          onClick={() => open('demo')}
        >
          <SlidersHorizontal />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="데이터와 연결 상태"
          onClick={() => open('evidence')}
        >
          <CircleHelp />
        </Button>
      </div>
      <nav
        aria-label="여정 단계"
        className="mx-auto max-w-6xl overflow-x-auto px-4 pb-2 [scrollbar-width:none]"
      >
        <ol className="flex w-max gap-1.5">
          {steps.map((step, i) => (
            <li key={step.id}>
              <button
                type="button"
                aria-current={i === current ? 'step' : undefined}
                onClick={() => run(navigate(state, step.id))}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                  i === current
                    ? 'bg-primary text-primary-foreground'
                    : i < current
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-secondary text-muted-foreground',
                )}
              >
                {i < current ? (
                  <Check className="size-3" />
                ) : (
                  <step.icon className="size-3" />
                )}
                {step.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </header>
  )
}

/** Sticky action bar on phones for the course screen. */
const CourseBar = () => {
  const { state, itinerary, run } = useApp()
  if (
    state.screen !== 'course' ||
    !canTravel(itinerary) ||
    itinerary.planningArrival === null
  )
    return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-safe backdrop-blur-md lg:hidden">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div className="flex-1">
          <p className="text-[11px] text-muted-foreground">
            포항역 도착 · 시연
          </p>
          <p className="text-lg font-extrabold text-primary">
            {clock(itinerary.planningArrival)}
            <span className="text-xs font-medium text-muted-foreground">
              {' '}
              / {state.plan.trainTime} 열차
            </span>
          </p>
        </div>
        <Button
          className="h-12 px-5 text-base"
          onClick={() => run(accept(state, itinerary))}
        >
          이 코스로 갈게요 <ArrowRight />
        </Button>
      </div>
    </div>
  )
}

const Shell = () => {
  const { state, storageOk } = useApp()
  const Current = screens[state.screen]
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [state.screen])
  return (
    <div className="min-h-dvh">
      <Header />
      <main
        className={cn(
          'mx-auto max-w-6xl px-4 py-5',
          state.screen === 'course' && 'pb-28 lg:pb-5',
        )}
      >
        <Current />
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
          <span className="font-bold text-primary">RUN2구룡포</span>
          <span>완주 다음의 여행, 내 페이스대로.</span>
        </footer>
      </main>
      <CourseBar />
      <Sheets />
      {!storageOk && (
        <p
          role="alert"
          className="fixed inset-x-4 top-20 z-40 rounded-xl bg-destructive p-3 text-xs text-white"
        >
          브라우저 저장을 사용할 수 없어 새로고침하면 일정이 사라질 수 있어요.
        </p>
      )}
      <Toaster position="top-center" />
    </div>
  )
}

export const App = ({
  config,
  storage,
}: {
  config: TripConfig
  storage: string
}) => {
  const store = useTrip(config)
  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD)
      navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  }, [])
  return (
    <AppProvider config={config} storage={storage} store={store}>
      <Shell />
    </AppProvider>
  )
}
