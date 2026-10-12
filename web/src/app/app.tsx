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
import { clock } from '#/core/time'
import { accept, navigate } from '#/core/trip'
import type { MessageKey } from '#/i18n'
import { useI18n } from '#/i18n/react'
import { AppProvider, useApp } from './context'
import {
  CourseScreen,
  DayScreen,
  FinishScreen,
  NextScreen,
  PlanScreen,
} from './screens'
import { Sheets } from './sheets'
import { useNames } from './cards'
import { useTrip } from './use-trip'

const steps: { id: Screen; label: MessageKey }[] = [
  { id: 'plan', label: 'classic.step.plan' },
  { id: 'day', label: 'classic.step.day' },
  { id: 'finish', label: 'classic.step.finish' },
  { id: 'course', label: 'classic.step.course' },
  { id: 'next', label: 'classic.step.next' },
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
  const { t } = useI18n()
  return (
    <header className="sticky top-0 z-30 border-b bg-background pt-safe">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
        <span className="font-semibold">RUN2구룡포</span>
        <div className="ml-auto flex gap-1">
          <Button asChild size="sm" variant="ghost">
            <Link to="/" search={{ tab: 'home' }}>
              <MessageCircle /> {t('classic.chat')}
            </Link>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={t('classic.demo')}
            onClick={() => open('demo')}
          >
            <SlidersHorizontal />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={t('classic.evidence')}
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
                {t(s.label)}
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
  const { state, itinerary, run } = useApp()
  const { t } = useI18n()
  const names = useNames()
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
            {t('classic.bar.arrive', { hub: names.hub(state.plan) })}
          </span>
          <span className="font-semibold tabular-nums">
            {clock(itinerary.planningArrival)} · {names.depart(state.plan)}
          </span>
        </div>
        <Button onClick={() => run(accept(state, itinerary))}>
          {t('classic.go')} <ArrowRight />
        </Button>
      </div>
    </div>
  )
}

const Shell = () => {
  const { state, online } = useApp()
  const { t } = useI18n()
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
          {t('classic.offline')}
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
