import { useEffect, useRef, useState } from 'react'
import type { CircleMarker, Map as LeafletMap, Polyline } from 'leaflet'
import { LocateFixed } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { Button } from '@/components/ui/button'
import { demoRoute, routeAt } from '#/core/race-route'
import { useI18n } from '#/i18n/react'

/** Leaflet draws SVG attributes, which cannot use CSS variables: read the theme tokens once. */
const themeColors = () => {
  const css = getComputedStyle(document.documentElement)
  const token = (name: string) => css.getPropertyValue(name).trim()
  return {
    primary: token('--primary'),
    foreground: token('--foreground'),
    muted: token('--muted-foreground'),
    card: token('--card'),
  }
}

export const RaceRouteMap = ({ progress }: { progress: number }) => {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const layers = useRef<{ trail: Polyline; marker: CircleMarker } | null>(null)
  const latest = useRef(routeAt(progress))
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'tiles-error' | 'error'
  >('loading')
  const [attempt, setAttempt] = useState(0)
  const { t } = useI18n()

  useEffect(() => {
    latest.current = routeAt(progress)
    layers.current?.trail.setLatLngs(latest.current.trail)
    layers.current?.marker.setLatLng(latest.current.position)
  }, [progress])

  useEffect(() => {
    let cancelled = false
    let map: LeafletMap | undefined
    let resize: ResizeObserver | undefined
    setStatus('loading')
    // Leaflet accesses window at import time; keep it outside server rendering.
    const colors = themeColors()
    void import('leaflet')
      .then((L) => {
        if (cancelled || !container.current) return
        map = L.map(container.current, {
          scrollWheelZoom: false,
          zoomControl: false,
          // A static viewport respects reduced motion and lets people inspect the route.
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
        })
        mapRef.current = map
        L.control
          .zoom({
            zoomInTitle: t('race.map.zoomIn'),
            zoomOutTitle: t('race.map.zoomOut'),
          })
          .addTo(map)
        map.fitBounds([...demoRoute], {
          padding: [28, 32],
          maxZoom: 14,
          animate: false,
        })
        // Request only visible tiles, with normal browser caching and Referer.
        // No GPS permission, geolocation API, offline prefetch or server location storage.
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
          maxZoom: 19,
          referrerPolicy: 'strict-origin-when-cross-origin',
        })
          .on('tileerror', () => {
            if (!cancelled) setStatus('tiles-error')
          })
          .addTo(map)
        L.polyline([...demoRoute], {
          color: colors.muted,
          weight: 4,
          opacity: 0.5,
          dashArray: '5 8',
          interactive: false,
        }).addTo(map)
        const trail = L.polyline(latest.current.trail, {
          color: colors.primary,
          weight: 6,
          opacity: 1,
          interactive: false,
        }).addTo(map)
        L.circleMarker(demoRoute[0], {
          radius: 5,
          color: colors.foreground,
          fillColor: colors.card,
          fillOpacity: 1,
          weight: 2,
        })
          .addTo(map)
          .bindTooltip(t('race.map.startFinish'), {
            permanent: true,
            direction: 'left',
          })
        L.circleMarker(demoRoute[(demoRoute.length - 1) / 2], {
          radius: 5,
          color: colors.primary,
          fillColor: colors.card,
          fillOpacity: 1,
          weight: 2,
        })
          .addTo(map)
          .bindTooltip(t('race.map.turn'), {
            permanent: true,
            direction: 'right',
          })
        const marker = L.circleMarker(latest.current.position, {
          radius: 8,
          color: colors.card,
          weight: 3,
          fillColor: colors.primary,
          fillOpacity: 1,
        })
          .addTo(map)
          .bindTooltip(t('race.map.me'), { direction: 'right' })
        layers.current = { trail, marker }
        resize = new ResizeObserver(([entry]) => {
          // The race stays mounted behind navigation. A hidden container has
          // zero dimensions, so its initial bounds must be fitted once visible.
          if (!entry.contentRect.width || !entry.contentRect.height) return
          map?.invalidateSize({ pan: false })
          map?.fitBounds([...demoRoute], {
            padding: [28, 32],
            maxZoom: 14,
            animate: false,
          })
        })
        resize.observe(container.current)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
      resize?.disconnect()
      layers.current = null
      mapRef.current = null
      map?.remove()
    }
  }, [attempt, t])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{t('race.map.title')}</p>
        <Button
          variant="ghost"
          size="sm"
          disabled={status === 'loading' || status === 'error'}
          onClick={() =>
            mapRef.current?.fitBounds([...demoRoute], {
              padding: [28, 32],
              maxZoom: 14,
              animate: false,
            })
          }
        >
          <LocateFixed />
          {t('race.map.fit')}
        </Button>
      </div>
      <div className="relative isolate overflow-hidden rounded-2xl border">
        <div
          ref={container}
          className="race-map h-72 w-full bg-secondary sm:h-80"
          role="region"
          aria-label={t('race.map.region')}
        />
        {status === 'loading' && (
          <p
            role="status"
            className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground"
          >
            {t('race.map.loading')}
          </p>
        )}
      </div>
      {(status === 'error' || status === 'tiles-error') && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
        >
          <p>
            {status === 'error'
              ? t('race.map.error')
              : t('race.map.tilesError')}{' '}
            {t('race.map.continues')}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAttempt((n) => n + 1)}
          >
            {t('race.map.retry')}
          </Button>
        </div>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-primary">
          ━ {t('race.map.trail')}
        </span>
        {' · '}
        <span className="text-primary">● {t('race.map.here')}</span>
        {' · '}
        {t('race.map.demo')}
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t('race.map.note')}
      </p>
    </div>
  )
}
