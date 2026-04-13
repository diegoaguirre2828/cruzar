import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { getStripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

// Reconcile the DB tier with Stripe's actual subscription state.
//
// Why this exists: the Stripe webhook is asynchronous and can fail for any
// number of reasons (signing secret mismatch, network blip, Stripe outage,
// endpoint misconfig, event replay lag). When it does, the user's
// profiles.tier in the DB drifts out of sync with what Stripe thinks —
// they paid, but the app still shows "Free Plan". That's a trust-breaking
// bug. This endpoint is the self-healing path: every time the dashboard
// loads, it calls this to pull ground truth from Stripe and correct the
// DB if needed.
//
// Flow:
//   1. Authenticate the user via Supabase cookie.
//   2. Find their Stripe customer — first by stored stripe_customer_id on
//      the subscriptions table, falling back to email lookup.
//   3. List their Stripe subscriptions. If any is in ('active', 'trialing'),
//      map the price_id back to our tier ('pro' or 'business').
//   4. If the DB tier doesn't match Stripe reality, update profiles.tier
//      and upsert the subscriptions row.
//   5. Return the corrected tier + a summary of what was done.
export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const db = getServiceClient()

  // Current DB state + PWA grant check
  const { data: profile } = await db
    .from('profiles')
    .select('tier, pro_via_pwa_until')
    .eq('id', user.id)
    .single()
  const dbTier = profile?.tier || 'free'

  // If the user has an active PWA-grant Pro, they keep Pro even if they
  // have no Stripe subscription. The sync logic below will NOT downgrade
  // them for the duration of the grant.
  const pwaGrantActive =
    profile?.pro_via_pwa_until && new Date(profile.pro_via_pwa_until).getTime() > Date.now()

  const { data: existingSub } = await db
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const stripe = getStripe()

  // Resolve Stripe customer: prefer stored ID, fall back to email lookup
  let customerId: string | null = existingSub?.stripe_customer_id || null
  if (!customerId && user.email) {
    try {
      const list = await stripe.customers.list({ email: user.email, limit: 3 })
      customerId = list.data[0]?.id || null
    } catch (err) {
      console.error('sync-tier: customer lookup failed', err)
    }
  }

  if (!customerId) {
    // No Stripe customer — but if the user has an active PWA grant, they
    // stay on Pro for the duration of the grant. Otherwise, downgrade.
    if (pwaGrantActive) {
      if (dbTier === 'free' || dbTier === 'guest') {
        await db.from('profiles').update({ tier: 'pro' }).eq('id', user.id)
      }
      return NextResponse.json({
        ok: true,
        tier: 'pro',
        source: 'pwa-grant',
        pro_via_pwa_until: profile?.pro_via_pwa_until,
        changed: dbTier !== 'pro',
      })
    }
    if (dbTier !== 'free') {
      await db.from('profiles').update({ tier: 'free' }).eq('id', user.id)
    }
    return NextResponse.json({
      ok: true,
      tier: 'free',
      source: 'no-stripe-customer',
      changed: dbTier !== 'free',
    })
  }

  // List subscriptions — include past_due/cancelled so we can accurately
  // downgrade if the user churned
  let subs: Awaited<ReturnType<typeof stripe.subscriptions.list>>['data']
  try {
    const res = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    })
    subs = res.data
  } catch (err) {
    console.error('sync-tier: subscription list failed', err)
    return NextResponse.json({ error: 'Stripe list failed', detail: String(err) }, { status: 500 })
  }

  // Find the first active or trialing sub — that's ground truth
  const activeSub = subs.find((s) => s.status === 'active' || s.status === 'trialing')

  let trueTier: 'free' | 'pro' | 'business' = 'free'
  let activePriceId: string | null = null
  let activeStatus: string | null = null
  let periodEnd: number | null = null

  if (activeSub) {
    activeStatus = activeSub.status
    // Tier is whichever price they're paying for — compare against env vars
    const priceId = activeSub.items.data[0]?.price?.id
    activePriceId = priceId || null
    const proPriceId = process.env.STRIPE_PRO_PRICE_ID?.trim()
    const bizPriceId = process.env.STRIPE_BUSINESS_PRICE_ID?.trim()
    if (priceId === proPriceId) trueTier = 'pro'
    else if (priceId === bizPriceId) trueTier = 'business'
    else trueTier = 'pro' // unknown price → safest default is pro not free
    periodEnd = (activeSub as unknown as { current_period_end?: number }).current_period_end || null
  }

  // If PWA grant is still active and Stripe says free, don't downgrade —
  // keep them on Pro until the grant expires.
  const finalTier =
    trueTier === 'free' && pwaGrantActive ? 'pro' : trueTier

  const changed = finalTier !== dbTier

  if (changed) {
    // Update profiles.tier to match Stripe reality (or PWA grant)
    await db.from('profiles').update({ tier: finalTier }).eq('id', user.id)
  }

  // Always upsert subscriptions row so it reflects current Stripe state
  if (activeSub) {
    await db.from('subscriptions').upsert(
      {
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: activeSub.id,
        tier: trueTier,
        status: activeStatus || 'active',
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
  }

  return NextResponse.json({
    ok: true,
    tier: trueTier,
    source: 'stripe-live',
    changed,
    dbTier,
    stripeTier: trueTier,
    activeStatus,
    activePriceId,
    customerId,
  })
}
