import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Returns the same caption that Make.com is posting to the Cruzar FB
// page right now, for the promoter dashboard's "copy and share"
// workflow. Auth-gated against is_promoter or the admin email — the
// client never sees the CRON_SECRET (it stays server-side).
//
// Implementation: server-side fetch of /api/social/next-post with the
// CRON_SECRET env var. Returns caption + peak metadata to the client.

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

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
  const { data: profile } = await db
    .from('profiles')
    .select('is_promoter')
    .eq('id', user.id)
    .single()

  const isAdmin = user.email === ADMIN_EMAIL
  if (!isAdmin && !profile?.is_promoter) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  try {
    // force=1: this is a READ, not a post — bypass the dedupe gap so
    // the promoter dashboard always sees the live caption regardless
    // of whether Make.com just posted to the FB Page.
    const res = await fetch(
      `https://www.cruzar.app/api/social/next-post?secret=${cronSecret}&force=1`,
      { cache: 'no-store' },
    )
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: `Upstream ${res.status}`, detail: text.slice(0, 200) }, { status: 502 })
    }
    const data = await res.json()
    return NextResponse.json({
      caption: data.caption || null,
      peak: data.peak || null,
      regions: data.regions || 0,
      fallback: data.fallback || false,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Fetch failed', detail: String(err) }, { status: 500 })
  }
}
