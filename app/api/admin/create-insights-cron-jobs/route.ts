import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ADMIN_EMAIL = 'cruzabusiness@gmail.com';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cronApiKey } = await req.json();
  if (!cronApiKey) return NextResponse.json({ error: 'Missing cronApiKey' }, { status: 400 });
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });

  const jobs = [
    {
      title: '📬 Cruzar Insights — Briefings (hourly tick)',
      url: `https://cruzar.app/api/cron/insights-briefing?secret=${cronSecret}`,
      schedule: { timezone: 'UTC', hours: [-1], minutes: [0], mdays: [-1], months: [-1], wdays: [-1] },
    },
    {
      title: '🚨 Cruzar Insights — Anomaly broadcast (every 30 min)',
      url: `https://cruzar.app/api/cron/insights-anomaly-broadcast?secret=${cronSecret}`,
      schedule: { timezone: 'UTC', hours: [-1], minutes: [0, 30], mdays: [-1], months: [-1], wdays: [-1] },
    },
  ];

  const results: Array<{ title: string; status: 'created' | 'error'; jobId?: number; debug?: string }> = [];
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  for (const job of jobs) {
    try {
      const res = await fetch('https://api.cron-job.org/jobs', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${cronApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: { url: job.url, title: job.title, enabled: true, saveResponses: false, schedule: job.schedule } }),
      });
      const text = await res.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(text); } catch { /* not json */ }
      if (res.ok && data.jobId) results.push({ title: job.title, status: 'created', jobId: data.jobId as number });
      else results.push({ title: job.title, status: 'error', debug: `HTTP ${res.status}: ${text.slice(0, 300)}` });
    } catch (e) {
      results.push({ title: job.title, status: 'error', debug: String(e) });
    }
    await delay(2000);
  }
  const created = results.filter(r => r.status === 'created').length;
  const failed = results.filter(r => r.status === 'error').length;
  return NextResponse.json({ created, failed, results });
}
