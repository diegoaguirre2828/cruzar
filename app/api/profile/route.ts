import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { validateHandle, normalizeHandle } from '@/lib/handleGenerator'

const FOUNDER_LIMIT = 50

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single()
  const { data: sub } = await db.from('subscriptions').select('tier, status, current_period_end').eq('user_id', user.id).single()

  // Award founder badge if under the limit and not already awarded
  if (profile && !profile.badges?.includes('founder')) {
    const { count } = await db
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .contains('badges', ['founder'])
    if ((count ?? 0) < FOUNDER_LIMIT) {
      const updatedBadges = [...(profile.badges || []), 'founder']
      await db.from('profiles').update({ badges: updatedBadges }).eq('id', user.id)
      profile.badges = updatedBadges
    }
  }

  return NextResponse.json({ profile, subscription: sub, email: user.email })
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['display_name', 'full_name', 'company', 'role', 'bio']
  const updates: Record<string, string | boolean> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key]
  }
  // Boolean settings — currently just the auto-crossing opt-in.
  // We also stamp auto_geofence_opt_in_at on the upgrade edge (false→true)
  // so we have an audit trail of when the user explicitly accepted the
  // auto-detection terms. NULL means never opted in or currently off.
  let stampOptInAt = false
  if (typeof body.auto_geofence_opt_in === 'boolean') {
    updates.auto_geofence_opt_in = body.auto_geofence_opt_in
    if (body.auto_geofence_opt_in === true) stampOptInAt = true
  }

  // Validate display_name against the same rules as auto-generated
  // handles — lowercase letters, digits, underscore, hyphen; 3-30
  // chars; no leading/trailing separators. Anything invalid gets
  // rejected so users can't smuggle spaces, emojis, or offensive
  // characters into the public leaderboard.
  if (updates.display_name !== undefined) {
    const handle = updates.display_name as string
    const err = validateHandle(handle)
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 })
    }
    updates.display_name = normalizeHandle(handle)
  }

  const db = getServiceClient()
  if (stampOptInAt) {
    updates.auto_geofence_opt_in_at = new Date().toISOString()
  }
  const { error } = await db.from('profiles').update(updates).eq('id', user.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE — in-app account deletion (Apple Guideline 5.1.1(v)).
// Wipes user-scoped data, anonymizes community reports (preserves
// aggregate history per /data-deletion "What May Be Retained"), and
// removes the auth user via service-role admin API.
export async function DELETE() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const uid = user.id

  await db.from('push_subscriptions').delete().eq('user_id', uid)
  await db.from('alert_preferences').delete().eq('user_id', uid)
  await db.from('saved_crossings').delete().eq('user_id', uid)
  await db.from('subscriptions').delete().eq('user_id', uid)
  await db.from('crossing_reports').update({ user_id: null }).eq('user_id', uid)
  await db.from('exchange_rate_reports').update({ user_id: null }).eq('user_id', uid)
  await db.from('profiles').delete().eq('id', uid)

  const { error: authErr } = await db.auth.admin.deleteUser(uid)
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
