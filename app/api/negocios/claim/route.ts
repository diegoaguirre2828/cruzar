import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { keyFromRequest, checkRateLimit } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { business_id, email, whatsapp } = body

  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 })
  if (!email?.trim() && !whatsapp?.trim()) {
    return NextResponse.json({ error: 'email or whatsapp required' }, { status: 400 })
  }

  // Rate limit — previously unguarded. An attacker could mass-flag
  // every business as claim_pending and flood Diego's moderation
  // queue. Hourly cap 10, burst 3.
  const rl = checkRateLimit(keyFromRequest(req), 10, 3)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many claim requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  const db = getServiceClient()

  // Check business exists
  const { data: biz } = await db
    .from('rewards_businesses')
    .select('id, claimed')
    .eq('id', business_id)
    .single()

  if (!biz) return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  if (biz.claimed) return NextResponse.json({ error: 'Already claimed' }, { status: 409 })

  // Mark as claim_pending — admin must approve, not auto-claim
  const updates: Record<string, unknown> = { claim_pending: true }
  if (email?.trim()) updates.submitted_by_email = email.trim()
  if (whatsapp?.trim()) updates.whatsapp = whatsapp.trim()

  const { error } = await db
    .from('rewards_businesses')
    .update(updates)
    .eq('id', business_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, message: 'Claim request submitted — we will verify and contact you within 24 hours.' })
}
