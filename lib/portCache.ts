// Belt-and-suspenders localStorage cache for the last successful
// /api/ports response. The service worker already does SWR caching,
// but that cache can be wiped by browser quota eviction or cleared
// by the user, and it doesn't help if the very first request a
// user makes is over a dead connection.
//
// This layer: every successful port fetch stashes the raw port
// array + timestamp in localStorage. On next mount, any consumer
// can hydrate instantly from this cache, then refresh in the
// background. Worst case the user sees a few-hour-old numbers
// labeled as stale — infinitely better than a broken page.

import type { PortWaitTime } from '@/types'

const KEY = 'cruzar_ports_cache_v1'
const MAX_AGE_MS = 6 * 60 * 60 * 1000 // 6 hours — beyond this we don't trust the cache

interface CachedPorts {
  ports: PortWaitTime[]
  savedAt: number
}

export function saveCachedPorts(ports: PortWaitTime[]): void {
  if (typeof window === 'undefined') return
  try {
    const payload: CachedPorts = { ports, savedAt: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(payload))
  } catch { /* quota or private mode — silent */ }
}

export function loadCachedPorts(): { ports: PortWaitTime[]; ageMin: number } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedPorts
    if (!parsed.savedAt || !Array.isArray(parsed.ports)) return null
    const age = Date.now() - parsed.savedAt
    if (age > MAX_AGE_MS) return null // too stale to trust
    return { ports: parsed.ports, ageMin: Math.floor(age / 60000) }
  } catch {
    return null
  }
}
