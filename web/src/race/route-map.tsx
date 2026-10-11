import { useEffect, useRef, useState } from 'react'
import type { CircleMarker, Map as LeafletMap, Polyline } from 'leaflet'
import { LocateFixed } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { Button } from '@/components/ui/button'
import { demoRoute, routeAt } from '#/core/race-route'

export const RaceRouteMap = ({ progress }: { progress: number }) => {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const layers = useRef<{ trail: Polyline; marker: CircleMarker } | null>(null)
  const latest = useRef(routeAt(progress))
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'tiles-error' | 'error'
  >('loading')
  const [attempt, setAttempt] = useState(0)

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
          .zoom({ zoomInTitle: '지도 확대', zoomOutTitle: '지도 축소' })
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
          color: '#526579',
          weight: 4,
          opacity: 0.5,
          dashArray: '5 8',
          interactive: false,
        }).addTo(map)
        const trail = L.polyline(latest.current.trail, {
          color: '#007e88',
          weight: 6,
          opacity: 1,
          interactive: false,
        }).addTo(map)
        L.circleMarker(demoRoute[0], {
          radius: 5,
          color: '#102a43',
          fillColor: '#fff',
          fillOpacity: 1,
          weight: 2,
        })
          .addTo(map)
          .bindTooltip('출발 · 도착', { permanent: true, direction: 'left' })
        const marker = L.circleMarker(latest.current.position, {
          radius: 8,
          color: '#fff',
          weight: 3,
          fillColor: '#005cb9',
          fillOpacity: 1,
        })
          .addTo(map)
          .bindTooltip('나의 시연 위치', { direction: 'right' })
        layers.current = { trail, marker }
        resize = new ResizeObserver(() => map?.invalidateSize({ pan: false }))
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
  }, [attempt])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">나의 이동 경로</p>
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
          전체 경로
        </Button>
      </div>
      <div className="relative isolate overflow-hidden rounded-2xl border">
        <div
          ref={container}
          className="race-map h-72 w-full bg-[#e8f0ef] sm:h-80"
          role="region"
          aria-label="영일대 주변 가상 GPS 이동 경로 지도"
        />
        {status === 'loading' && (
          <p
            role="status"
            className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground"
          >
            지도를 불러오는 중이에요…
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
              ? '지도를 불러오지 못했어요.'
              : '지도 배경 일부를 불러오지 못했어요.'}{' '}
            시연 기록은 계속 진행돼요.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAttempt((n) => n + 1)}
          >
            지도 다시 불러오기
          </Button>
        </div>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-[#007e88]">━ 이동한 경로</span>
        {' · '}
        <span className="text-[#005cb9]">● 현재 위치</span>
        {' · '}가상 GPS 시연
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        영일대 주변을 그린 시연 경로로, 실제 대회 코스와 달라요.
      </p>
    </div>
  )
}
