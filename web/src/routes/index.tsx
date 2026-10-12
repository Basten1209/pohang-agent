import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loading, loadConfig } from '#/app/load-config'
import { cachedView, currentTripId, fetchTrip } from '#/app/trip-client'
import { clock } from '#/core/time'
import type { TripView } from '#/core/view'
import type { AgentUIMessage } from '#/server/agent/harness'
import { Shell } from '#/home/shell'
import { localizeConfig } from '#/i18n/config'
import { useI18n } from '#/i18n/react'

export const Route = createFileRoute('/')({
  // The device only knows its trip id (localStorage), so render on the client.
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab: 'home' | 'race' | 'tour' | 'community' } => ({
    tab: ['home', 'race', 'tour', 'community'].includes(String(search.tab))
      ? (search.tab as 'home' | 'race' | 'tour' | 'community')
      : 'home',
  }),
  loader: loadConfig,
  pendingComponent: Loading,
  component: Home,
})

type Loaded = { trip: TripView; messages: AgentUIMessage[] }

/** Offline: the server holds the trip, so show the last view read-only. */
const Offline = () => {
  const view = cachedView()
  const { t } = useI18n()
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6 text-sm">
      <p className="font-semibold">{t('offline.title')}</p>
      {view?.state.created ? (
        <p className="text-muted-foreground tabular-nums">
          {t('offline.last', { time: view.state.plan.departTime })}
          {view.itinerary.planningArrival !== null &&
            t('offline.arrival', {
              time: clock(view.itinerary.planningArrival),
            })}
        </p>
      ) : (
        <p className="text-muted-foreground">{t('offline.later')}</p>
      )}
      <div className="flex gap-2">
        <Button onClick={() => window.location.reload()}>
          {t('common.retry')}
        </Button>
        <Button asChild variant="outline">
          <Link to="/classic">{t('menu.classic')}</Link>
        </Button>
      </div>
    </div>
  )
}

function Home() {
  const { config: source } = Route.useLoaderData()
  const { locale } = useI18n()
  const config = useMemo(() => localizeConfig(source, locale), [source, locale])
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
  return <Shell config={config} tripId={tripId} initial={loaded} />
}
