import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

// POST /api/admin/users/ban
// Body: { userId: string, days: number, reason: 'spam' | 'farm' | 'abuse' | 'other' }
//
// Sets banned_until = now + N days. /api/reports POST rejects users
// whose banned_until > now. Pass days = 0 to unban immediately.
// Pass days < 0 → rejected (no permanent bans via this route; use
// 365 or similar for practical lifetime).

const VALID_BAN_REASONS = new Set(['spam', 'farm', 'abuse', 'other'])

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { userId?: string; days?: number; reason?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const userId = (body.userId || '').trim()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const days = typeof body.days === 'number' ? body.days : NaN
  if (!Number.isFinite(days) || days < 0) {
    return NextResponse.json({ error: 'days must be a non-negative number (0 = unban)' }, { status: 400 })
  }

  const db = getServiceClient()

  // Self-ban guard — admin can't ban themselves by accident
  if (userId === admin.id) {
    return NextResponse.json({ error: 'Cannot ban yourself.' }, { status: 400 })
  }

  // Unban path — days === 0
  if (days === 0) {
    const { error } = await db
      .from('profiles')
      .update({ banned_until: null, ban_reason: null })
      .eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, unbanned: true })
  }

  const reason = (body.reason || 'other').trim()
  if (!VALID_BAN_REASONS.has(reason)) {
    return NextResponse.json(
      { error: `Invalid reason. Must be one of: ${[...VALID_BAN_REASONS].join(', ')}` },
      { status: 400 },
    )
  }

  const bannedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await db
    .from('profiles')
    .update({ banned_until: bannedUntil, ban_reason: reason })
    .eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, banned_until: bannedUntil, reason })
}
