import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const maxDuration = 30

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

// Registers cron-job.org schedules for the new in-repo FB publisher
// (/api/cron/fb-publish) at the same 4 peak times the Make scenario
// was firing on. Mirrors /api/admin/create-cron-jobs (which targets
// /api/cron/generate-all-posts) — once both are wired, the publisher
// runs natively as the Page and the generator continues sending the
// preview email Diego uses for visibility.
//
// Times in CST = 5:30am / 11:30am / 3:30pm / 7:00pm. cron-job.org
// schedules in UTC, so during CDT (UTC-5) those are 10:30 / 16:30 /
// 20:30 / 00:00 UTC.

const FB_PUBLISH_JOBS = [
  { title: '🌅 Cruzar FB Publish — 5:30am CST',  hour: 10, min: 30 },
  { title: '☀️ Cruzar FB Publish — 11:30am CST',  hour: 16, min: 30 },
  { title: '🌆 Cruzar FB Publish — 3:30pm CST',   hour: 20, min: 30 },
  { title: '🌙 Cruzar FB Publish — 7:00pm CST',   hour: 0,  min: 0  },
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

  const url = `https://cruzar.app/api/cron/fb-publish?secret=${cronSecret}`
  const results: { title: string; status: 'created' | 'error'; jobId?: number; debug?: string }[] = []

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

  for (const job of FB_PUBLISH_JOBS) {
    try {
      const res = await fetch('https://api.cron-job.org/jobs', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${cronApiKey}`,
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
              hours: [job.hour],
              minutes: [job.min],
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
        results.push({ title: job.title, status: 'created', jobId: data.jobId as number })
      } else {
        results.push({ title: job.title, status: 'error', debug: `HTTP ${res.status}: ${text.slice(0, 300)}` })
      }
    } catch (e) {
      results.push({ title: job.title, status: 'error', debug: String(e) })
    }
    await delay(2000)
  }

  const created = results.filter(r => r.status === 'created').length
  const failed = results.filter(r => r.status === 'error').length
  return NextResponse.json({ created, failed, results })
}
