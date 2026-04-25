import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const maxDuration = 30

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

// Manual "Fire Now" trigger for /api/cron/fb-publish. Used by the
// admin /admin/fb panel for ad-hoc posts outside the 4 peak slots.
// Bypasses the 180-min dedupe window via force=1 so the operator can
// post twice in a row if needed (e.g. retrying after a token refresh).

export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })

  const url = `https://cruzar.app/api/cron/fb-publish?secret=${cronSecret}&force=1`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
