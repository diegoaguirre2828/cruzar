import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

async function getAdminUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === ADMIN_EMAIL ? user : null
}

// GET — generate group caption only (no Facebook post)
export async function GET(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const region = req.nextUrl.searchParams.get('region') || 'rgv'
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })

  const appUrl = 'https://cruzar.app'
  const res = await fetch(`${appUrl}/api/generate-post?secret=${secret}&region=${region}&post=false`, {
    cache: 'no-store',
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

// POST — generate caption AND post to Facebook Page
export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const region = body.region || 'rgv'

  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })

  const appUrl = 'https://cruzar.app'
  const res = await fetch(`${appUrl}/api/generate-post?secret=${secret}&region=${region}&post=true`, {
    cache: 'no-store',
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
