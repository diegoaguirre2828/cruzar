import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getStripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stripe = getStripe()

  const [subsResult, chargesResult] = await Promise.all([
    stripe.subscriptions.list({ status: 'active', limit: 100, expand: ['data.items.data.price'] }),
    stripe.charges.list({ limit: 10 }),
  ])

  let mrr = 0
  let proCount = 0
  let businessCount = 0

  for (const sub of subsResult.data) {
    for (const item of sub.items.data) {
      const amount = item.price.unit_amount ?? 0
      const interval = item.price.recurring?.interval
      const monthly = interval === 'year' ? Math.round(amount / 12) : amount
      mrr += monthly
      if (monthly <= 500) proCount++
      else businessCount++
    }
  }

  const recentCharges = chargesResult.data
    .filter(c => c.paid)
    .map(c => ({
      id: c.id,
      amount: c.amount,
      email: c.billing_details?.email ?? '',
      created: c.created,
      description: c.description ?? '',
    }))

  return NextResponse.json({
    mrr,
    activeSubscriptions: subsResult.data.length,
    proCount,
    businessCount,
    recentCharges,
  })
}
