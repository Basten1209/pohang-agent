import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Ellipsis, Flag, House, Map as MapIcon, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Gull, GullPose, AssetCredits } from '#/brand/brand'
import { newTripId, postEvents } from '#/app/trip-client'
import { toast } from 'sonner'
import { advance as advanceTrip, startReturn } from '#/core/trip'
import { photoOpportunity, type CommunityPost } from '#/core/community'
import { agentName } from '#/core/identity'
import { VisitPhotoPrompt } from './visit-photos'
import type { Place } from '#/core/schema'
import type { TripConfig } from '#/core/schema'
import type { Stage } from '#/core/stage'
import type { TripView } from '#/core/view'
import type { AgentMode, AgentUIMessage } from '#/server/agent/harness'
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

const stageLabel: Record<Stage, string> = {
  ONBOARDING: '프로필',
  PRE_RACE: '대회 전',
  CHECK_IN: '완주 후',
  PLANNING: '코스 고르기',
  JOURNEY: '이동 중',
  SAFETY: '안전 우선',
  DONE: '도착',
}

const modeLabel: Record<AgentMode, string> = {
  OPENAI: 'AI',
  DEMO: '규칙 모델',
  FALLBACK: '규칙 모델(대체)',
}

/** Questions worth asking from each screen, for where the trip is now. */
const tabChips = (tab: Tab, view: TripView): string[] => {
  const finished = view.state.phase >= 3
  switch (tab) {
    case 'home':
      return ['대회 준비물 알려줘', '셔틀 있어?', '대회날 날씨 어때?']
    case 'race':
      return finished
        ? ['지금도 시간 괜찮아?']
        : ['완주했어요', '급수대 어디 있어?']
    case 'tour':
      return finished
        ? ['16시 기차로 바꿨어', '왜 이 코스야?', '지금도 시간 괜찮아?']
        : ['구룡포는 뭘로 유명해요?']
    case 'community':
      return ['구룡포는 뭘로 유명해요?']
  }
}

const TOOLS_KEY = 'run2-show-tools'
const readFlag = () => {
  try {
    return localStorage.getItem(TOOLS_KEY) === '1'
  } catch {
    return false
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
  const agent = useAgent({ config, tripId, initial })
  const { view } = agent
  const { tab } = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })
  const setTab = (next: Tab) => {
    void navigate({ search: { tab: next } })
    window.scrollTo({ top: 0 })
  }
  const [chatOpen, setChatOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
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
    agent.send(`${place.attrs.short}에서 찍은 사진을 커뮤니티에 올릴래요`)
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
      toast.error('진행을 저장하지 못했어요. 다시 눌러 주세요.')
    } finally {
      setUpdating(false)
    }
  }

  const [showTools, setShowTools] = useState(readFlag)

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
            <Badge variant="secondary">
              {view.state.plan.stage === 'LOCAL'
                ? '관광 중'
                : stageLabel[view.stage]}
            </Badge>
            {showTools && agent.mode && (
              <Badge variant="outline">{modeLabel[agent.mode]}</Badge>
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
                    aria-label="메뉴"
                  >
                    <Ellipsis />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
                      내 일정 수정
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger disabled={agent.busy}>
                        시연 조건
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuLabel>
                          에이전트에게 /시연 명령을 보내요
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
                        try {
                          localStorage.setItem(TOOLS_KEY, on ? '1' : '0')
                        } catch {
                          // Private mode: the toggle still works for this visit.
                        }
                      }}
                    >
                      발표 모드 (도구 호출 보기)
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuItem asChild>
                      <Link to="/classic">화면으로 보기</Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      newTripId()
                      window.location.reload()
                    }}
                  >
                    새 여정 시작
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="mx-auto max-w-2xl px-4 pb-2">
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
              <TabsList aria-label="주 메뉴" className="w-full">
                {(
                  [
                    { id: 'home', label: '홈', Icon: House },
                    { id: 'race', label: '레이스', Icon: Flag },
                    { id: 'tour', label: '관광', Icon: MapIcon },
                    { id: 'community', label: '커뮤니티', Icon: Users },
                  ] as const
                ).map(({ id, label, Icon }) => (
                  <TabsTrigger key={id} value={id}>
                    {/* At the largest text size the labels need the room. */}
                    <Icon
                      aria-hidden
                      className="max-[420px]:[html[data-font-size=largest]_&]:hidden"
                    />
                    {label}
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
              onEditProfile={() => setProfileOpen(true)}
              onRace={() => {
                setTab('race')
                window.scrollTo({ top: 0 })
              }}
            />
          </main>
        )}
        {/* Kept mounted so the race clock keeps running on other tabs. */}
        <main hidden={tab !== 'race'} className="pb-24" aria-label="레이스">
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
              onPhoto={() => ask('여행 사진을 커뮤니티에 올릴래요')}
            />
          </main>
        )}
      </div>

      <Button
        size="icon-lg"
        className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 size-16 rounded-full border border-primary/15 bg-card p-0 text-primary shadow-lg hover:bg-secondary"
        aria-label="에이전트에게 묻기"
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
          ask('완주 후 여행을 준비할게요.')
        }}
      />

      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent
          side="bottom"
          className="gap-0 p-0 data-[side=bottom]:h-[88dvh]"
        >
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-2">
              <GullPose className="w-12" decorative />
              {agentName}
            </SheetTitle>
            <SheetDescription>
              대회·코스·맛집·버스, 무엇이든 물어보세요
            </SheetDescription>
          </SheetHeader>
          <ChatPanel
            agent={agent}
            suggestions={tabChips(tab, view)}
            photoPrompt={photoPrompt}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent
          side="bottom"
          className="gap-0 p-0 data-[side=bottom]:h-[88dvh]"
        >
          <SheetHeader className="border-b">
            <SheetTitle>내 일정 수정</SheetTitle>
            <SheetDescription>
              바꾼 내용으로 코스를 다시 계산해요
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-safe">
            <ProfileForm
              config={config}
              view={view}
              tripId={tripId}
              submitLabel="저장"
              onSaved={(trip) => {
                agent.setView(trip)
                setProfileOpen(false)
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </AgentProvider>
  )
}
