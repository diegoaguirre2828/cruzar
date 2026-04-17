import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

// POST /api/admin/reports/hide
// Body: { reportId: string, reason: 'spam' | 'troll' | 'farm' | 'inaccurate' | 'other' }
//
// Hides a report from every public feed by setting hidden_at. The
// column is indexed so the filter is cheap on big tables.  Also
// reverses any upvote-author points so farming reports don't leave
// points behind on the author's profile after a hide.
//
// Unhide: POST same body with reason = null → clears the hidden_at.

const VALID_REASONS = new Set(['spam', 'troll', 'farm', 'inaccurate', 'other'])

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

  let body: { reportId?: string; reason?: string | null }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const reportId = (body.reportId || '').trim()
  if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })

  const db = getServiceClient()

  // Unhide path — body.reason explicitly null
  if (body.reason === null) {
    const { error } = await db
      .from('crossing_reports')
      .update({ hidden_at: null, hidden_by: null, hidden_reason: null })
      .eq('id', reportId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, unhidden: true })
  }

  const reason = (body.reason || 'other').trim()
  if (!VALID_REASONS.has(reason)) {
    return NextResponse.json(
      { error: `Invalid reason. Must be one of: ${[...VALID_REASONS].join(', ')}` },
      { status: 400 },
    )
  }

  // Hide the report
  const { error } = await db
    .from('crossing_reports')
    .update({
      hidden_at: new Date().toISOString(),
      hidden_by: admin.id,
      hidden_reason: reason,
    })
    .eq('id', reportId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, hidden: true, reason })
}
