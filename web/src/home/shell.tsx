import { useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronDown, Ellipsis } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { localizeDeep } from '#/i18n/phrases'
import { useI18n } from '#/i18n/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Gull, GullPose, AssetCredits } from '#/brand/brand'
import { newTripId, postEvents } from '#/app/trip-client'
import { toast } from 'sonner'
import { advance as advanceTrip, startReturn } from '#/core/trip'
import { photoOpportunity, type CommunityPost } from '#/core/community'
import { agentName } from '#/core/identity'
import { VisitPhotoPrompt } from './visit-photos'
import type { Place } from '#/core/schema'
import type { TripConfig } from '#/core/schema'
import type { TripView } from '#/core/view'
import type { AgentUIMessage } from '#/server/agent/harness'
import { AgentProvider, ChatPanel, useAgent } from '#/chat/chat'
import { RaceLive } from '#/race/live'
import { CommunityTab } from './community'
import { FinishSheet } from './finish'
import { HomeTab } from './home-tab'
import { ProfileForm } from './profile'
import { DisplaySettings } from '#/app/display-settings'
import { PageFade } from '#/app/page-fade'
import { InstallApp } from './install'
import { isRacing } from '#/race/use-race'
import { MobileMenu, NavTabs, type Tab } from './nav'
import { TourTab } from './tour-tab'
import { useKeyboardSheet } from '#/app/keyboard-sheet'

/**
 * The app: a profile once, then 홈 · 레이스 · 관광 · 커뮤니티, with the
 * agent one tap away in a bottom sheet. Every screen reads the same trip
 * the agent changes.
 */

/** Questions worth asking from each screen, for where the trip is now. */
const tabChips = (
  tab: Tab,
  view: TripView,
  t: ReturnType<typeof useI18n>['t'],
): string[] => {
  const finished = view.state.phase >= 3
  const key =
    tab === 'home'
      ? 'chips.home'
      : tab === 'race'
        ? finished
          ? 'chips.raceAfter'
          : 'chips.raceBefore'
        : tab === 'tour'
          ? finished
            ? 'chips.tourAfter'
            : 'chips.tourBefore'
          : 'chips.community'
  return t(key).split('|')
}

export const Shell = ({
  config,
  tripId,
  initial,
}: {
  config: TripConfig
  tripId: string
  initial: { trip: TripView; messages: AgentUIMessage[] }
}) => {
  const { t, tx, locale } = useI18n()
  const agent = useAgent({ config, tripId, initial })
  const view = useMemo(
    () => localizeDeep(agent.view, locale),
    [agent.view, locale],
  )
  const { tab } = useSearch({ from: '/' })
  // On home the header floats over the hero photo: clear at rest, then a
  // strong untinted blur, in white while the photo is still behind it.
  const [heroState, setHeroState] = useState<'rest' | 'photo' | 'page'>('rest')
  useEffect(() => {
    if (tab !== 'home') return
    const sync = () => {
      const hero = document.getElementById('home-hero')
      const header = document.querySelector('header')
      const behind =
        hero && header
          ? hero.getBoundingClientRect().bottom >
            header.getBoundingClientRect().bottom
          : false
      setHeroState(window.scrollY < 8 ? 'rest' : behind ? 'photo' : 'page')
    }
    sync()
    window.addEventListener('scroll', sync, { passive: true })
    return () => window.removeEventListener('scroll', sync)
  }, [tab])
  const overHero = tab === 'home' && heroState !== 'page'
  const navigate = useNavigate({ from: '/' })
  const setTab = (next: Tab) => {
    void navigate({ search: { tab: next } })
    window.scrollTo({ top: 0 })
  }
  const [chatOpen, setChatOpen] = useState(false)
  const chatSheet = useKeyboardSheet(chatOpen)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileSheet = useKeyboardSheet(profileOpen)
  // The status bar shows the photo only while nothing light covers its top.
  const photoUnderStatusBar =
    overHero && !chatSheet.fullScreen && !profileSheet.fullScreen
  useEffect(() => {
    const root = document.documentElement
    if (photoUnderStatusBar) root.dataset.statusBar = 'photo'
    else delete root.dataset.statusBar
    return () => {
      delete root.dataset.statusBar
    }
  }, [photoUnderStatusBar])
  const [installOpen, setInstallOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [communityRevision, setCommunityRevision] = useState(0)
  const [visitPosts, setVisitPosts] = useState<CommunityPost[]>([])
  const [visitsReady, setVisitsReady] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      const v = JSON.parse(
        sessionStorage.getItem(`run2-photo-dismissed:${tripId}`) ?? '[]',
      )
      return Array.isArray(v) ? v : []
    } catch {
      return []
    }
  })
  useEffect(() => {
    const controller = new AbortController()
    setVisitsReady(false)
    fetch(`/api/community?tripId=${tripId}&visits=1`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('load')
        return r.json() as Promise<{ posts: CommunityPost[] }>
      })
      .then(({ posts }) => {
        if (!controller.signal.aborted) {
          setVisitPosts(posts)
          setVisitsReady(true)
        }
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [tripId, communityRevision, view.state.plan.completed.length])
  const opportunity = photoOpportunity(config, view.state, view.itinerary.slack)
  const dismissPhoto = (id: string) => {
    const ids = [...new Set([...dismissed, id])]
    setDismissed(ids)
    try {
      sessionStorage.setItem(
        `run2-photo-dismissed:${tripId}`,
        JSON.stringify(ids),
      )
    } catch {
      /* Session-only fallback. */
    }
  }
  const showPhoto = (place: Place) => {
    if (agent.busy) return
    dismissPhoto(place.id)
    setChatOpen(true)
    agent.send(t('say.sharePhotoAt', { place: place.attrs.short }))
  }
  const photoPrompt =
    opportunity &&
    visitsReady &&
    !agent.busy &&
    !dismissed.includes(opportunity.id) &&
    !visitPosts.some((p) => p.placeId === opportunity.id) ? (
      <VisitPhotoPrompt
        place={opportunity}
        share={() => showPhoto(opportunity)}
        dismiss={() => dismissPhoto(opportunity.id)}
      />
    ) : null
  const advance = async () => {
    if (updating || agent.busy) return
    setUpdating(true)
    try {
      const cmd =
        view.state.plan.stage === 'LOCAL' && !view.itinerary.stops.length
          ? startReturn(view.state, view.itinerary)
          : advanceTrip(view.state, view.itinerary)
      const { trip } = await postEvents(tripId, cmd.events)
      agent.setView(trip)
    } catch {
      toast.error(t('toast.saveFailed'))
    } finally {
      setUpdating(false)
    }
  }

  /** Open the agent, optionally saying something right away. */
  const ask = (text?: string) => {
    setChatOpen(true)
    if (text) agent.send(text)
  }
  const finish = async () => {
    if (view.state.phase >= 3) return
    const { trip } = await postEvents(tripId, [
      { type: 'day.advanced', phase: 3 },
    ])
    agent.setView(trip)
  }
  const refresh = () =>
    fetch(`/api/trips/${tripId}?live=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((r: { trip: TripView } | null) => r && agent.setView(r.trip))
      .catch(() => undefined)

  if (!view.state.created)
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-5 py-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-safe">
        <div className="flex justify-end">
          <DisplaySettings />
        </div>
        <ProfileForm
          onboarding
          config={config}
          view={view}
          tripId={tripId}
          onSaved={(trip) => {
            agent.setView(trip)
            window.scrollTo({ top: 0 })
          }}
        />
        <AssetCredits />
      </div>
    )

  return (
    <AgentProvider
      agent={agent}
      showTools={false}
      photoShared={() => setCommunityRevision((v) => v + 1)}
      showCommunity={() => {
        setChatOpen(false)
        setTab('community')
      }}
    >
      <div className="min-h-dvh overflow-x-clip">
        <PageFade />
        <header
          className={
            tab === 'home'
              ? `right-scroll-bar-position fixed inset-x-0 top-0 z-30 isolate border-b pt-safe text-foreground transition-colors ${heroState === 'page' ? '' : 'border-transparent'}`
              : 'sticky top-0 z-30 isolate border-b pt-safe text-foreground'
          }
          // Over the photo the header reads in white: swap the theme's ink.
          style={
            overHero
              ? ({
                  '--foreground': '#ffffff',
                  '--muted-foreground': 'rgb(255 255 255 / 0.75)',
                  // Hover and open states: a light veil, not the page's grey.
                  '--muted': 'rgb(255 255 255 / 0.16)',
                } as React.CSSProperties)
              : undefined
          }
        >
          {/* The blur reaches past the screen edges: blurring at the very
              edge reads beyond the page and rounds the corners while scrolling. */}
          {!(tab === 'home' && heroState === 'rest') && (
            <div
              aria-hidden
              className={`pointer-events-none absolute -inset-x-8 -top-8 bottom-0 -z-10 backdrop-blur-xl ${overHero ? '' : 'bg-background/40'}`}
            />
          )}
          <div className="relative mx-auto flex min-h-14 max-w-5xl items-center gap-1 px-3 py-1 sm:gap-2 sm:px-4">
            {/* The brand goes home, like on most sites. */}
            <button
              type="button"
              aria-label={t('nav.home')}
              className="flex cursor-pointer items-center gap-1 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:gap-2"
              onClick={() => {
                setTab('home')
                window.scrollTo({ top: 0 })
              }}
            >
              <Gull className="size-8" />
              <span className="whitespace-nowrap font-medium tracking-tight text-foreground">
                RUN2구룡포
              </span>
            </button>
            {/* Centred in the row, clear of the logo and the controls. */}
            <div className="absolute left-1/2 hidden -translate-x-1/2 md:block">
              <NavTabs tab={tab} onTab={setTab} />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <DisplaySettings />
              <div className="md:hidden">
                <MobileMenu
                  tab={tab}
                  onTab={setTab}
                  actions={[
                    {
                      label: t('menu.editPlan'),
                      onSelect: () => setProfileOpen(true),
                    },
                    {
                      label: t('install.button'),
                      onSelect: () => setInstallOpen(true),
                    },
                  ]}
                  onNewTrip={() => {
                    newTripId()
                    window.location.reload()
                  }}
                />
              </div>
              <div className="hidden md:block">
                {/* No scroll lock: hiding the scrollbar would shift the header. */}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0"
                      aria-label={t('menu.label')}
                    >
                      <Ellipsis />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
                        {t('menu.editPlan')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setInstallOpen(true)}>
                        {t('install.button')}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => {
                        newTripId()
                        window.location.reload()
                      }}
                    >
                      {t('menu.newTrip')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        {tab === 'home' && (
          <main className="pb-24" aria-label="home">
            <HomeTab
              config={config}
              view={view}
              racing={view.state.phase < 3 && isRacing(tripId)}
              onRace={() => {
                setTab('race')
                window.scrollTo({ top: 0 })
              }}
              onPlan={() => setChatOpen(true)}
            />
          </main>
        )}
        {/* Kept mounted so the race clock keeps running on other tabs. */}
        <main
          hidden={tab !== 'race'}
          className="pb-24"
          aria-label={t('nav.race')}
        >
          <RaceLive
            tripId={tripId}
            finished={view.state.phase >= 3}
            onFinish={() => setFinishOpen(true)}
          />
        </main>
        {tab === 'tour' && (
          <main className="pb-24" aria-label="tour">
            <TourTab
              config={config}
              view={view}
              active={tab === 'tour'}
              refresh={refresh}
              ask={ask}
              photoPrompt={photoPrompt}
              onPhoto={showPhoto}
              onAdvance={() => void advance()}
              onRace={() => {
                setTab('race')
                window.scrollTo({ top: 0 })
              }}
              onTravel={() => setChatOpen(true)}
              busy={agent.busy || updating}
              selectLegTransport={async (id, mode) => {
                const transportOverrides = {
                  ...view.state.plan.transportOverrides,
                }
                if (mode === 'AUTO') delete transportOverrides[id]
                else transportOverrides[id] = mode
                const { trip } = await postEvents(tripId, [
                  { type: 'plan.patched', patch: { transportOverrides } },
                ])
                agent.setView(trip)
              }}
              selectTransport={async (mode) => {
                const { trip } = await postEvents(tripId, [
                  {
                    type: 'plan.patched',
                    patch: { localTransport: mode, transportOverrides: {} },
                  },
                ])
                agent.setView(trip)
              }}
            />
          </main>
        )}
        {tab === 'community' && (
          <main className="pb-24" aria-label="community">
            <CommunityTab
              config={config}
              revision={communityRevision}
              onFinish={() => setFinishOpen(true)}
              onPhoto={() => ask(t('say.sharePhoto'))}
            />
          </main>
        )}
      </div>

      <Button
        size="icon-lg"
        className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 size-16 rounded-full border border-primary/15 bg-card p-0 text-primary shadow-lg hover:bg-secondary"
        aria-label={t('agent.ask')}
        onClick={() => ask()}
      >
        <GullPose className="w-14" decorative />
      </Button>

      <FinishSheet
        open={finishOpen}
        onOpenChange={setFinishOpen}
        tripId={tripId}
        course={view.state.plan.course}
        finish={finish}
        onShared={() => setCommunityRevision((v) => v + 1)}
        onCommunity={() => setTab('community')}
        onContinue={() => {
          setTab('tour')
          ask(t('say.prepareTrip'))
        }}
      />

      <Drawer open={chatOpen} onOpenChange={setChatOpen} {...chatSheet.drawer}>
        <DrawerContent
          {...chatSheet.content}
          className={`h-[88dvh] data-[vaul-drawer-direction=bottom]:max-h-[88dvh] ${chatSheet.content.className}`}
        >
          {chatSheet.fullScreen ? (
            // Typing, or pulled up: a full-screen chat with a one-line header.
            <DrawerHeader className="flex-row items-center gap-2 border-b px-3 py-2 text-left">
              <GullPose className="w-7" decorative />
              <DrawerTitle className="min-w-0 flex-1 truncate">
                {tx(agentName)}
              </DrawerTitle>
              <DrawerDescription className="sr-only">
                {t('agent.sheetDescription')}
              </DrawerDescription>
              {/* Keep focus on pointer-down: blurring first would close the keyboard
                  and swap this header out before the tap lands. */}
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('common.close')}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => setChatOpen(false)}
              >
                <ChevronDown />
              </Button>
            </DrawerHeader>
          ) : (
            <DrawerHeader className="border-b">
              <DrawerTitle className="flex items-center justify-center gap-2 md:justify-start">
                <GullPose className="w-12" decorative />
                {tx(agentName)}
              </DrawerTitle>
              <DrawerDescription>
                {t('agent.sheetDescription')}
              </DrawerDescription>
            </DrawerHeader>
          )}
          <ChatPanel
            agent={agent}
            suggestions={tabChips(tab, view, t)}
            photoPrompt={photoPrompt}
            voice
            keyboardOpen={chatSheet.keyboardOpen}
          />
        </DrawerContent>
      </Drawer>

      <InstallApp open={installOpen} onOpenChange={setInstallOpen} />

      <Drawer
        open={profileOpen}
        onOpenChange={setProfileOpen}
        {...profileSheet.drawer}
      >
        <DrawerContent
          {...profileSheet.content}
          className={`h-[88dvh] data-[vaul-drawer-direction=bottom]:max-h-[88dvh] ${profileSheet.content.className}`}
        >
          <DrawerHeader className="border-b">
            <DrawerTitle>{t('edit.title')}</DrawerTitle>
            <DrawerDescription>{t('edit.description')}</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-safe">
            <ProfileForm
              config={config}
              view={view}
              tripId={tripId}
              submitLabel={t('common.save')}
              onSaved={(trip) => {
                agent.setView(trip)
                setProfileOpen(false)
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </AgentProvider>
  )
}
