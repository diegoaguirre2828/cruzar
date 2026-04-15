import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

// POST /api/promo/claim-first-1000
// Claims the "first 1000 signups get 3 months of Pro free" launch promo
// for the authenticated user. Called from /signup or /welcome flow.
//
// Idempotent — if the user already has promo_first_1000_until set, no-op.
// Cap-enforcing — if 1000 users already have the promo, refuses to grant.
// Uses the service role so the count check bypasses RLS.
//
// Response:
//   { claimed: true, expiresAt: ISO } on success
//   { claimed: false, reason: 'already' | 'cap_reached' | 'unauth' } otherwise

const CAP = 1000
const DURATION_DAYS = 90

export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ claimed: false, reason: 'unauth' }, { status: 401 })
  }

  const db = getServiceClient()

  // Already claimed? Return current expiry without touching anything.
  const { data: existing } = await db
    .from('profiles')
    .select('promo_first_1000_until')
    .eq('id', user.id)
    .single()
  if (existing?.promo_first_1000_until) {
    return NextResponse.json({
      claimed: true,
      expiresAt: existing.promo_first_1000_until,
      reason: 'already',
    })
  }

  // Count current claimants. The check-then-update is not atomic, but the
  // race window is seconds and the worst case is a few extra users over
  // the 1000 cap — acceptable for a launch promo.
  const { count } = await db
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .not('promo_first_1000_until', 'is', null)

  if ((count ?? 0) >= CAP) {
    return NextResponse.json({ claimed: false, reason: 'cap_reached' })
  }

  const expiresAt = new Date(Date.now() + DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await db
    .from('profiles')
    .update({ promo_first_1000_until: expiresAt })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ claimed: false, reason: 'write_failed', error: error.message }, { status: 500 })
  }

  return NextResponse.json({ claimed: true, expiresAt })
}
