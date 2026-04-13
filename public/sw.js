// Cruzar Service Worker — push notifications + offline resilience.
//
// The border has notoriously bad cell coverage: line-of-sight issues at
// the bridges, carrier handoff between Telcel / AT&T / T-Mobile, peak
// congestion when everyone's in line. The worst moment to have the app
// break is the exact moment the user needs it most. This service worker
// caches the last-known wait times and recent reports so the app ALWAYS
// shows numbers — even with zero signal — instead of blank skeletons.
//
// Strategy:
//   - /api/ports            → stale-while-revalidate (show cache instantly, update in background)
//   - /api/reports/recent   → stale-while-revalidate
//   - Other /api/*          → network-only (auth-bound, must be fresh)
//   - Page navigations      → network-first, fall back to cached shell
//   - Static assets         → cache-first, network fallback

const CACHE = 'cruzar-v4'
const API_CACHE = 'cruzar-api-v4'
const SHELL = ['/']

// API routes that are safe to serve stale-while-revalidate. These are
// public, non-auth-bound, and the user benefits far more from seeing
// 2-min-old numbers than a blank screen on a spotty connection.
const SWR_API_PATHS = [
  '/api/ports',
  '/api/reports/recent',
]

function isSwrPath(pathname) {
  return SWR_API_PATHS.some(p => pathname === p || pathname.startsWith(p + '?'))
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {}))
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    (async () => {
      // Drop old cache versions so we don't accumulate stale data
      // forever across deploys.
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter(k => k !== CACHE && k !== API_CACHE)
          .map(k => caches.delete(k))
      )
      await self.clients.claim()
    })()
  )
})

async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE)
  const cached = await cache.match(request)

  // Kick off a background refresh no matter what — if it succeeds, the
  // cache is updated for next time. Failure is silent so the user's
  // current response isn't affected.
  const networkPromise = fetch(request)
    .then(res => {
      if (res && res.ok) cache.put(request, res.clone()).catch(() => {})
      return res
    })
    .catch(() => null)

  if (cached) return cached

  // No cache yet — wait for the network. If the network also fails,
  // return a minimal empty-but-valid shape so the page doesn't explode.
  const networkRes = await networkPromise
  if (networkRes) return networkRes

  return new Response(
    JSON.stringify({ ports: [], reports: [] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // SWR for the two public APIs the homepage depends on.
  if (url.pathname.startsWith('/api/')) {
    if (isSwrPath(url.pathname)) {
      e.respondWith(staleWhileRevalidate(request))
    }
    // Other /api/* routes: let the network handle them normally.
    return
  }

  // Pages + static assets: network-first, cache fallback.
  e.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok && (request.destination === 'document' || request.destination === 'image')) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(request, clone)).catch(() => {})
        }
        return res
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        if (request.destination === 'document') {
          return (await caches.match('/')) || new Response('Offline', { status: 503 })
        }
      })
  )
})

self.addEventListener('push', e => {
  if (!e.data) return
  let data = {}
  try { data = e.data.json() } catch { data = { title: 'Cruzar', body: e.data.text() } }

  const isUrgent = !!data.requireInteraction || (data.tag || '').startsWith('urgent-')
  const vibrate = data.vibrate
    || (isUrgent ? [400, 120, 400, 120, 400, 120, 600] : [250, 100, 250])

  e.waitUntil(
    self.registration.showNotification(data.title || 'Cruzar', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'cruzar-alert',
      data: { url: data.url || '/' },
      vibrate,
      requireInteraction: isUrgent,
      renotify: true,
      silent: false,
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) { existing.focus(); existing.navigate(url) }
      else self.clients.openWindow(url)
    })
  )
})
