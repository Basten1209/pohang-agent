import { Link } from '@tanstack/react-router'
import {
  Ellipsis,
  Flag,
  House,
  Map as MapIcon,
  MessageCircle,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { newTripId } from '#/app/trip-client'
import type { TripConfig } from '#/core/schema'
import type { Stage } from '#/core/stage'
import type { TripView } from '#/core/view'
import type { AgentMode, AgentUIMessage } from '#/server/agent/harness'
import { AgentProvider, ChatPanel, useAgent } from '#/chat/chat'
import { RaceLive } from '#/race/live'
import { CommunityTab } from './community'
import { HomeTab } from './home-tab'
import { ProfileForm } from './profile'
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
  const [tab, setTab] = useState<Tab>('home')
  const [chatOpen, setChatOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [showTools, setShowTools] = useState(readFlag)

  /** Open the agent, optionally saying something right away. */
  const ask = (text?: string) => {
    setChatOpen(true)
    if (text) agent.send(text)
  }
  const refresh = () =>
    fetch(`/api/trips/${tripId}?live=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((r: { trip: TripView } | null) => r && agent.setView(r.trip))
      .catch(() => undefined)

  if (!view.state.created)
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 p-4 pt-safe pb-safe">
        <div className="flex flex-col gap-1 pt-4">
          <span className="text-sm text-muted-foreground">RUN2포항</span>
          <h1 className="text-2xl font-semibold tracking-tight">
            완주 후 하루를 같이 짤게요
          </h1>
          <p className="text-sm text-muted-foreground">
            {config.event.name} · {config.event.dateLabel}
          </p>
        </div>
        <ProfileForm
          config={config}
          view={view}
          tripId={tripId}
          onSaved={(trip) => {
            agent.setView(trip)
            window.scrollTo({ top: 0 })
          }}
        />
      </div>
    )

  return (
    <AgentProvider agent={agent} showTools={showTools}>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as Tab)
          window.scrollTo({ top: 0 })
        }}
        className="min-h-dvh gap-0"
      >
        <header className="sticky top-0 z-30 border-b bg-background pt-safe">
          <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4">
            <span className="font-semibold">RUN2포항</span>
            <Badge variant="secondary">{stageLabel[view.stage]}</Badge>
            {agent.mode && (
              <Badge variant="outline">{modeLabel[agent.mode]}</Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="ml-auto"
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
          <div className="mx-auto max-w-2xl px-4 pb-2">
            <TabsList className="w-full">
              <TabsTrigger value="home">
                <House />홈
              </TabsTrigger>
              <TabsTrigger value="race">
                <Flag />
                레이스
              </TabsTrigger>
              <TabsTrigger value="tour">
                <MapIcon />
                관광
              </TabsTrigger>
              <TabsTrigger value="community">
                <Users />
                커뮤니티
              </TabsTrigger>
            </TabsList>
          </div>
        </header>

        <TabsContent value="home" className="pb-24">
          <HomeTab
            config={config}
            view={view}
            onEditProfile={() => setProfileOpen(true)}
          />
        </TabsContent>
        {/* Kept mounted so the race clock keeps running on other tabs. */}
        <TabsContent
          value="race"
          forceMount
          className="pb-24 data-[state=inactive]:hidden"
        >
          {view.state.phase < 3 && (
            <div className="mx-auto max-w-2xl px-4 pt-4">
              <Button
                className="w-full"
                size="lg"
                onClick={() => ask('완주했어요')}
              >
                <Flag />
                완주했어요
              </Button>
            </div>
          )}
          <RaceLive />
        </TabsContent>
        <TabsContent value="tour" className="pb-24">
          <TourTab
            config={config}
            view={view}
            active={tab === 'tour'}
            refresh={refresh}
            ask={ask}
          />
        </TabsContent>
        <TabsContent value="community" className="pb-24">
          <CommunityTab config={config} />
        </TabsContent>
      </Tabs>

      <Button
        size="icon-lg"
        className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 size-12 rounded-full shadow-lg"
        aria-label="에이전트에게 묻기"
        onClick={() => ask()}
      >
        <MessageCircle />
      </Button>

      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent
          side="bottom"
          className="gap-0 p-0 data-[side=bottom]:h-[88dvh]"
        >
          <SheetHeader className="border-b">
            <SheetTitle>에이전트</SheetTitle>
            <SheetDescription>
              대회·코스·맛집·버스, 무엇이든 물어보세요
            </SheetDescription>
          </SheetHeader>
          <ChatPanel agent={agent} suggestions={tabChips(tab, view)} />
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
