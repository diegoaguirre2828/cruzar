// Cruzar Service Worker — Push Notifications + Offline Shell

const CACHE = 'cruzar-v2'
const SHELL = ['/', '/offline']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {}))
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Network-first for API routes, cache-first for static assets
self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // Skip non-GET and cross-origin
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // API routes — always network, no cache
  if (url.pathname.startsWith('/api/')) return

  // Everything else — try network, fall back to cache
  e.respondWith(
    fetch(request)
      .then(res => {
        // Cache successful page responses
        if (res.ok && (request.destination === 'document' || request.destination === 'image')) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(request, clone))
        }
        return res
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        // Offline fallback for navigation requests
        if (request.destination === 'document') {
          return caches.match('/') || new Response('Offline', { status: 503 })
        }
      })
  )
})

self.addEventListener('push', e => {
  if (!e.data) return
  const data = e.data.json()
  e.waitUntil(
    self.registration.showNotification(data.title || 'Cruzar Alert', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'cruzar-alert',
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
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
