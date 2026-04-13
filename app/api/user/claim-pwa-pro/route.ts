import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// PWA install → 3 months free Pro
//
// Called by the client when it detects the user has installed the app
// (either via the appinstalled event or when display-mode:standalone
// matches on subsequent loads). The server verifies the user is authed
// and grants Pro tier for 90 days, stored in profiles.pro_via_pwa_until.
//
// Safe to call multiple times — idempotent. If the user already has a
// longer grant, we don't shorten it. If they already have a paid Pro
// subscription from Stripe, we leave that alone and still track the
// install date for analytics.

const PWA_PRO_DAYS = 90

export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()

  // Read current state
  const { data: profile } = await db
    .from('profiles')
    .select('tier, pro_via_pwa_until, pwa_installed_at')
    .eq('id', user.id)
    .single()

  const now = new Date()
  const grantExpiresAt = new Date(now.getTime() + PWA_PRO_DAYS * 24 * 60 * 60 * 1000)

  // Existing grant — don't shorten, only extend
  const existingExpiry = profile?.pro_via_pwa_until ? new Date(profile.pro_via_pwa_until) : null
  const newExpiry = existingExpiry && existingExpiry.getTime() > grantExpiresAt.getTime()
    ? existingExpiry
    : grantExpiresAt

  // If they're already a paid Pro/Business user, don't downgrade their tier
  // — just record the install date. The PWA grant is only meaningful for
  // users who'd otherwise be on free tier.
  const currentTier = profile?.tier || 'free'
  const willUpgradeTier = currentTier === 'free' || currentTier === 'guest'

  const updates: Record<string, unknown> = {
    pro_via_pwa_until: newExpiry.toISOString(),
    pwa_installed_at: profile?.pwa_installed_at || now.toISOString(),
  }
  if (willUpgradeTier) updates.tier = 'pro'

  const { error } = await db.from('profiles').update(updates).eq('id', user.id)
  if (error) {
    console.error('claim-pwa-pro: update failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    granted: willUpgradeTier,
    tier: willUpgradeTier ? 'pro' : currentTier,
    pro_via_pwa_until: newExpiry.toISOString(),
    days: PWA_PRO_DAYS,
    is_new_install: !profile?.pwa_installed_at,
  })
}
