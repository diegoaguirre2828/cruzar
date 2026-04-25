import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const maxDuration = 30

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

// Registers the two Cruzar Intelligence cron jobs with cron-job.org:
//   - intel-ingest: every hour at :07
//   - intel-brief:  daily at 12:30 UTC (≈ 7:30 CT — slightly after
//                    the morning border push so today's events land
//                    in the brief)
//
// Authed by Diego's owner email cookie. POST { cronApiKey } and the
// jobs land. Idempotent at the cron-job.org side as long as Diego
// doesn't run it twice with the same secret URL — duplicates are
// harmless but waste rate-limit budget so this endpoint should be
// called once per environment.

const INTEL_CRON_JOBS = [
  {
    title: '🛰️ Cruzar Intel — Ingest hourly :07',
    path: 'intel-ingest',
    schedule: { hours: [-1], minutes: [7] },
  },
  {
    title: '🧠 Cruzar Intel — Daily brief 12:30 UTC',
    path: 'intel-brief',
    schedule: { hours: [12], minutes: [30] },
  },
]

export async function POST(req: NextRequest) {
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

  const { cronApiKey } = await req.json().catch(() => ({}))
  if (!cronApiKey) return NextResponse.json({ error: 'Missing cronApiKey' }, { status: 400 })

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })

  const results: Array<{ title: string; status: 'created' | 'error'; jobId?: number; debug?: string }> = []
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

  for (const job of INTEL_CRON_JOBS) {
    const url = `https://cruzar.app/api/cron/${job.path}?secret=${cronSecret}`
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
            title: job.title,
            enabled: true,
            saveResponses: false,
            schedule: {
              timezone: 'UTC',
              hours: job.schedule.hours,
              minutes: job.schedule.minutes,
              mdays: [-1],
              months: [-1],
              wdays: [-1],
            },
          },
        }),
      })
      const text = await res.text()
      const data: Record<string, unknown> = (() => { try { return JSON.parse(text) } catch { return {} } })()
      if (res.ok && data.jobId) {
        results.push({ title: job.title, status: 'created', jobId: data.jobId as number })
      } else {
        results.push({ title: job.title, status: 'error', debug: `HTTP ${res.status}: ${text.slice(0, 300)}` })
      }
    } catch (e) {
      results.push({ title: job.title, status: 'error', debug: String(e) })
    }
    await delay(1500)
  }

  const created = results.filter((r) => r.status === 'created').length
  const failed = results.filter((r) => r.status === 'error').length
  return NextResponse.json({ created, failed, results })
}
