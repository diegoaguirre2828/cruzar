import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET — list circles the authed user is a member of + each circle's members.
// POST — create a new circle (authed user becomes owner + first member).

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()

  // Fetch circles the user is a member of
  const { data: myMemberships } = await db
    .from('circle_members')
    .select('circle_id, role')
    .eq('user_id', user.id)

  const circleIds = (myMemberships || []).map((m) => m.circle_id)
  if (circleIds.length === 0) return NextResponse.json({ circles: [] })

  const { data: circles } = await db
    .from('circles')
    .select('id, name, owner_id, created_at')
    .in('id', circleIds)

  // Fetch all members for those circles in one go
  const { data: allMembers } = await db
    .from('circle_members')
    .select('circle_id, user_id, role, joined_at')
    .in('circle_id', circleIds)

  // Resolve member user info (email, display_name) via auth admin
  const memberUserIds = [...new Set((allMembers || []).map((m) => m.user_id))]
  const userInfo = new Map<string, { email: string; display_name: string | null }>()
  await Promise.all(
    memberUserIds.map(async (uid) => {
      const { data: authUser } = await db.auth.admin.getUserById(uid)
      if (authUser?.user) {
        const email = authUser.user.email || ''
        const { data: profile } = await db.from('profiles').select('display_name').eq('id', uid).maybeSingle()
        userInfo.set(uid, { email, display_name: profile?.display_name || null })
      }
    })
  )

  // Group members by circle
  const membersByCircle = new Map<string, Array<{ user_id: string; role: string; email: string; display_name: string | null; joined_at: string }>>()
  for (const m of allMembers || []) {
    const info = userInfo.get(m.user_id)
    if (!info) continue
    const arr = membersByCircle.get(m.circle_id) || []
    arr.push({
      user_id: m.user_id,
      role: m.role || 'member',
      email: info.email,
      display_name: info.display_name,
      joined_at: m.joined_at,
    })
    membersByCircle.set(m.circle_id, arr)
  }

  const result = (circles || []).map((c) => ({
    id: c.id,
    name: c.name,
    owner_id: c.owner_id,
    created_at: c.created_at,
    is_owner: c.owner_id === user.id,
    members: membersByCircle.get(c.id) || [],
  }))

  return NextResponse.json({ circles: result })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { name?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const name = (body.name || '').trim().slice(0, 50)
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const db = getServiceClient()

  // Limit: users can own max 3 circles (arbitrary but prevents abuse)
  const { count: ownedCount } = await db
    .from('circles')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id)
  if ((ownedCount || 0) >= 3) {
    return NextResponse.json({ error: 'You can only own 3 circles' }, { status: 400 })
  }

  const { data: circle, error } = await db
    .from('circles')
    .insert({ name, owner_id: user.id })
    .select('id, name, owner_id, created_at')
    .single()
  if (error || !circle) {
    return NextResponse.json({ error: error?.message || 'Failed to create' }, { status: 500 })
  }

  // Owner is automatically the first member
  await db.from('circle_members').insert({
    circle_id: circle.id,
    user_id: user.id,
    role: 'owner',
  })

  return NextResponse.json({ circle })
}
