// Shared client for the Cruzar Insights v0.5 forecast inference API.
// Used by app/mcp/route.ts, lib/loadEta.ts, and the weekly retrospective cron.

export interface ForecastResult {
  port_id: string;
  port_name: string;
  horizon_min: number;
  prediction_min: number;
  model: string;
  trained_at: string;
  rmse_min: number;
  lift_vs_persistence_pct: number | null;
  lift_vs_cbp_climatology_pct: number | null;
  now_utc: string;
  recent_count: number;
  degraded?: boolean;
  fallback_basis?: string;
}

export type ForecastResponse = ForecastResult | { error: string };

export async function forecast(portId: string, horizonMin: number): Promise<ForecastResponse> {
  const url = process.env.CRUZAR_INSIGHTS_API_URL;
  const key = process.env.CRUZAR_INSIGHTS_API_KEY;
  if (!url || !key) {
    return { error: "forecast API not configured (CRUZAR_INSIGHTS_API_URL/_KEY missing)" };
  }
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/api/forecast`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ port_id: portId, horizon_min: horizonMin }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { error: `forecast API ${res.status}: ${text.slice(0, 200)}` };
    }
    return (await res.json()) as ForecastResult;
  } catch (e) {
    return { error: `forecast call failed: ${(e as Error).message}` };
  }
}

export function isForecastError(r: ForecastResponse): r is { error: string } {
  return "error" in r;
}
