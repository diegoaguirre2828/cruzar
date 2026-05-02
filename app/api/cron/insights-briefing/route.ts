import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { buildBriefRows, renderBrief, type SubscriberRow, type PortBriefRow } from '@/lib/insights/briefing';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authed(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const url = new URL(req.url);
  const q = url.searchParams.get('secret');
  if (q && q === secret) return true;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return false;
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? 'Cruzar Briefings <briefings@cruzar.app>',
        to,
        subject,
        html,
        text,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('insights-briefing send fail', err);
    return false;
  }
}

export async function POST(req: NextRequest) { return GET(req); }

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1';
  const db = getServiceClient();
  const now = new Date();

  const { data: subs, error } = await db
    .from('insights_subscribers')
    .select('id, user_id, language, watched_port_ids, recipient_emails, briefing_local_hour, briefing_tz, anomaly_threshold_default')
    .eq('status', 'active')
    .eq('briefing_enabled', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due = (subs ?? []).filter((s) => {
    try {
      const local = new Date(now.toLocaleString('en-US', { timeZone: s.briefing_tz }));
      return local.getHours() === s.briefing_local_hour;
    } catch { return false; }
  });

  let sent = 0;
  let errors = 0;
  for (const sub of due) {
    try {
      const rows = await buildBriefRows(sub as SubscriberRow);
      const { subject, html, text } = renderBrief(sub as SubscriberRow, rows);
      if (!dryRun) {
        for (const email of sub.recipient_emails ?? []) {
          await sendEmail(email, subject, html, text);
        }
        await db.from('insights_subscribers')
          .update({ last_briefing_sent_at: now.toISOString() })
          .eq('id', sub.id);
      }
      await logBriefingToCalibration(sub as SubscriberRow, rows);
      sent++;
    } catch (err) {
      console.error('briefing failed', { sub: sub.id, err });
      errors++;
    }
  }

  return NextResponse.json({ subscribers_due: due.length, briefings_sent: sent, errors, dryRun });
}

async function logBriefingToCalibration(sub: SubscriberRow, rows: PortBriefRow[]) {
  const db = getServiceClient();
  for (const r of rows) {
    if (r.forecast_6h_min == null) continue;
    await db.from('calibration_log').insert({
      project: 'cruzar',
      sim_kind: 'insights-briefing-forecast-6h',
      sim_version: 'v0.5.4',
      predicted: { port_id: r.port_id, predicted_min: r.forecast_6h_min },
      context: { subscriber_id: sub.id, current_min: r.current_min, ratio: r.ratio },
      tags: [`port:${r.port_id}`, `subscriber:${sub.id}`, 'briefing'],
    });
  }
}
