import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const maxDuration = 30

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

// Generic cron-job.org registrar. Companion to /api/admin/create-cron-jobs
// (which is hardcoded to the 4-job peak-time FB post scheduler). This one
// takes an arbitrary job spec so ANY new /api/cron/* route I ship can be
// scheduled in one admin click, instead of me telling Diego to open
// cron-job.org and paste a URL manually.
//
// Schedule shape matches cron-job.org v1 API:
//   https://docs.cron-job.org/rest-api.html#create-a-job
// - hours/minutes/mdays/months/wdays: arrays of ints, or [-1] for "any"
// - timezone: IANA tz, e.g. "UTC" or "America/Chicago"

interface ScheduleSpec {
  timezone?: string
  hours?: number[]       // [-1] = every hour
  minutes?: number[]     // [-1] = every minute (don't do this)
  mdays?: number[]       // [-1] = every day of month
  months?: number[]      // [-1] = every month
  wdays?: number[]       // [-1] = every weekday
}

interface Body {
  cronApiKey?: string
  // /api/cron/... path that the job should hit. We append ?secret=CRON_SECRET
  // server-side so the key never leaves the server.
  path?: string
  title?: string
  schedule?: ScheduleSpec
  enabled?: boolean
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })

  let body: Body
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const cronApiKey = (body.cronApiKey || '').trim()
  const path = (body.path || '').trim()
  const title = (body.title || '').trim()
  const schedule = body.schedule

  if (!cronApiKey) return NextResponse.json({ error: 'Missing cronApiKey' }, { status: 400 })
  if (!path || !path.startsWith('/api/cron/')) {
    return NextResponse.json({ error: 'path must start with /api/cron/' }, { status: 400 })
  }
  if (!title) return NextResponse.json({ error: 'Missing title' }, { status: 400 })
  if (!schedule) return NextResponse.json({ error: 'Missing schedule' }, { status: 400 })

  const url = `https://cruzar.app${path}?secret=${cronSecret}`

  const jobSchedule = {
    timezone: schedule.timezone || 'UTC',
    hours: schedule.hours ?? [-1],
    minutes: schedule.minutes ?? [-1],
    mdays: schedule.mdays ?? [-1],
    months: schedule.months ?? [-1],
    wdays: schedule.wdays ?? [-1],
  }

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
          title,
          enabled: body.enabled ?? true,
          saveResponses: false,
          schedule: jobSchedule,
        },
      }),
    })
    const text = await res.text()
    let data: Record<string, unknown> = {}
    try { data = JSON.parse(text) } catch { /* not JSON */ }

    if (res.ok && data.jobId) {
      return NextResponse.json({
        ok: true,
        jobId: data.jobId,
        url,
        title,
        schedule: jobSchedule,
      })
    }
    return NextResponse.json({
      ok: false,
      status: res.status,
      error: text.slice(0, 500),
    }, { status: 502 })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
