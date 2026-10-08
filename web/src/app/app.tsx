import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Info,
  MessageCircle,
  SlidersHorizontal,
} from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { canTravel } from '#/core/planner'
import type { Screen, TripConfig } from '#/core/schema'
import { screenSchema } from '#/core/schema'
import { departLabel, hubOf } from '#/core/route'
import { clock } from '#/core/time'
import { accept, navigate } from '#/core/trip'
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

const steps: { id: Screen; label: string }[] = [
  { id: 'plan', label: '하루 만들기' },
  { id: 'day', label: '내 하루' },
  { id: 'finish', label: '완주 후' },
  { id: 'course', label: '코스' },
  { id: 'next', label: '다음 행동' },
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
  return (
    <header className="sticky top-0 z-30 border-b bg-background pt-safe">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
        <span className="font-semibold">RUN2포항</span>
        <div className="ml-auto flex gap-1">
          <Button asChild size="sm" variant="ghost">
            <Link to="/">
              <MessageCircle /> 채팅
            </Link>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="데모 시나리오"
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
            <Info />
          </Button>
        </div>
      </div>
      <div className="mx-auto max-w-5xl overflow-x-auto px-4 pb-3">
        <Tabs
          value={state.screen}
          onValueChange={(v) => run(navigate(state, screenSchema.parse(v)))}
        >
          <TabsList>
            {steps.map((s) => (
              <TabsTrigger key={s.id} value={s.id}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </header>
  )
}

/** Sticky action bar on phones for the course screen. */
const CourseBar = () => {
  const { state, itinerary, run, config } = useApp()
  if (
    state.screen !== 'course' ||
    !canTravel(itinerary) ||
    itinerary.planningArrival === null
  )
    return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background px-4 pt-3 pb-safe lg:hidden">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">
            {hubOf(config, state.plan).name} 도착 (시연)
          </span>
          <span className="font-semibold tabular-nums">
            {clock(itinerary.planningArrival)} ·{' '}
            {departLabel(config, state.plan)}
          </span>
        </div>
        <Button onClick={() => run(accept(state, itinerary))}>
          이 코스로 갈게요 <ArrowRight />
        </Button>
      </div>
    </div>
  )
}

const Shell = () => {
  const { state, online } = useApp()
  const Current = screens[state.screen]
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [state.screen])
  return (
    <div className="min-h-dvh">
      <Header />
      <main
        className={
          state.screen === 'course'
            ? 'mx-auto max-w-5xl px-4 py-6 pb-28 lg:pb-6'
            : 'mx-auto max-w-5xl px-4 py-6'
        }
      >
        <Current />
      </main>
      <CourseBar />
      <Sheets />
      {!online && (
        <p
          role="alert"
          className="fixed inset-x-4 top-28 z-40 rounded-lg border bg-background p-3 text-sm"
        >
          서버에 연결되지 않아 마지막으로 본 일정만 보여요.
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
