import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { checkRateLimit, keyFromRequest } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

// POST /api/intelligence/subscribe
// Body: { email: string }
//
// Public free signup for the daily Cruzar Intelligence brief.
// Anyone can subscribe; tier defaults to 'free'. Paid 'pro' tier
// (the $499/mo Cruzar Intelligence subscription) is upgraded by the
// Stripe webhook after checkout.

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(keyFromRequest(req), 10, 3)
  if (!rl.ok) return NextResponse.json({ error: 'Too many signups.' }, { status: 429 })

  let body: { email?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const email = (body.email || '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required.' }, { status: 400 })
  }

  // Best-effort attach to the authed user if there is one — gives
  // us a way to upgrade them to Pro later without re-collecting email.
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()

  const db = getServiceClient()
  const { error } = await db.from('intel_subscribers').upsert({
    email,
    user_id: user?.id ?? null,
    tier: 'free',
    active: true,
  }, { onConflict: 'email' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
