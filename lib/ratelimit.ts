// Rate limiter shared across public POST endpoints.
//
// Two backends, picked at runtime:
//
// 1. **Upstash Redis** (preferred). When UPSTASH_REDIS_REST_URL +
//    UPSTASH_REDIS_REST_TOKEN are set in env, all rate-limit state
//    lives in a shared Redis namespace so caps hold across every
//    Vercel serverless instance. Sliding-window counters for hourly
//    + burst.
//
// 2. **In-memory Maps** (fallback). When Upstash isn't configured —
//    local dev, preview without env, brief outage — fall back to
//    per-instance Maps so the route still responds with the right
//    shape. Caps multiply by Vercel instance count under this
//    fallback (5-20× during burst), which is exactly the bug the
//    Upstash backend fixes.
//
// API is async (changed 2026-04-25) so the Upstash path can do its
// HTTP roundtrip; in-memory path resolves synchronously inside the
// returned Promise. checkHourly + checkBurst kept exported as sync
// in-memory helpers for callers that don't need Upstash semantics.

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const HOUR_MS = 60 * 60 * 1000
const BURST_WINDOW_MS = 5 * 60 * 1000
const BURST_MAX = 5

// ---------- Upstash backend ----------

let redis: Redis | null = null
function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

// Cache limiter instances per (scope, max) so we don't rebuild on
// every call. Upstash's Ratelimit objects are cheap but rebuilding is
// still wasteful.
const upstashCache = new Map<string, Ratelimit>()
function upstashLimiter(scope: 'hourly' | 'burst', max: number): Ratelimit | null {
  const r = getRedis()
  if (!r) return null
  const cacheKey = `${scope}:${max}`
  const cached = upstashCache.get(cacheKey)
  if (cached) return cached
  const limiter = new Ratelimit({
    redis: r,
    limiter: scope === 'hourly'
      ? Ratelimit.slidingWindow(max, '1 h')
      : Ratelimit.slidingWindow(max, '5 m'),
    prefix: `cruzar:rl:${scope}`,
    analytics: false,
  })
  upstashCache.set(cacheKey, limiter)
  return limiter
}

// ---------- In-memory fallback ----------

type HourlyEntry = { count: number; resetAt: number }
type BurstEntry = number[]

const hourlyCounts = new Map<string, HourlyEntry>()
const burstTracker = new Map<string, BurstEntry>()

/**
 * Sync in-memory hourly check. Used by the async wrapper as a
 * fallback when Upstash isn't configured. Returns true if allowed.
 */
export function checkHourly(key: string, max: number): boolean {
  const now = Date.now()
  const entry = hourlyCounts.get(key)
  if (!entry || now > entry.resetAt) {
    hourlyCounts.set(key, { count: 1, resetAt: now + HOUR_MS })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}

/**
 * Sync in-memory burst check. Used by the async wrapper as a
 * fallback when Upstash isn't configured. Returns true if allowed.
 */
export function checkBurst(key: string, max: number = BURST_MAX): boolean {
  const now = Date.now()
  const stamps = (burstTracker.get(key) || []).filter((t) => t > now - BURST_WINDOW_MS)
  if (stamps.length >= max) return false
  stamps.push(now)
  burstTracker.set(key, stamps)
  return true
}

// ---------- Public API ----------

/**
 * Extract a stable rate-limit key from a request. Prefers a user id,
 * otherwise the first x-forwarded-for IP, otherwise 'unknown' so
 * every unknown-IP caller at least shares a slot.
 */
export function keyFromRequest(req: Request, userId?: string | null): string {
  if (userId) return `u:${userId}`
  const fwd = req.headers.get('x-forwarded-for')
  const ip = fwd ? fwd.split(',')[0].trim() : null
  return `ip:${ip || 'unknown'}`
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; reason: 'hourly' | 'burst'; retryAfterSeconds: number }

/**
 * Combined hourly + burst check. Async — Upstash is HTTP. Falls back
 * to in-memory Maps when Upstash env vars aren't set so local dev +
 * preview stay functional.
 */
export async function checkRateLimit(
  key: string,
  hourlyMax: number,
  burstMax: number = BURST_MAX,
): Promise<RateLimitResult> {
  const hourlyLimiter = upstashLimiter('hourly', hourlyMax)
  const burstLimiter = upstashLimiter('burst', burstMax)

  if (hourlyLimiter && burstLimiter) {
    const hourly = await hourlyLimiter.limit(key)
    if (!hourly.success) {
      const retryAfterSeconds = Math.max(1, Math.ceil((hourly.reset - Date.now()) / 1000))
      return { ok: false, reason: 'hourly', retryAfterSeconds }
    }
    const burst = await burstLimiter.limit(key)
    if (!burst.success) {
      const retryAfterSeconds = Math.max(1, Math.ceil((burst.reset - Date.now()) / 1000))
      return { ok: false, reason: 'burst', retryAfterSeconds }
    }
    return { ok: true }
  }

  // In-memory fallback
  if (!checkHourly(key, hourlyMax)) {
    const entry = hourlyCounts.get(key)
    const retryAfterSeconds = entry ? Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000)) : 3600
    return { ok: false, reason: 'hourly', retryAfterSeconds }
  }
  if (!checkBurst(key, burstMax)) {
    return { ok: false, reason: 'burst', retryAfterSeconds: Math.ceil(BURST_WINDOW_MS / 1000) }
  }
  return { ok: true }
}
