'use client';

// Client SWR data block for /live. Replaces the per-port server render that
// used to live inside /live/page.tsx. Polls /api/live/board every 60s without
// triggering a full-page reload (the old <meta http-equiv="refresh"> behavior
// was the root cause of the "needs reload when switching" bug brokers reported
// on 2026-05-01).

import useSWR from 'swr';

interface Row {
  port_id: string;
  name: string;
  region: string;
  current_wait_min: number | null;
  recorded_at: string | null;
  hist_avg_min: number | null;
  anomaly_status: 'normal' | 'anomaly_high' | 'anomaly_low' | 'no_baseline' | 'no_reading';
  anomaly_pct_above: number | null;
}

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const waitColor = (m: number | null) =>
  m == null ? 'rgba(255,255,255,0.35)' : m <= 20 ? '#22c55e' : m <= 45 ? '#f59e0b' : '#ef4444';

export function LiveBoard() {
  const { data } = useSWR<{ rows: Row[]; generated_at: string }>(
    '/api/live/board',
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: true },
  );
  if (!data) {
    return <div style={{ color: 'rgba(255,255,255,0.5)', padding: 24 }}>Loading…</div>;
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <p style={{ color: 'rgba(255,255,255,0.45)', margin: 0, fontSize: 13 }}>
        Updated {new Date(data.generated_at).toLocaleString()}
      </p>
      {data.rows.map((r) => (
        <div
          key={r.port_id}
          style={{
            background: 'rgba(255,255,255,0.05)',
            borderLeft: `4px solid ${waitColor(r.current_wait_min)}`,
            borderRadius: 16,
            padding: '16px 18px',
            border: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>{r.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{r.region}</div>
            </div>
            {r.anomaly_status === 'anomaly_high' && r.anomaly_pct_above != null && (
              <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'rgba(239,68,68,0.18)', color: '#fca5a5' }}>
                +{r.anomaly_pct_above}% vs typical
              </span>
            )}
            {r.anomaly_status === 'anomaly_low' && r.anomaly_pct_above != null && (
              <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.18)', color: '#86efac' }}>
                {r.anomaly_pct_above}% vs typical (lighter)
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Now</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: waitColor(r.current_wait_min) }}>
                {r.current_wait_min != null ? r.current_wait_min : '—'}
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginLeft: 4 }}>min</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Typical now</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>
                {r.hist_avg_min != null ? r.hist_avg_min : '—'}
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginLeft: 4 }}>min</span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>90d DOW × hour avg</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
