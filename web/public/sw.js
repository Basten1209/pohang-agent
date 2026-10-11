/*
 * RUN2구룡포 service worker.
 *
 * Strategies are chosen per request by a small rule table:
 *   - /api/*            → network only (decisions, chat and evidence are never cached)
 *   - navigations       → network first, fall back to the cached app shell
 *   - hashed assets     → cache first (immutable build output)
 *   - images / icons    → stale-while-revalidate
 * Bump VERSION to drop old caches.
 */
const VERSION = 'run2-v12'
const SHELL = [
  '/',
  '/classic',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/apple-touch-icon.png',
  '/images/brand/gull-wave-transparent.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

const put = (request, response) => {
  if (response.ok && response.type === 'basic') {
    const copy = response.clone()
    caches.open(VERSION).then((cache) => cache.put(request, copy))
  }
  return response
}

const strategies = {
  networkOnly: (request) => fetch(request),
  networkFirst: (request) =>
    fetch(request)
      .then((response) => put(request, response))
      .catch(() =>
        caches.match(request).then((hit) => hit || caches.match('/')),
      ),
  cacheFirst: (request) =>
    caches
      .match(request)
      .then((hit) => hit || fetch(request).then((r) => put(request, r))),
  staleWhileRevalidate: (request) =>
    caches.match(request).then((hit) => {
      const fresh = fetch(request)
        .then((r) => put(request, r))
        .catch(() => hit)
      return hit || fresh
    }),
}

const rules = [
  [
    (req, url) => url.origin !== self.location.origin || req.method !== 'GET',
    null,
  ],
  [(_req, url) => url.pathname.startsWith('/api/'), 'networkOnly'],
  [(req) => req.mode === 'navigate', 'networkFirst'],
  [(_req, url) => url.pathname.startsWith('/assets/'), 'cacheFirst'],
  [
    (_req, url) => /\.(?:png|jpe?g|svg|webp|woff2?)$/.test(url.pathname),
    'staleWhileRevalidate',
  ],
]

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  const match = rules.find(([test]) => test(event.request, url))
  const strategy = match && match[1]
  if (strategy) event.respondWith(strategies[strategy](event.request))
})
