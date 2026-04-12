import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const maxDuration = 30

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

const BASE_URL = 'https://cruzar.app/api/cron/generate-all-posts'

// 4 jobs only — one per peak time (CST/CDT = UTC-5 in summer)
// All regions handled in a single request each time
const CRON_JOBS = [
  { title: '🌅 Cruzar — Morning 5:30am CST',   hour: 10, min: 30 },
  { title: '☀️ Cruzar — Midday 11:30am CST',    hour: 16, min: 30 },
  { title: '🌆 Cruzar — Afternoon 3:30pm CST',  hour: 20, min: 30 },
  { title: '🌙 Cruzar — Evening 7:00pm CST',    hour: 0,  min: 30 },
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

  const { cronApiKey } = await req.json()
  if (!cronApiKey) {
    return NextResponse.json({ error: 'Missing cronApiKey' }, { status: 400 })
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const url = `${BASE_URL}?secret=${cronSecret}`
  const results: { title: string; status: 'created' | 'error'; jobId?: number; debug?: string }[] = []

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

  for (const job of CRON_JOBS) {
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
  const failed  = results.filter(r => r.status === 'error').length
  const firstError = results.find(r => r.status === 'error')?.debug || null
  return NextResponse.json({ created, failed, firstError, results })
}
