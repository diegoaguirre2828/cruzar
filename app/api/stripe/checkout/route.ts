import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getStripe, PLANS } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized — sign in first' }, { status: 401 })

    const { tier } = await req.json()
    const plan = PLANS[tier as keyof typeof PLANS]
    if (!plan) return NextResponse.json({ error: `Invalid plan: ${tier}` }, { status: 400 })

    // Env sanity — surfaces exact missing var instead of silently 500ing
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Payments not configured: STRIPE_SECRET_KEY is missing on the server.' },
        { status: 500 }
      )
    }
    if (!plan.priceId) {
      const envByTier: Record<string, string> = {
        pro: 'STRIPE_PRO_PRICE_ID',
        business: 'STRIPE_BUSINESS_PRICE_ID',
        operator: 'STRIPE_OPERATOR_PRICE_ID',
        express_cert: 'STRIPE_EXPRESS_CERT_PRICE_ID',
        intelligence: 'STRIPE_INTELLIGENCE_PRICE_ID',
        intelligence_enterprise: 'STRIPE_INTELLIGENCE_ENTERPRISE_PRICE_ID',
      }
      return NextResponse.json(
        { error: `Payments not configured: ${envByTier[tier] || 'price ID'} is missing on the server.` },
        { status: 500 }
      )
    }

    const stripe = getStripe()
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://cruzar.app'

    const isOneTime = plan.mode === 'payment'
    const session = await stripe.checkout.sessions.create({
      mode: plan.mode,
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?upgraded=${tier}`,
      cancel_url: `${origin}/pricing`,
      metadata: { userId: user.id, tier },
      ...(isOneTime ? {} : {
        subscription_data: {
          // 14-day trial for B2B tiers (Operator, Business, Intelligence,
          // Intelligence Enterprise) — gives them a real billing cycle's
          // worth of value before charging. 7 days for the consumer Pro
          // tier which converts faster on alert-driven moments.
          trial_period_days:
            tier === 'business' || tier === 'operator' || tier === 'intelligence' || tier === 'intelligence_enterprise'
              ? 14
              : 7,
          metadata: { userId: user.id, tier },
        },
      }),
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe returned no checkout URL' }, { status: 502 })
    }

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    // Stripe errors carry .message — surface them to the client so we can diagnose
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: `Stripe error: ${msg}` }, { status: 500 })
  }
}
