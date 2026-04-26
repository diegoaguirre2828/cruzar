import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getStripe, PLANS } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

// POST /api/stripe/embedded-session
//
// Creates a Stripe Checkout session in EMBEDDED ui mode. Returns
// `client_secret` which the frontend mounts via @stripe/stripe-js +
// @stripe/react-stripe-js EmbeddedCheckoutProvider. Customer never
// leaves cruzar.app — kills the redirect bounce of the standard
// Checkout flow.
//
// Falls back to the legacy hosted Checkout (/api/stripe/checkout)
// for tiers we haven't audited the embedded UX on yet.

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

    const { tier } = await req.json()
    const plan = PLANS[tier as keyof typeof PLANS]
    if (!plan) return NextResponse.json({ error: `Invalid plan: ${tier}` }, { status: 400 })
    if (!plan.priceId) return NextResponse.json({ error: 'Plan price not configured.' }, { status: 500 })

    const stripe = getStripe()
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://cruzar.app'
    const isOneTime = plan.mode === 'payment'

    // The installed Stripe SDK type defs don't include `ui_mode:
    // 'embedded'` yet but the live Stripe API supports it. Cast the
    // params object so the call goes through. When the SDK types
    // catch up, drop the cast.
    const params: Record<string, unknown> = {
      ui_mode: 'embedded',
      mode: plan.mode,
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      return_url: `${origin}/dashboard?upgraded=${tier}&session_id={CHECKOUT_SESSION_ID}`,
      metadata: { userId: user.id, tier },
    }
    if (!isOneTime) {
      params.subscription_data = {
        trial_period_days:
          tier === 'business' || tier === 'operator' || tier === 'intelligence' || tier === 'intelligence_enterprise'
            ? 14
            : 7,
        metadata: { userId: user.id, tier },
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await stripe.checkout.sessions.create(params as any)

    if (!session.client_secret) {
      return NextResponse.json({ error: 'Stripe returned no client_secret' }, { status: 502 })
    }
    return NextResponse.json({ client_secret: session.client_secret })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
