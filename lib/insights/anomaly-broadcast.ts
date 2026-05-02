// Per-subscriber anomaly check + push. Reads insights_subscribers, computes
// ratio per watched port, fires push if ratio ≥ threshold AND not deduped
// against a 60-min lookback. Logs to insights_anomaly_fires.
//
// Sender callbacks injected by the cron route — keeps this lib free of
// fetch/SDK dependencies for testing + reuse.

import { getServiceClient } from '@/lib/supabase';
import { PORT_META } from '@/lib/portMeta';

export interface AnomalyCheckResult {
  subscribers_checked: number;
  anomalies_fired: number;
  dedupes_suppressed: number;
  errors: number;
}

interface SubscriberLite {
  id: number;
  user_id: string;
  language: 'en' | 'es';
  watched_port_ids: string[];
  port_thresholds: Record<string, number> | null;
  anomaly_threshold_default: number;
  channel_email: boolean;
  channel_sms: boolean;
  channel_whatsapp: boolean;
  recipient_emails: string[];
  recipient_phones: string[];
  last_anomaly_fired_at: string | null;
}

export async function runAnomalyBroadcast(opts: {
  dryRun: boolean;
  sendSms: (to: string, body: string) => Promise<boolean>;
  sendEmail: (to: string, subject: string, body: string) => Promise<boolean>;
}): Promise<AnomalyCheckResult> {
  const db = getServiceClient();
  const result: AnomalyCheckResult = {
    subscribers_checked: 0,
    anomalies_fired: 0,
    dedupes_suppressed: 0,
    errors: 0,
  };

  const { data: subs, error } = await db
    .from('insights_subscribers')
    .select('id, user_id, language, watched_port_ids, port_thresholds, anomaly_threshold_default, channel_email, channel_sms, channel_whatsapp, recipient_emails, recipient_phones, last_anomaly_fired_at')
    .eq('status', 'active');
  if (error) throw new Error(error.message);

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const ninetyDays = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const dedupeCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const now = new Date();
  const dow = now.getDay();
  const hour = now.getHours();

  const allPorts = Array.from(new Set((subs ?? []).flatMap((s) => s.watched_port_ids)));
  if (allPorts.length === 0) return result;

  const [{ data: live }, { data: hist }, { data: recentFires }] = await Promise.all([
    db.from('wait_time_readings').select('port_id, vehicle_wait, recorded_at').in('port_id', allPorts).gte('recorded_at', since).order('recorded_at', { ascending: false }).limit(2000),
    db.from('wait_time_readings').select('port_id, vehicle_wait').in('port_id', allPorts).gte('recorded_at', ninetyDays).eq('day_of_week', dow).eq('hour_of_day', hour).limit(50000),
    db.from('insights_anomaly_fires').select('subscriber_id, port_id, fired_at').gte('fired_at', dedupeCutoff),
  ]);

  const liveByPort = new Map<string, number>();
  for (const r of live ?? []) {
    if (!liveByPort.has(String(r.port_id)) && r.vehicle_wait != null) liveByPort.set(String(r.port_id), r.vehicle_wait);
  }
  const sums = new Map<string, { sum: number; n: number }>();
  for (const r of hist ?? []) {
    if (r.vehicle_wait == null) continue;
    const k = String(r.port_id);
    const cur = sums.get(k) ?? { sum: 0, n: 0 };
    cur.sum += r.vehicle_wait; cur.n += 1; sums.set(k, cur);
  }
  const dedupeKeys = new Set<string>();
  for (const f of recentFires ?? []) dedupeKeys.add(`${f.subscriber_id}:${f.port_id}`);

  for (const sub of (subs ?? []) as SubscriberLite[]) {
    result.subscribers_checked++;
    for (const portId of sub.watched_port_ids) {
      const live = liveByPort.get(portId);
      const sum = sums.get(portId);
      if (live == null || !sum || sum.n === 0) continue;
      const histAvg = sum.sum / sum.n;
      if (histAvg <= 0) continue;
      const ratio = live / histAvg;
      const threshold = sub.port_thresholds?.[portId] ?? sub.anomaly_threshold_default;
      if (ratio < threshold) continue;

      const dedupeKey = `${sub.id}:${portId}`;
      if (dedupeKeys.has(dedupeKey)) {
        result.dedupes_suppressed++;
        continue;
      }

      const meta = PORT_META[portId];
      const portName = meta?.localName ?? meta?.city ?? portId;
      const channelsFired: string[] = [];
      const subject = `Cruzar: ${portName} ${ratio.toFixed(1)}× normal`;
      const body = sub.language === 'es'
        ? `Cruzar: ${portName} ${ratio.toFixed(1)}× normal (${live} min). Configura: cruzar.app/dispatch`
        : `Cruzar: ${portName} ${ratio.toFixed(1)}× normal (${live} min). Config: cruzar.app/dispatch`;

      try {
        if (sub.channel_email) {
          for (const email of sub.recipient_emails ?? []) {
            if (!opts.dryRun) await opts.sendEmail(email, subject, body);
            channelsFired.push(`email:${email}`);
          }
        }
        if (sub.channel_sms) {
          for (const phone of sub.recipient_phones ?? []) {
            if (!opts.dryRun) await opts.sendSms(phone, body);
            channelsFired.push(`sms:${phone}`);
          }
        }
        if (sub.channel_whatsapp) {
          channelsFired.push('whatsapp:queued');
        }

        if (!opts.dryRun) {
          await db.from('insights_anomaly_fires').insert({
            subscriber_id: sub.id,
            port_id: portId,
            ratio,
            channels_fired: channelsFired,
            payload: { live_min: live, hist_avg_min: histAvg, threshold, port_name: portName },
          });
          await db.from('insights_subscribers')
            .update({ last_anomaly_fired_at: now.toISOString() })
            .eq('id', sub.id);
        }
        dedupeKeys.add(dedupeKey);
        result.anomalies_fired++;
      } catch (err) {
        console.error('anomaly fire failed', { sub: sub.id, portId, err });
        result.errors++;
      }
    }
  }
  return result;
}
