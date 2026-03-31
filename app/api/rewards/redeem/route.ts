import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to redeem rewards' }, { status: 401 })

  const { dealId } = await req.json()
  if (!dealId) return NextResponse.json({ error: 'dealId required' }, { status: 400 })

  const db = getServiceClient()

  // Check already redeemed
  const { data: existing } = await db
    .from('rewards_redemptions')
    .select('id')
    .eq('user_id', user.id)
    .eq('deal_id', dealId)
    .single()

  if (existing) return NextResponse.json({ error: 'Already redeemed', alreadyRedeemed: true }, { status: 400 })

  // Get deal
  const { data: deal } = await db
    .from('rewards_deals')
    .select('*, rewards_businesses(name)')
    .eq('id', dealId)
    .eq('active', true)
    .single()

  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  // Check max redemptions
  if (deal.max_redemptions && deal.redemptions_count >= deal.max_redemptions) {
    return NextResponse.json({ error: 'Deal is fully redeemed' }, { status: 400 })
  }

  // Check user has enough points
  const { data: profile } = await db
    .from('profiles')
    .select('points')
    .eq('id', user.id)
    .single()

  const currentPoints = profile?.points || 0
  if (currentPoints < deal.points_required) {
    return NextResponse.json({
      error: `Not enough points. You have ${currentPoints}, need ${deal.points_required}.`,
      currentPoints,
      required: deal.points_required,
    }, { status: 400 })
  }

  // Deduct points + record redemption
  await Promise.all([
    db.from('profiles').update({ points: currentPoints - deal.points_required }).eq('id', user.id),
    db.from('rewards_redemptions').insert({ user_id: user.id, deal_id: dealId, points_spent: deal.points_required }),
    db.from('rewards_deals').update({ redemptions_count: (deal.redemptions_count || 0) + 1 }).eq('id', dealId),
  ])

  return NextResponse.json({
    success: true,
    dealCode: deal.deal_code || `CRUZA-${dealId.slice(0, 6).toUpperCase()}`,
    pointsSpent: deal.points_required,
    remainingPoints: currentPoints - deal.points_required,
  })
}
