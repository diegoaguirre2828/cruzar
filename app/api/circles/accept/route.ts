import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// POST /api/circles/accept — accept a circle invite by token
// Body: { token: string }
// The authenticated user becomes a member of the circle.
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { token?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const token = (body.token || '').trim()
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const db = getServiceClient()

  // Look up the invite
  const { data: invite } = await db
    .from('circle_invites')
    .select('circle_id, accepted_at')
    .eq('token', token)
    .maybeSingle()
  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (invite.accepted_at) {
    // Already accepted — check if by THIS user (idempotent)
    const { data: existing } = await db
      .from('circle_members')
      .select('id')
      .eq('circle_id', invite.circle_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (existing) return NextResponse.json({ ok: true, circle_id: invite.circle_id, already_member: true })
    return NextResponse.json({ error: 'Invite already used' }, { status: 409 })
  }

  // Verify circle still exists
  const { data: circle } = await db
    .from('circles')
    .select('id, name')
    .eq('id', invite.circle_id)
    .maybeSingle()
  if (!circle) return NextResponse.json({ error: 'Circle no longer exists' }, { status: 404 })

  // Check if already a member (edge case — re-accepting after leaving)
  const { data: existingMember } = await db
    .from('circle_members')
    .select('id')
    .eq('circle_id', invite.circle_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!existingMember) {
    // Cap at 12 members per circle (same as Life360 circles)
    const { count: memberCount } = await db
      .from('circle_members')
      .select('id', { count: 'exact', head: true })
      .eq('circle_id', invite.circle_id)
    if ((memberCount || 0) >= 12) {
      return NextResponse.json({ error: 'Circle is full (max 12 members)' }, { status: 400 })
    }

    const { error: insertError } = await db.from('circle_members').insert({
      circle_id: invite.circle_id,
      user_id: user.id,
      role: 'member',
    })
    if (insertError) {
      console.error('circle_members insert error', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  // Mark invite as accepted
  await db
    .from('circle_invites')
    .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq('token', token)

  return NextResponse.json({
    ok: true,
    circle_id: invite.circle_id,
    circle_name: circle.name,
  })
}
