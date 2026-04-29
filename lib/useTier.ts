'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { createClient } from './auth'

export type Tier = 'guest' | 'free' | 'pro' | 'business'

// Cache key + TTL.
//
// Diego flagged 2026-04-29 that the app "feels like a website not an
// app" because Pro state takes a beat to sync on every cold render.
// Root cause: useTier was firing a Supabase profiles SELECT on every
// mount across every page, AND setting loading=true while the network
// roundtrip happened — so even when localStorage had the right tier,
// consumers gating on `!loading` flashed free-tier UI for 200-800ms.
//
// Fix is stale-while-revalidate:
//   - Read cache + ts on init. If fresh (< TTL), render from cache,
//     loading=false IMMEDIATELY, NO network fetch. Most page navs hit
//     this path — zero Supabase reads, zero flash.
//   - If cache is stale OR missing, fetch from Supabase. loading is
//     only true when there's NO cached value to fall back on.
//   - On fetch success, write { tier, ts: now() }.
//
// Side benefit: cuts Supabase reads dramatically (was N reads per
// session per page; now 1 per 5 min per logged-in user).
const CACHE_KEY = 'cruzar_tier'
const CACHE_TS_KEY = 'cruzar_tier_ts'
const TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CachedTier {
  tier: Tier
  fresh: boolean
}

function readCache(): CachedTier {
  if (typeof window === 'undefined') return { tier: 'guest', fresh: false }
  try {
    const v = localStorage.getItem(CACHE_KEY)
    const tsRaw = localStorage.getItem(CACHE_TS_KEY)
    if (v === 'free' || v === 'pro' || v === 'business') {
      const ts = tsRaw ? Number(tsRaw) : 0
      const fresh = ts > 0 && Date.now() - ts < TTL_MS
      return { tier: v as Tier, fresh }
    }
  } catch { /* SSR or private browsing */ }
  return { tier: 'guest', fresh: false }
}

function writeCache(tier: Tier) {
  if (typeof window === 'undefined') return
  try {
    if (tier === 'guest') {
      localStorage.removeItem(CACHE_KEY)
      localStorage.removeItem(CACHE_TS_KEY)
    } else {
      localStorage.setItem(CACHE_KEY, tier)
      localStorage.setItem(CACHE_TS_KEY, String(Date.now()))
    }
  } catch { /* ignore */ }
}

export function useTier(): { tier: Tier; loading: boolean } {
  const { user, loading: authLoading } = useAuth()
  // Eager read from cache on init. If cache is fresh AND we're past
  // auth load, we won't network-fetch at all.
  const [tier, setTier] = useState<Tier>(() => readCache().tier)
  // loading defaults to TRUE only when we have no cached tier to fall
  // back on. With a fresh cache, components render the right tier
  // instantly without flashing free.
  const [loading, setLoading] = useState<boolean>(() => {
    const c = readCache()
    return !c.fresh
  })

  useEffect(() => {
    if (authLoading) return

    // Logged out → guest. Wipe cache + done.
    if (!user) {
      setTier('guest')
      writeCache('guest')
      setLoading(false)
      return
    }

    // If cache is fresh, skip the Supabase fetch entirely. This is the
    // common case — most page navs hit this and burn zero reads.
    const cached = readCache()
    if (cached.fresh) {
      setTier(cached.tier)
      setLoading(false)
      return
    }

    // Cache stale or missing — fetch from Supabase. Only show loading
    // if there's no cached value at all; if we have a stale cache, we
    // render that immediately and revalidate quietly in the background.
    if (cached.tier === 'guest') {
      setLoading(true)
    } else {
      setTier(cached.tier)
      setLoading(false)
    }

    const supabase = createClient()
    supabase
      .from('profiles')
      .select('tier, pro_via_pwa_until, promo_first_1000_until, pro_via_referral_until')
      .eq('id', user.id)
      .single()
      .then(async ({ data }) => {
        const dbTier = (data?.tier as Tier) || 'free'
        const now = Date.now()
        const pwaUntil = data?.pro_via_pwa_until ? new Date(data.pro_via_pwa_until).getTime() : 0
        const pwaExpired = pwaUntil > 0 && pwaUntil < now
        // First-1000 launch promo — 90 days of effective Pro for any user
        // in the earliest 1000 profiles. Column populated by v27 migration
        // (backfill) or by /api/promo/claim-first-1000 on new signups.
        // Live check against NOW so no downgrade cron needed.
        const promoUntil = data?.promo_first_1000_until ? new Date(data.promo_first_1000_until).getTime() : 0
        const promoActive = promoUntil > now

        // Referral-granted Pro — 30 days of Pro for inviting 3 friends.
        // Same pattern as promo: live check so no downgrade cron needed.
        const referralUntil = data?.pro_via_referral_until ? new Date(data.pro_via_referral_until).getTime() : 0
        const referralActive = referralUntil > now

        // If the PWA-granted Pro has expired but the DB still says Pro, the
        // row is stale. Call sync-tier — it's the idempotent source of truth
        // that reconciles with Stripe and keeps the user on Pro if they
        // actually have a paid sub, else downgrades to free.
        if (dbTier === 'pro' && pwaExpired && !promoActive && !referralActive) {
          try {
            const res = await fetch('/api/profile/sync-tier', { method: 'POST' })
            if (res.ok) {
              const { tier: syncedTier } = await res.json()
              const resolved = (syncedTier as Tier) || 'free'
              setTier(resolved)
              writeCache(resolved)
              setLoading(false)
              return
            }
          } catch { /* fall through to DB tier */ }
        }

        // If the user is still within the first-1000 launch window or
        // referral grant window, upgrade their effective tier to Pro
        // even when the DB row says 'free'. Business tier always wins.
        const anyPromoActive = promoActive || referralActive
        const effective: Tier = dbTier === 'business'
          ? 'business'
          : (anyPromoActive && dbTier !== 'pro')
            ? 'pro'
            : dbTier

        setTier(effective)
        writeCache(effective)
        setLoading(false)
      })
  }, [user, authLoading])

  return { tier, loading }
}

export function canAccess(tier: Tier, feature: string): boolean {
  const access: Record<string, Tier[]> = {
    save_crossings:   ['free', 'pro', 'business'],
    driver_reports:   ['free', 'pro', 'business'],
    alerts:           ['pro', 'business'],
    ai_predictions:   ['pro', 'business'],
    route_optimizer:  ['pro', 'business'],
    fleet_panel:      ['business'],
    data_export:      ['business'],
    api_access:       ['business'],
    no_ads:           ['free', 'pro', 'business'],
  }
  return access[feature]?.includes(tier) ?? false
}
