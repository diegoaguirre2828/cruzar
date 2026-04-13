import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

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

function randomToken(): string {
  // 22-char base64url — plenty of entropy, short enough to fit in a URL
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64url')
}

// POST /api/circles/[id]/invite — generate an invite token for this circle
// Body: { email?: string }
// Returns: { token, invite_url }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: circleId } = await params
  const db = getServiceClient()

  // Verify the user is a member of this circle
  const { data: membership } = await db
    .from('circle_members')
    .select('role')
    .eq('circle_id', circleId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this circle' }, { status: 403 })
  }

  let body: { email?: string } = {}
  try { body = await req.json() } catch { /* empty body is fine */ }
  const email = (body.email || '').trim().slice(0, 200) || null

  const token = randomToken()
  const { error } = await db.from('circle_invites').insert({
    token,
    circle_id: circleId,
    invited_by: user.id,
    invited_email: email,
  })
  if (error) {
    console.error('circle invite error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://cruzar.app'
  const inviteUrl = `${origin}/circle/join/${token}`

  return NextResponse.json({ token, invite_url: inviteUrl })
}
