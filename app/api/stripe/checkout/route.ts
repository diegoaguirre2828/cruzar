import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getStripe, PLANS } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tier } = await req.json()
  const plan = PLANS[tier as keyof typeof PLANS]
  if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const stripe = getStripe()
  const origin = req.headers.get('origin') || 'https://cruzaapp.vercel.app'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: user.email,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: `${origin}/dashboard?upgraded=true`,
    cancel_url: `${origin}/pricing`,
    metadata: { userId: user.id, tier },
    subscription_data: {
      trial_period_days: 7,
      metadata: { userId: user.id, tier },
    },
  })

  return NextResponse.json({ url: session.url })
}
