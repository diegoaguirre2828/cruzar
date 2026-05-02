// JSON feed for the public /live page. Replaces the <meta http-equiv="refresh">
// full-page reload on /live with client-side SWR polling — pages stay mounted
// when users tab between /live and /memory.

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { PORT_META } from '@/lib/portMeta';

export const runtime = 'nodejs';
export const revalidate = 60;

const COVERED = ['230501', '230502', '230503', '230402', '230401', '230301', '535502', '535501'];

export async function GET() {
  const db = getServiceClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const ninety = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date();
  const dow = now.getDay();
  const hour = now.getHours();

  const [{ data: live }, { data: hist }] = await Promise.all([
    db
      .from('wait_time_readings')
      .select('port_id, vehicle_wait, recorded_at')
      .in('port_id', COVERED)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: false })
      .limit(500),
    db
      .from('wait_time_readings')
      .select('port_id, vehicle_wait')
      .in('port_id', COVERED)
      .gte('recorded_at', ninety)
      .eq('day_of_week', dow)
      .eq('hour_of_day', hour)
      .limit(20000),
  ]);

  const liveByPort = new Map<string, { wait: number | null; recorded: string }>();
  for (const r of live ?? []) {
    if (liveByPort.has(String(r.port_id))) continue;
    liveByPort.set(String(r.port_id), { wait: r.vehicle_wait ?? null, recorded: r.recorded_at });
  }
  const sums = new Map<string, { s: number; n: number }>();
  for (const r of hist ?? []) {
    if (r.vehicle_wait == null) continue;
    const cur = sums.get(String(r.port_id)) ?? { s: 0, n: 0 };
    cur.s += r.vehicle_wait;
    cur.n += 1;
    sums.set(String(r.port_id), cur);
  }

  const rows = COVERED.map((pid) => {
    const meta = PORT_META[pid];
    const lv = liveByPort.get(pid);
    const sm = sums.get(pid);
    const histAvg = sm && sm.n > 0 ? Math.round(sm.s / sm.n) : null;
    const live_wait = lv?.wait ?? null;
    let status: 'normal' | 'anomaly_high' | 'anomaly_low' | 'no_baseline' | 'no_reading' = 'normal';
    let pctAbove: number | null = null;
    if (live_wait == null) status = 'no_reading';
    else if (histAvg == null || histAvg <= 0) status = 'no_baseline';
    else {
      const ratio = live_wait / histAvg;
      pctAbove = Math.round((ratio - 1) * 100);
      if (ratio >= 1.5) status = 'anomaly_high';
      else if (ratio <= 0.67) status = 'anomaly_low';
    }
    return {
      port_id: pid,
      name: meta?.localName ?? meta?.city ?? pid,
      region: meta?.region ?? '',
      current_wait_min: live_wait,
      recorded_at: lv?.recorded ?? null,
      hist_avg_min: histAvg,
      anomaly_status: status,
      anomaly_pct_above: pctAbove,
    };
  });

  return NextResponse.json({ rows, generated_at: now.toISOString() });
}
