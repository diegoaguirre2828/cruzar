// Pattern Brain preview — returns the user's currently-detected
// routines so the /account UI can show "we noticed you cross at
// Hidalgo around 7am on Tue/Thu — want a heads-up at 6am?"

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { getPortMeta } from '@/lib/portMeta'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const [profileRes, routinesRes] = await Promise.all([
    db.from('profiles').select('pattern_brain_opt_in, pattern_brain_opt_in_at, pattern_brain_last_sent_at').eq('id', user.id).maybeSingle(),
    db.from('pattern_brain_routines').select('port_id, dow, hour, sample_count, last_seen_at').eq('user_id', user.id).order('sample_count', { ascending: false }).limit(20),
  ])

  const routines = (routinesRes.data ?? []).map((r) => {
    const meta = getPortMeta(String(r.port_id))
    return {
      port_id: r.port_id,
      port_name: meta.localName || meta.city,
      dow: r.dow,
      hour: r.hour,
      wake_up_hour_ct: (r.hour as number) === 0 ? 23 : (r.hour as number) - 1,
      sample_count: r.sample_count,
      last_seen_at: r.last_seen_at,
    }
  })

  return NextResponse.json({
    opt_in: profileRes.data?.pattern_brain_opt_in ?? false,
    opt_in_at: profileRes.data?.pattern_brain_opt_in_at ?? null,
    last_sent_at: profileRes.data?.pattern_brain_last_sent_at ?? null,
    routines,
    detected_count: routines.length,
  })
}

interface PutBody { opt_in?: boolean }

export async function PUT(req: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as PutBody
  const optIn = !!body.opt_in
  const db = getServiceClient()
  const { error } = await db
    .from('profiles')
    .update({
      pattern_brain_opt_in: optIn,
      pattern_brain_opt_in_at: optIn ? new Date().toISOString() : null,
    })
    .eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, opt_in: optIn })
}

export async function DELETE() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = getServiceClient()
  await db.from('pattern_brain_routines').delete().eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
