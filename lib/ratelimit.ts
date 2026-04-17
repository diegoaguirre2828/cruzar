// Lightweight in-memory rate limiter shared across public POST
// endpoints. Matches the pattern used inline by /api/reports POST
// (hourly cap + 5-min burst) but factored out so every new public
// endpoint doesn't have to re-implement it and risk divergence.
//
// Vercel caveat: serverless instances can scale out, so the Maps
// below are per-instance. Under real traffic one attacker might hit
// N instances and effectively get Nx the limit. For Cruzar's scale
// this is acceptable — an attacker would still be capped to a
// manageable multiple, and the DB inserts + Resend calls downstream
// are the real cost we want to bound. Upgrade to Upstash Redis when
// traffic warrants.

type HourlyEntry = { count: number; resetAt: number }
type BurstEntry = number[]

const hourlyCounts = new Map<string, HourlyEntry>()
const burstTracker = new Map<string, BurstEntry>()

const HOUR_MS = 60 * 60 * 1000
const BURST_WINDOW_MS = 5 * 60 * 1000
const BURST_MAX = 5

/**
 * Extract a stable rate-limit key from a request.
 * Prefers a user id when the caller can provide it, otherwise the
 * first x-forwarded-for IP, otherwise 'unknown' so every unknown-IP
 * caller at least shares a slot.
 */
export function keyFromRequest(req: Request, userId?: string | null): string {
  if (userId) return `u:${userId}`
  const fwd = req.headers.get('x-forwarded-for')
  const ip = fwd ? fwd.split(',')[0].trim() : null
  return `ip:${ip || 'unknown'}`
}

/**
 * Check + register an hourly-cap hit. Returns `true` if the caller
 * is ALLOWED (under cap), `false` if they should be rate-limited.
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
 * Check + register a burst-window hit. Returns `true` if allowed,
 * `false` if the caller exceeded BURST_MAX within BURST_WINDOW_MS.
 */
export function checkBurst(key: string, max: number = BURST_MAX): boolean {
  const now = Date.now()
  const stamps = (burstTracker.get(key) || []).filter((t) => t > now - BURST_WINDOW_MS)
  if (stamps.length >= max) return false
  stamps.push(now)
  burstTracker.set(key, stamps)
  return true
}

/**
 * Combined check — returns a typed result object so handlers can
 * render a consistent 429 message.
 */
export function checkRateLimit(
  key: string,
  hourlyMax: number,
  burstMax: number = BURST_MAX,
): { ok: true } | { ok: false; reason: 'hourly' | 'burst'; retryAfterSeconds: number } {
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
