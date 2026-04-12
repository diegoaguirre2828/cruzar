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
      const envName = tier === 'pro' ? 'STRIPE_PRO_PRICE_ID' : 'STRIPE_BUSINESS_PRICE_ID'
      return NextResponse.json(
        { error: `Payments not configured: ${envName} is missing on the server.` },
        { status: 500 }
      )
    }

    const stripe = getStripe()
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://cruzar.app'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?upgraded=true`,
      cancel_url: `${origin}/pricing`,
      metadata: { userId: user.id, tier },
      subscription_data: {
        trial_period_days: tier === 'business' ? 14 : 7,
        metadata: { userId: user.id, tier },
      },
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
