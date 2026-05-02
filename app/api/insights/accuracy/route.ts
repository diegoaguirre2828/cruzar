// Public read-only JSON of per-port calibration accuracy. Same compute as
// /insights/accuracy page, returned as machine-readable JSON for the
// cruzar-calibration-watch routine + any future agents that need to read
// the live soak without DB credentials.
//
// Aggregate data only — no PII, no exploit surface, public.

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { PORT_META } from '@/lib/portMeta';
import manifest from '@/data/insights-manifest.json';

export const runtime = 'nodejs';
export const revalidate = 300;

interface ManifestModel {
  port_id: string;
  port_name: string;
  horizon_min: number;
  lift_vs_cbp_climatology_pct: number | null;
}

interface Manifest {
  model_version: string;
  saved_at: string;
  models: ManifestModel[];
}

export async function GET() {
  const db = getServiceClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from('calibration_log')
    .select('tags, loss, sim_kind, observed, predicted')
    .eq('project', 'cruzar')
    .or('sim_kind.eq.wait_forecast_6h,sim_kind.eq.insights-briefing-forecast-6h')
    .gte('created_at', cutoff)
    .not('observed', 'is', null)
    .limit(50000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const accByPort = new Map<string, { hits: number; total: number }>();
  for (const row of data ?? []) {
    let portId: string | null = null;
    const tags = (row.tags as string[] | null) ?? [];
    const portTag = tags.find((t) => t.startsWith('port:'));
    if (portTag) {
      portId = portTag.slice(5);
    } else {
      const pred = row.predicted as { port_id?: string } | null;
      if (pred?.port_id) portId = pred.port_id;
    }
    if (!portId) continue;
    const cur = accByPort.get(portId) ?? { hits: 0, total: 0 };
    cur.total += 1;
    if (typeof row.loss === 'number' && row.loss <= 15) cur.hits += 1;
    accByPort.set(portId, cur);
  }

  const m = manifest as Manifest;
  const decisionGradePortIds = m.models
    .filter((r) => r.horizon_min === 360 && (r.lift_vs_cbp_climatology_pct ?? -999) >= 5)
    .map((r) => r.port_id);

  const ports = Array.from(accByPort.entries())
    .map(([pid, v]) => {
      const meta = PORT_META[pid];
      return {
        port_id: pid,
        name: meta?.localName ?? meta?.city ?? pid,
        n: v.total,
        hits: v.hits,
        accuracy_pct: v.total > 0 ? Math.round((v.hits / v.total) * 100) : null,
        is_decision_grade: decisionGradePortIds.includes(pid),
      };
    })
    .sort((a, b) => (b.accuracy_pct ?? 0) - (a.accuracy_pct ?? 0));

  // Median accuracy across decision-grade ports with n >= 5
  const dgWithEnoughN = ports
    .filter((p) => p.is_decision_grade && p.n >= 5 && p.accuracy_pct != null)
    .map((p) => p.accuracy_pct as number)
    .sort((a, b) => a - b);
  const median_accuracy_pct =
    dgWithEnoughN.length > 0 ? dgWithEnoughN[Math.floor(dgWithEnoughN.length / 2)] : null;

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    cutoff_30d: cutoff,
    ports,
    decision_grade_port_ids: decisionGradePortIds,
    median_accuracy_pct_decision_grade: median_accuracy_pct,
    total_resolved_predictions: ports.reduce((s, p) => s + p.n, 0),
    manifest_version: m.model_version,
  });
}
