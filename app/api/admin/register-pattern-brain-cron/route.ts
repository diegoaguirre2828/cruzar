// Admin endpoint — registers the Pattern Brain hourly cron at
// cron-job.org via their REST API. Per the CRUZAR TIER-0 rule:
// Diego never pastes into cron-job.org by hand.
//
// Body: { cronApiKey: string }
// Auth: must be logged in as ADMIN_EMAIL.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { cronApiKey } = await req.json()
  if (!cronApiKey) return NextResponse.json({ error: 'Missing cronApiKey' }, { status: 400 })

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })

  const url = `https://cruzar.app/api/cron/pattern-brain?secret=${cronSecret}`

  try {
    const res = await fetch('https://api.cron-job.org/jobs', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${cronApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        job: {
          url,
          title: '🧠 Cruzar — Pattern Brain (hourly)',
          enabled: true,
          saveResponses: false,
          schedule: {
            timezone: 'UTC',
            // Every hour at minute 0
            hours: [-1],
            minutes: [0],
            mdays: [-1],
            months: [-1],
            wdays: [-1],
          },
        },
      }),
    })
    const text = await res.text()
    let data: Record<string, unknown> = {}
    try { data = JSON.parse(text) } catch { /* not JSON */ }
    if (res.ok && data.jobId) {
      return NextResponse.json({ status: 'created', jobId: data.jobId })
    }
    return NextResponse.json({ status: 'error', debug: `HTTP ${res.status}: ${text.slice(0, 300)}` }, { status: 502 })
  } catch (e) {
    return NextResponse.json({ status: 'error', debug: String(e) }, { status: 500 })
  }
}
