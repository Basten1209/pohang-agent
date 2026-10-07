import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loading, loadConfig } from '#/app/load-config'
import { cachedView, currentTripId, fetchTrip } from '#/app/trip-client'
import { clock } from '#/core/time'
import type { TripView } from '#/core/view'
import type { AgentUIMessage } from '#/server/agent/harness'
import { Chat } from '#/chat/chat'

export const Route = createFileRoute('/')({
  // The device only knows its trip id (localStorage), so render on the client.
  ssr: false,
  loader: loadConfig,
  pendingComponent: Loading,
  component: Home,
})

type Loaded = { trip: TripView; messages: AgentUIMessage[] }

/** Offline: the server holds the trip, so show the last view read-only. */
const Offline = () => {
  const view = cachedView()
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6 text-sm">
      <p className="font-semibold">서버에 연결할 수 없어요</p>
      {view?.state.created ? (
        <p className="text-muted-foreground tabular-nums">
          마지막으로 본 일정: {view.state.plan.trainTime} 열차
          {view.itinerary.planningArrival !== null &&
            ` · 포항역 ${clock(view.itinerary.planningArrival)} 도착 (계획)`}
        </p>
      ) : (
        <p className="text-muted-foreground">
          연결되면 이어서 대화할 수 있어요.
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={() => window.location.reload()}>다시 시도</Button>
        <Button asChild variant="outline">
          <Link to="/classic">화면으로 보기</Link>
        </Button>
      </div>
    </div>
  )
}

function Home() {
  const { config } = Route.useLoaderData()
  const tripId = useMemo(currentTripId, [])
  const [loaded, setLoaded] = useState<Loaded | 'offline' | null>(null)

  useEffect(() => {
    fetchTrip(tripId)
      .then((r) =>
        setLoaded({ trip: r.trip, messages: r.messages as AgentUIMessage[] }),
      )
      .catch(() => setLoaded('offline'))
    if ('serviceWorker' in navigator && import.meta.env.PROD)
      navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  }, [tripId])

  if (loaded === null) return <Loading />
  if (loaded === 'offline') return <Offline />
  return <Chat config={config} tripId={tripId} initial={loaded} />
}
