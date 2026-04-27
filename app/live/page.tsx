// Public live ops feed — shows real-time v0.4 forecasts and anomaly status
// for every RGV crossing the model covers. No auth, indexed by search engines.
//
// Build trust by being radically transparent: brokers / dispatchers can verify
// our predictions against what actually happens at the bridge over the next 6h.

import Link from "next/link";
import { getServiceClient } from "@/lib/supabase";
import { PORT_META } from "@/lib/portMeta";
import { MomentsNav } from "@/components/MomentsNav";

export const runtime = "nodejs";
export const revalidate = 60;

const COVERED_PORT_IDS = ["230501", "230502", "230503", "230402", "230401", "230301", "535502", "535501"];

interface ForecastResult {
  port_id: string;
  port_name: string;
  prediction_min: number;
  rmse_min: number;
  lift_vs_cbp_climatology_pct: number | null;
  lift_vs_persistence_pct: number | null;
  trained_at: string;
}

interface PortRow {
  port_id: string;
  name: string;
  region: string;
  city: string;
  current_wait_min: number | null;
  recorded_at: string | null;
  forecast_6h_min: number | null;
  forecast_lift_cbp_pct: number | null;
  forecast_concept_drift: boolean;
  hist_avg_min: number | null;
  anomaly_status: "anomaly_high" | "anomaly_low" | "normal" | "no_baseline" | "no_reading";
  anomaly_pct_above: number | null;
}

async function fetchLiveState(): Promise<{ rows: PortRow[]; generated_at: string; v04_available: boolean }> {
  const db = getServiceClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date();
  const dow = now.getDay();
  const hour = now.getHours();

  const [{ data: liveData }, { data: histData }, forecasts] = await Promise.all([
    db.from("wait_time_readings")
      .select("port_id, vehicle_wait, recorded_at")
      .in("port_id", COVERED_PORT_IDS)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false })
      .limit(500),
    db.from("wait_time_readings")
      .select("port_id, vehicle_wait")
      .in("port_id", COVERED_PORT_IDS)
      .gte("recorded_at", ninetyDaysAgo)
      .eq("day_of_week", dow)
      .eq("hour_of_day", hour)
      .limit(20000),
    fetchForecastsAll(),
  ]);

  // Latest live reading per port
  const liveByPort = new Map<string, { wait: number | null; recorded: string }>();
  for (const r of liveData || []) {
    const k = String(r.port_id);
    if (liveByPort.has(k)) continue;
    liveByPort.set(k, { wait: r.vehicle_wait ?? null, recorded: r.recorded_at });
  }

  // Historical avg per port for current DOW × hour
  const histByPort = new Map<string, number>();
  const sums = new Map<string, { sum: number; count: number }>();
  for (const r of histData || []) {
    const k = String(r.port_id);
    if (r.vehicle_wait == null) continue;
    const cur = sums.get(k) ?? { sum: 0, count: 0 };
    cur.sum += r.vehicle_wait;
    cur.count += 1;
    sums.set(k, cur);
  }
  for (const [k, { sum, count }] of sums.entries()) {
    histByPort.set(k, Math.round(sum / count));
  }

  const fcByPort = new Map<string, ForecastResult>();
  for (const fc of forecasts) fcByPort.set(fc.port_id, fc);

  const rows: PortRow[] = COVERED_PORT_IDS.map((pid) => {
    const meta = PORT_META[pid];
    const live = liveByPort.get(pid);
    const fc = fcByPort.get(pid);
    const histAvg = histByPort.get(pid) ?? null;
    const liveWait = live?.wait ?? null;

    let status: PortRow["anomaly_status"] = "normal";
    let pctAbove: number | null = null;
    if (liveWait == null) status = "no_reading";
    else if (histAvg == null || histAvg <= 0) status = "no_baseline";
    else {
      const ratio = liveWait / histAvg;
      pctAbove = Math.round((ratio - 1) * 100);
      if (ratio >= 1.5) status = "anomaly_high";
      else if (ratio <= 0.67) status = "anomaly_low";
    }

    return {
      port_id: pid,
      name: meta?.localName || meta?.city || pid,
      region: meta?.region || "",
      city: meta?.city || "",
      current_wait_min: liveWait,
      recorded_at: live?.recorded ?? null,
      forecast_6h_min: fc ? Math.round(fc.prediction_min) : null,
      forecast_lift_cbp_pct: fc?.lift_vs_cbp_climatology_pct ?? null,
      forecast_concept_drift: fc?.lift_vs_cbp_climatology_pct != null && fc.lift_vs_cbp_climatology_pct < 0,
      hist_avg_min: histAvg,
      anomaly_status: status,
      anomaly_pct_above: pctAbove,
    };
  });

  return {
    rows,
    generated_at: now.toISOString(),
    v04_available: forecasts.length > 0,
  };
}

async function fetchForecastsAll(): Promise<ForecastResult[]> {
  const url = process.env.CRUZAR_INSIGHTS_API_URL;
  const key = process.env.CRUZAR_INSIGHTS_API_KEY;
  if (!url || !key) return [];
  const calls = COVERED_PORT_IDS.map((pid) =>
    fetch(`${url.replace(/\/$/, "")}/api/forecast`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ port_id: pid, horizon_min: 360 }),
      cache: "no-store",
    }).then((r) => (r.ok ? r.json() as Promise<ForecastResult> : null)).catch(() => null),
  );
  const out = await Promise.all(calls);
  return out.filter((x): x is ForecastResult => x != null);
}

function waitColor(min: number | null): string {
  if (min == null) return "rgba(255,255,255,0.35)";
  if (min <= 20) return "#22c55e";
  if (min <= 45) return "#f59e0b";
  return "#ef4444";
}

function statusBadge(status: PortRow["anomaly_status"], pctAbove: number | null): string | null {
  if (status === "anomaly_high") return `+${pctAbove}% vs typical`;
  if (status === "anomaly_low") return `${pctAbove}% vs typical (lighter)`;
  return null;
}

export const metadata = {
  title: "Live RGV border crossing — what's happening right now | Cruzar",
  description: "The DURING moment. Real-time RGV wait times, anomaly badges, and 6-hour ML forecasts for 8 crossings. Auto-refreshes every 60s. Pair with /insights for planning ahead and /memory for your post-crossing log.",
  alternates: { canonical: "https://www.cruzar.app/live" },
};

export default async function LivePage() {
  const state = await fetchLiveState();
  const ldjson = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "name": "RGV border wait-time forecasts",
    "description": "Real-time wait times + 6-hour ML forecasts for US-Mexico border crossings in the Rio Grande Valley.",
    "url": "https://www.cruzar.app/live",
    "dateModified": state.generated_at,
    "creator": { "@type": "Organization", "name": "Cruzar Insights" },
  };

  const anomalyHighCount = state.rows.filter((r) => r.anomaly_status === "anomaly_high").length;
  const anomalyLowCount = state.rows.filter((r) => r.anomaly_status === "anomaly_low").length;

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "white", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif' }}>
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta httpEquiv="refresh" content="60" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldjson) }} />
      </head>
      <MomentsNav current="during" />
      <main style={{ maxWidth: 880, margin: "0 auto", padding: "24px 16px 48px" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fbbf24", margin: "0 0 6px" }}>
          During · Ahorita
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>What&rsquo;s happening at the border right now</h1>
        <p style={{ color: "rgba(255,255,255,0.65)", margin: "0 0 8px" }}>
          Live waits, anomaly badges, and 6-hour ML forecast for 8 RGV crossings. Auto-refreshes every 60s.
        </p>
        <p style={{ color: "rgba(255,255,255,0.45)", margin: "0 0 16px", fontSize: 13 }}>
          Updated {new Date(state.generated_at).toLocaleString()}
          {!state.v04_available && " · ⚠️ ML forecast offline (showing live + historical only)"}
        </p>

        {/* "During"-moment summary band — actionable verdict at the top */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
          background: anomalyHighCount > 0 ? "rgba(239,68,68,0.10)" : anomalyLowCount > 0 ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${anomalyHighCount > 0 ? "rgba(239,68,68,0.35)" : anomalyLowCount > 0 ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.10)"}`,
          borderRadius: 16, padding: "12px 14px", margin: "0 0 22px",
        }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            {anomalyHighCount > 0
              ? `🚨 ${anomalyHighCount} crossing${anomalyHighCount > 1 ? "s" : ""} running high right now`
              : anomalyLowCount > 0
                ? `🟢 ${anomalyLowCount} crossing${anomalyLowCount > 1 ? "s" : ""} lighter than typical`
                : "All crossings within their typical range"}
          </span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
            {anomalyHighCount > 0
              ? "If you&rsquo;re crossing now, scroll for the bridge that&rsquo;s clearest."
              : "Use the 6-hour forecast column to time your crossing."}
          </span>
        </div>

        {/* Cross-link to BEFORE moment — helps users who landed here while still planning */}
        <Link
          href="/insights"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 999, padding: "6px 12px", margin: "0 0 18px",
            fontSize: 12, color: "rgba(255,255,255,0.85)", textDecoration: "none",
          }}
        >
          ← Planning ahead? See the BEFORE-moment forecast
        </Link>

        <div style={{ display: "grid", gap: 12 }}>
          {state.rows.map((r) => {
            const badge = statusBadge(r.anomaly_status, r.anomaly_pct_above);
            const trendDelta = r.current_wait_min != null && r.forecast_6h_min != null
              ? r.forecast_6h_min - r.current_wait_min
              : null;
            return (
              <div key={r.port_id} style={{
                background: "rgba(255,255,255,0.05)",
                borderLeft: `4px solid ${waitColor(r.current_wait_min)}`,
                borderRadius: 16,
                padding: "16px 18px",
                border: "1px solid rgba(255,255,255,0.10)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{r.region}</div>
                  </div>
                  {badge && (
                    <span style={{
                      fontSize: 12,
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: r.anomaly_status === "anomaly_high" ? "rgba(239,68,68,0.18)" : "rgba(34,197,94,0.18)",
                      color: r.anomaly_status === "anomaly_high" ? "#fca5a5" : "#86efac",
                    }}>{badge}</span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.4 }}>Now</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: waitColor(r.current_wait_min) }}>
                      {r.current_wait_min != null ? `${r.current_wait_min}` : "—"}
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginLeft: 4 }}>min</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.4 }}>+6h forecast</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: r.forecast_6h_min != null ? waitColor(r.forecast_6h_min) : "rgba(255,255,255,0.35)" }}>
                      {r.forecast_6h_min != null ? `${r.forecast_6h_min}` : "—"}
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginLeft: 4 }}>min</span>
                    </div>
                    {trendDelta != null && (
                      <div style={{ fontSize: 12, color: trendDelta > 0 ? "#fca5a5" : trendDelta < 0 ? "#86efac" : "rgba(255,255,255,0.5)" }}>
                        {trendDelta > 0 ? "↑" : trendDelta < 0 ? "↓" : "→"} {Math.abs(trendDelta)} min
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.4 }}>Typical now</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>
                      {r.hist_avg_min != null ? `${r.hist_avg_min}` : "—"}
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginLeft: 4 }}>min</span>
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>90d DOW × hour avg</div>
                  </div>
                </div>
                {r.forecast_concept_drift && (
                  <div style={{ marginTop: 10, fontSize: 11, color: "#fca5a5", padding: "6px 10px", background: "rgba(239,68,68,0.10)", borderRadius: 8 }}>
                    ⚠️ Forecast accuracy currently degraded for this port (concept drift detected)
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <footer style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
          Source: Cruzar wait_time_readings (CBP scrape, 15-min cadence) + Cruzar Insights v0.4 RandomForest forecast.
          {" "}Backtested 6h horizon vs CBP climatology baseline: Laredo WTB +16.5%, Brownsville Veterans +18.1%, Hidalgo +6.4%.
          {" "}<a href="https://www.cruzar.app/mcp" style={{ color: "#86efac" }}>Programmatic access via MCP</a>.
        </footer>
      </main>
    </div>
  );
}
