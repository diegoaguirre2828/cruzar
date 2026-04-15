'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { createClient } from './auth'

export type Tier = 'guest' | 'free' | 'pro' | 'business'

export function useTier(): { tier: Tier; loading: boolean } {
  const { user, loading: authLoading } = useAuth()
  const [tier, setTier] = useState<Tier>('guest')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setTier('guest')
      setLoading(false)
      return
    }

    const supabase = createClient()
    supabase
      .from('profiles')
      .select('tier, pro_via_pwa_until, promo_first_1000_until')
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

        // If the PWA-granted Pro has expired but the DB still says Pro, the
        // row is stale. Call sync-tier — it's the idempotent source of truth
        // that reconciles with Stripe and keeps the user on Pro if they
        // actually have a paid sub, else downgrades to free.
        if (dbTier === 'pro' && pwaExpired && !promoActive) {
          try {
            const res = await fetch('/api/profile/sync-tier', { method: 'POST' })
            if (res.ok) {
              const { tier: syncedTier } = await res.json()
              setTier((syncedTier as Tier) || 'free')
              setLoading(false)
              return
            }
          } catch { /* fall through to DB tier */ }
        }

        // If the user is still within the first-1000 launch window,
        // upgrade their effective tier to Pro even when the DB row
        // says 'free'. Business tier always wins over promo.
        const effective: Tier = dbTier === 'business'
          ? 'business'
          : (promoActive && dbTier !== 'pro')
            ? 'pro'
            : dbTier

        setTier(effective)
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
