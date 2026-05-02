// Cruzar Insights morning briefing — composes the 5am email body for one
// subscriber. Uses live wait + DOW × hour baseline + per-port 30d calibration
// accuracy. EN/ES toggled. Caller is /api/cron/insights-briefing.

import { getServiceClient } from '@/lib/supabase';
import { PORT_META } from '@/lib/portMeta';

export interface SubscriberRow {
  id: number;
  user_id: string;
  language: 'en' | 'es';
  watched_port_ids: string[];
  recipient_emails: string[];
  briefing_local_hour: number;
  briefing_tz: string;
  anomaly_threshold_default: number;
}

export interface PortBriefRow {
  port_id: string;
  name: string;
  current_min: number | null;
  forecast_6h_min: number | null;
  hist_avg_min: number | null;
  ratio: number | null;
  status: 'normal' | 'rising' | 'anomaly_high' | 'anomaly_low' | 'no_reading';
  accuracy_30d_pct: number | null;
}

export async function buildBriefRows(sub: SubscriberRow): Promise<PortBriefRow[]> {
  const db = getServiceClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const ninetyDays = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const cal30Cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date();
  const dow = now.getDay();
  const hour = now.getHours();

  const ports = sub.watched_port_ids;
  if (ports.length === 0) return [];

  const [{ data: live }, { data: hist }, { data: cal }] = await Promise.all([
    db.from('wait_time_readings')
      .select('port_id, vehicle_wait, recorded_at')
      .in('port_id', ports)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: false })
      .limit(500),
    db.from('wait_time_readings')
      .select('port_id, vehicle_wait')
      .in('port_id', ports)
      .gte('recorded_at', ninetyDays)
      .eq('day_of_week', dow)
      .eq('hour_of_day', hour)
      .limit(20000),
    db.from('calibration_log')
      .select('tags, loss')
      .like('sim_kind', '%forecast%')
      .gte('created_at', cal30Cutoff)
      .not('observed', 'is', null)
      .limit(10000),
  ]);

  const liveByPort = new Map<string, number>();
  for (const r of live ?? []) {
    if (!liveByPort.has(String(r.port_id)) && r.vehicle_wait != null) {
      liveByPort.set(String(r.port_id), r.vehicle_wait);
    }
  }

  const sums = new Map<string, { sum: number; n: number }>();
  for (const r of hist ?? []) {
    if (r.vehicle_wait == null) continue;
    const k = String(r.port_id);
    const cur = sums.get(k) ?? { sum: 0, n: 0 };
    cur.sum += r.vehicle_wait;
    cur.n += 1;
    sums.set(k, cur);
  }

  const accByPort = new Map<string, { hits: number; total: number }>();
  for (const row of cal ?? []) {
    const tags = (row.tags as string[] | null) ?? [];
    const portTag = tags.find((t) => t.startsWith('port:'));
    if (!portTag) continue;
    const pid = portTag.slice(5);
    const cur = accByPort.get(pid) ?? { hits: 0, total: 0 };
    cur.total += 1;
    if (typeof row.loss === 'number' && row.loss <= 15) cur.hits += 1;
    accByPort.set(pid, cur);
  }

  return ports.map((pid) => {
    const meta = PORT_META[pid];
    const live = liveByPort.get(pid) ?? null;
    const sum = sums.get(pid);
    const histAvg = sum && sum.n > 0 ? Math.round(sum.sum / sum.n) : null;
    const ratio = live != null && histAvg != null && histAvg > 0 ? live / histAvg : null;
    let status: PortBriefRow['status'] = 'normal';
    if (live == null) status = 'no_reading';
    else if (ratio != null && ratio >= sub.anomaly_threshold_default) status = 'anomaly_high';
    else if (ratio != null && ratio <= 0.67) status = 'anomaly_low';
    else if (ratio != null && ratio >= 1.2) status = 'rising';

    const acc = accByPort.get(pid);
    const accuracy_30d_pct = acc && acc.total >= 5 ? Math.round((acc.hits / acc.total) * 100) : null;

    return {
      port_id: pid,
      name: meta?.localName ?? meta?.city ?? pid,
      current_min: live,
      forecast_6h_min: null, // Pop in via cruzar-insights-api before render in the cron route
      hist_avg_min: histAvg,
      ratio,
      status,
      accuracy_30d_pct,
    };
  });
}

export function renderBrief(sub: SubscriberRow, rows: PortBriefRow[]): { subject: string; html: string; text: string } {
  const es = sub.language === 'es';
  const dateLabel = new Date().toLocaleDateString(es ? 'es-MX' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const subject = es
    ? `Cruzar — Lectura matutina de la frontera · ${dateLabel}`
    : `Cruzar — Morning border read · ${dateLabel}`;

  const greeting = es ? 'Buenos días,' : 'Good morning,';
  const tracking = es
    ? `Monitoreando tus ${rows.length} puertos. Lectura rápida del turno:`
    : `Tracking your ${rows.length} ports. Quick read for today's shift:`;

  const groupNormal = rows.filter((r) => r.status === 'normal' || r.status === 'anomaly_low');
  const groupRising = rows.filter((r) => r.status === 'rising');
  const groupAnom = rows.filter((r) => r.status === 'anomaly_high');

  function formatRow(r: PortBriefRow): string {
    const cur = r.current_min != null ? `${r.current_min} min` : '—';
    const fc = r.forecast_6h_min != null ? `${r.forecast_6h_min} min` : '—';
    const ratio = r.ratio != null ? ` · ${r.ratio.toFixed(1)}× baseline` : '';
    return es
      ? `${r.name} — ${cur} ahora, pronóstico 6h ${fc}${ratio}.`
      : `${r.name} — ${cur} now, ${fc} forecast 6h${ratio}.`;
  }

  const lines: string[] = [];
  lines.push(greeting);
  lines.push('');
  lines.push(tracking);
  lines.push('');
  if (groupNormal.length > 0) {
    lines.push('🟢 NORMAL');
    for (const r of groupNormal) lines.push(formatRow(r));
    lines.push('');
  }
  if (groupRising.length > 0) {
    lines.push(es ? '🟡 SUBIENDO' : '🟡 RISING');
    for (const r of groupRising) lines.push(formatRow(r));
    lines.push('');
  }
  if (groupAnom.length > 0) {
    lines.push(es ? '🔴 ANOMALÍA' : '🔴 ANOMALY');
    for (const r of groupAnom) lines.push(formatRow(r));
    lines.push('');
  }

  const accLine = rows
    .filter((r) => r.accuracy_30d_pct != null)
    .map((r) => `${r.name} ${r.accuracy_30d_pct}%`)
    .join(' · ');
  if (accLine) {
    lines.push(es ? `Precisión en TUS puertos (últimos 30 días): ${accLine}` : `Accuracy on YOUR ports (last 30 days): ${accLine}`);
    lines.push('');
  }

  lines.push(es ? 'Configura: cruzar.app/dispatch' : 'Configure: cruzar.app/dispatch');
  lines.push(es ? 'Detener briefings: responde STOP' : 'Stop briefings: reply STOP');

  const text = lines.join('\n');
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<pre style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;line-height:1.6;color:#0f172a;background:#fff;padding:16px;">${escaped}</pre>`;

  return { subject, html, text };
}
