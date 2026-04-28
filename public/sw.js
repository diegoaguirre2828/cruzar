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

const CACHE = 'cruzar-v8'
const API_CACHE = 'cruzar-api-v8'
// Intentionally NOT precaching '/' — the cached HTML shell from an old deploy
// references Next.js chunk hashes that get deleted on every deploy. Serving
// that stale shell on a slow-network fallback caused soft-navigations between
// /live, /insights, /memory to fail with "Loading chunk failed" until the user
// hard-reloaded. Network-first with empty cache is correct here; the chunk
// hashes always match what the server is currently serving.
const SHELL = []

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

  // CRITICAL: never intercept Next.js internals — chunks, RSC payloads,
  // image-optimization, prefetch data. These are content-hashed by Next on
  // every deploy; intercepting them risks serving stale references that
  // 404 against the current deploy. Symptom: soft-nav between /live,
  // /insights, /memory looks "down" until user hard-reloads.
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/__nextjs') ||
    url.search.includes('_rsc=')
  ) {
    return
  }

  // SWR for the two public APIs the homepage depends on.
  if (url.pathname.startsWith('/api/')) {
    if (isSwrPath(url.pathname)) {
      e.respondWith(staleWhileRevalidate(request))
    }
    // Other /api/* routes: let the network handle them normally.
    return
  }

  // Page navigations (documents) → network-first with 3s timeout,
  // cache fallback. Cache-first (the previous strategy) was making
  // "Something broke" fire frequently because a cached HTML shell
  // from an older deploy references Next.js chunk hashes that no
  // longer exist — new deploy deletes those chunks, browser 404s
  // on <script src="/_next/static/chunks/page-abc123.js">, React
  // throws ChunkLoadError, root error.tsx catches it.
  //
  // Network-first with a tight timeout keeps PWA launches fast on
  // spotty border cell (we hand back the cached shell after 3s)
  // while guaranteeing users on any connection get the current
  // HTML + current chunk hashes.
  if (request.destination === 'document') {
    e.respondWith(
      (async () => {
        const cache = await caches.open(CACHE)
        let networkSettled = false
        const networkPromise = fetch(request)
          .then(res => {
            networkSettled = true
            if (res && res.ok) {
              cache.put(request, res.clone()).catch(() => {})
            }
            return res
          })
          .catch(() => {
            networkSettled = true
            return null
          })

        // 1.5s — tight enough that spotty border cell doesn't stall PWA
        // launches, slack enough for a decent handshake on working LTE.
        // Was 3s; users still saw "the app is slow" on cold launches.
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, 1500))
        await Promise.race([networkPromise, timeoutPromise])

        if (networkSettled) {
          const res = await networkPromise
          if (res) return res
        }

        // Network slow or unreachable — fall back to cached shell
        // so the user sees the app instead of a browser error. The
        // cached shell may reference stale chunks; ChunkErrorReload
        // on the client will catch + recover if that happens.
        const cached = await cache.match(request) || await cache.match('/')
        if (cached) return cached

        // Still nothing — wait out the network fully as a last resort.
        const res = await networkPromise
        return res || new Response('Offline', { status: 503 })
      })()
    )
    return
  }

  // Static assets (images, scripts, styles) → network-first, cache
  // fallback. Unchanged from the previous strategy because these are
  // hashed by Next.js and rarely change, so the cache hit rate is
  // high and the network failure path is fast (asset 404 errors
  // immediately, unlike hung document fetches).
  e.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok && request.destination === 'image') {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(request, clone)).catch(() => {})
        }
        return res
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
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
      data: { url: data.url || '/', tag: data.tag || 'cruzar-alert' },
      vibrate,
      requireInteraction: isUrgent,
      renotify: true,
      silent: false,
      actions: Array.isArray(data.actions) ? data.actions : undefined,
    })
  )
})

self.addEventListener('notificationclick', e => {
  const action = e.action
  const url = e.notification.data?.url || '/'
  const tag = e.notification.data?.tag || ''

  e.notification.close()

  // Snooze: fire-and-forget POST that bumps the alert's last_triggered_at
  // forward by 1 hour so the send-alerts cron skips this user for that
  // window. Server pulls the alert id from the tag (urgent-alert-<portId>).
  if (action === 'snooze') {
    const portId = tag.startsWith('urgent-alert-') ? tag.slice('urgent-alert-'.length) : null
    if (portId) {
      e.waitUntil(
        fetch('/api/alerts/snooze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ port_id: portId, minutes: 60 }),
          keepalive: true,
        }).catch(() => {})
      )
    }
    return
  }

  // Default action (tap) or explicit "view" action: open/focus the app.
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) { existing.focus(); existing.navigate(url) }
      else self.clients.openWindow(url)
    })
  )
})
