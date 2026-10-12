import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Ellipsis, Flag, House, Map as MapIcon, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { localizeDeep } from '#/i18n/phrases'
import { useI18n } from '#/i18n/react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import { InstallApp } from './install'
import { TourTab } from './tour-tab'

/**
 * The app: a profile once, then 홈 · 레이스 · 관광 · 커뮤니티, with the
 * agent one tap away in a bottom sheet. Every screen reads the same trip
 * the agent changes.
 */

type Tab = 'home' | 'race' | 'tour' | 'community'

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

const TOOLS_KEY = 'run2-show-tools'
/** Voice mode stays opt-in until Korean speech quality is checked. */
const VOICE_KEY = 'run2-voice-beta'
const readFlag = (key: string) => {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
const writeFlag = (key: string, on: boolean) => {
  try {
    localStorage.setItem(key, on ? '1' : '0')
  } catch {
    // Private mode: the toggle still works for this visit.
  }
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
  const navigate = useNavigate({ from: '/' })
  const setTab = (next: Tab) => {
    void navigate({ search: { tab: next } })
    window.scrollTo({ top: 0 })
  }
  const [chatOpen, setChatOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
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

  const [showTools, setShowTools] = useState(() => readFlag(TOOLS_KEY))
  const [voiceBeta, setVoiceBeta] = useState(() => readFlag(VOICE_KEY))

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
      showTools={showTools}
      photoShared={() => setCommunityRevision((v) => v + 1)}
      showCommunity={() => {
        setChatOpen(false)
        setTab('community')
      }}
    >
      <div className="min-h-dvh">
        <header className="sticky top-0 z-30 border-b bg-background pt-safe">
          <div className="mx-auto flex min-h-14 max-w-2xl items-center gap-1 px-3 py-1 sm:gap-2 sm:px-4">
            <Gull className="size-8" />
            <span className="whitespace-nowrap font-bold tracking-tight text-foreground">
              RUN2구룡포
            </span>
            {showTools && agent.mode && (
              <Badge variant="outline">{t(`mode.${agent.mode}`)}</Badge>
            )}
            <div className="ml-auto hidden sm:block">
              <InstallApp compact />
            </div>
            <div className="ml-auto flex shrink-0 items-center sm:ml-0">
              <DisplaySettings />
              <DropdownMenu>
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
                    <DropdownMenuItem
                      className="sm:hidden"
                      onSelect={() => setInstallOpen(true)}
                    >
                      {t('install.button')}
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger disabled={agent.busy}>
                        {t('menu.demo')}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuLabel>
                          {t('menu.demoHint')}
                        </DropdownMenuLabel>
                        {config.scenarios.map((s) => (
                          <DropdownMenuItem
                            key={s.id}
                            onSelect={() => ask(`/시연 ${s.title}`)}
                          >
                            {s.title}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuCheckboxItem
                      checked={showTools}
                      onCheckedChange={(on) => {
                        setShowTools(on)
                        writeFlag(TOOLS_KEY, on)
                      }}
                    >
                      {t('menu.presentation')}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={voiceBeta}
                      onCheckedChange={(on) => {
                        setVoiceBeta(on)
                        writeFlag(VOICE_KEY, on)
                      }}
                    >
                      {t('menu.voice')}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuItem asChild>
                      <Link to="/classic">{t('menu.classic')}</Link>
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
          <div className="mx-auto max-w-2xl px-4 pb-2">
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
              <TabsList
                variant="line"
                aria-label={t('nav.label')}
                className="w-full"
              >
                {(
                  [
                    { id: 'home', Icon: House },
                    { id: 'race', Icon: Flag },
                    { id: 'tour', Icon: MapIcon },
                    { id: 'community', Icon: Users },
                  ] as const
                ).map(({ id, Icon }) => (
                  <TabsTrigger
                    key={id}
                    value={id}
                    className="text-xs sm:text-sm"
                  >
                    {/* At the largest text size the labels need the room. */}
                    <Icon
                      aria-hidden
                      className="max-[420px]:[html[data-font-size=largest]_&]:hidden"
                    />
                    {t(`nav.${id}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </header>

        {tab === 'home' && (
          <main className="pb-24" aria-label="home">
            <HomeTab
              config={config}
              view={view}
              onRace={() => {
                setTab('race')
                window.scrollTo({ top: 0 })
              }}
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

      <Drawer open={chatOpen} onOpenChange={setChatOpen}>
        <DrawerContent className="h-[88dvh] data-[vaul-drawer-direction=bottom]:max-h-[88dvh]">
          <DrawerHeader className="border-b">
            <DrawerTitle className="flex items-center justify-center gap-2 md:justify-start">
              <GullPose className="w-12" decorative />
              {tx(agentName)}
            </DrawerTitle>
            <DrawerDescription>{t('agent.sheetDescription')}</DrawerDescription>
          </DrawerHeader>
          <ChatPanel
            agent={agent}
            suggestions={tabChips(tab, view, t)}
            photoPrompt={photoPrompt}
            voice={voiceBeta}
          />
        </DrawerContent>
      </Drawer>

      <InstallApp open={installOpen} onOpenChange={setInstallOpen} />

      <Drawer open={profileOpen} onOpenChange={setProfileOpen}>
        <DrawerContent className="h-[88dvh] data-[vaul-drawer-direction=bottom]:max-h-[88dvh]">
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
