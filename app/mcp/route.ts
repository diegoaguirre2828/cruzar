// Cruzar MCP server — exposes border wait-time data + smart routing to
// AI clients (Claude Desktop / Code, Cursor, etc.) over HTTP at /mcp.
//
// Tools:
//   cruzar_smart_route(lat, lng, direction?)
//     Ranks RGV crossings by total time = wait + drive distance from origin.
//     Returns top 5. Heuristic baseline; v0.4 model swap is Path B (separate).
//   cruzar_live_wait(port_id?)
//     Current blended wait time for one port, or all RGV ports if omitted.
//   cruzar_best_times(port_ids, day?, hour?)
//     Historical-average wait by day/hour for one or more ports.
//   cruzar_briefing(port_id)
//     Markdown summary: current wait, historical baseline, anomaly flag,
//     "best window today" recommendation. The broker decision artifact.
//
// Auth: Bearer CRUZAR_MCP_KEY in Authorization header.
// Transport: stateless Streamable HTTP, JSON-only responses (no SSE).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase";
import { PORT_META } from "@/lib/portMeta";
import { SAFETY_SCRIPTS, type EmergencyKind } from "@/lib/safetyScripts";
import { generateDeclaration, type DeclarationInput } from "@/lib/customsForms";
import {
  getAllYards,
  getYardsByMegaRegion,
  getYardsByPort,
  scrapedAt as transloadScrapedAt,
  totalYardCount as transloadCount,
} from "@/lib/transloadYards";
import type { MegaRegion } from "@/lib/portMeta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function originFromRequest(req: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
}

interface V04Forecast {
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
}

async function forecastV04(portId: string, horizonMin: number): Promise<V04Forecast | { error: string }> {
  const url = process.env.CRUZAR_INSIGHTS_API_URL;
  const key = process.env.CRUZAR_INSIGHTS_API_KEY;
  if (!url || !key) return { error: "v0.4 inference API not configured (CRUZAR_INSIGHTS_API_URL/_KEY missing)" };
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/api/forecast`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ port_id: portId, horizon_min: horizonMin }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { error: `v0.4 API ${res.status}: ${text.slice(0, 200)}` };
    }
    return (await res.json()) as V04Forecast;
  } catch (e) {
    return { error: `v0.4 API call failed: ${(e as Error).message}` };
  }
}

async function smartRoute(lat: number, lng: number, direction: string, limit: number) {
  const db = getServiceClient();
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: latest } = await db
    .from("wait_time_readings")
    .select("port_id, vehicle_wait, sentri_wait, pedestrian_wait, commercial_wait, recorded_at")
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: false })
    .limit(1000);

  const byPort = new Map<string, { wait: number | null; recorded: string }>();
  for (const r of latest || []) {
    if (byPort.has(String(r.port_id))) continue;
    const candidates = [r.vehicle_wait, r.pedestrian_wait, r.commercial_wait, r.sentri_wait]
      .map((v) => (typeof v === "number" && v >= 0 ? v : null))
      .filter((v): v is number => v != null);
    const wait = candidates.length > 0 ? Math.min(...candidates) : null;
    byPort.set(String(r.port_id), { wait, recorded: r.recorded_at });
  }

  return Object.entries(PORT_META)
    .map(([portId, meta]) => {
      const distKm = haversineKm(lat, lng, meta.lat, meta.lng);
      const driveMin = Math.round((distKm / 96.6) * 60);
      const w = byPort.get(portId);
      const waitMin = w?.wait;
      const totalMin = (waitMin ?? 30) + driveMin;
      return {
        port_id: portId,
        name: meta.localName || meta.city,
        city: meta.city,
        region: meta.region,
        megaRegion: meta.megaRegion,
        distKm: Math.round(distKm),
        driveMin,
        waitMin: waitMin ?? null,
        totalMin,
        recorded: w?.recorded ?? null,
        confidence: waitMin != null ? "live" : "no-data",
      };
    })
    .filter((r) => r.distKm <= 400)
    .sort((a, b) => a.totalMin - b.totalMin)
    .slice(0, limit)
    .map((r) => ({ ...r, direction }));
}

async function liveWait(portId: string | undefined) {
  const db = getServiceClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  let q = db
    .from("wait_time_readings")
    .select("port_id, vehicle_wait, sentri_wait, pedestrian_wait, commercial_wait, recorded_at")
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: false })
    .limit(500);
  if (portId) q = q.eq("port_id", portId);
  const { data } = await q;

  const map = new Map<string, { vehicle_wait: number | null; sentri_wait: number | null; pedestrian_wait: number | null; commercial_wait: number | null; recorded_at: string }>();
  for (const r of data || []) {
    const key = String(r.port_id);
    if (map.has(key)) continue;
    map.set(key, r);
  }

  return Array.from(map.entries()).map(([port_id, r]) => ({
    port_id,
    name: PORT_META[port_id]?.localName || PORT_META[port_id]?.city || port_id,
    region: PORT_META[port_id]?.region || null,
    vehicle_wait: r.vehicle_wait,
    sentri_wait: r.sentri_wait,
    pedestrian_wait: r.pedestrian_wait,
    commercial_wait: r.commercial_wait,
    recorded_at: r.recorded_at,
  }));
}

async function bestTimes(portIds: string[], day: number | null, hour: number | null) {
  const db = getServiceClient();
  const sinceIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  let q = db
    .from("wait_time_readings")
    .select("port_id, day_of_week, hour_of_day, vehicle_wait, commercial_wait")
    .in("port_id", portIds)
    .gte("recorded_at", sinceIso);
  if (day !== null) q = q.eq("day_of_week", day);
  if (hour !== null) q = q.eq("hour_of_day", hour);
  q = q.limit(50000);
  const { data } = await q;

  type HourStats = { vehicle: number[]; commercial: number[] };
  const acc: Record<string, Record<string, Record<number, HourStats>>> = {};
  for (const row of data || []) {
    const pid = String(row.port_id);
    if (!acc[pid]) acc[pid] = {};
    const dKey = String(row.day_of_week);
    if (!acc[pid][dKey]) acc[pid][dKey] = {};
    if (!acc[pid][dKey][row.hour_of_day]) acc[pid][dKey][row.hour_of_day] = { vehicle: [], commercial: [] };
    if (row.vehicle_wait !== null) acc[pid][dKey][row.hour_of_day].vehicle.push(row.vehicle_wait);
    if (row.commercial_wait !== null) acc[pid][dKey][row.hour_of_day].commercial.push(row.commercial_wait);
  }
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((s, v) => s + v, 0) / a.length) : null);

  const out: Record<string, { day: number; hour: number; vehicle_avg: number | null; commercial_avg: number | null; samples: number }[]> = {};
  for (const [pid, dayMap] of Object.entries(acc)) {
    const rows: { day: number; hour: number; vehicle_avg: number | null; commercial_avg: number | null; samples: number }[] = [];
    for (const [dKey, hourMap] of Object.entries(dayMap)) {
      for (const [hKey, stats] of Object.entries(hourMap)) {
        rows.push({
          day: parseInt(dKey),
          hour: parseInt(hKey),
          vehicle_avg: avg(stats.vehicle),
          commercial_avg: avg(stats.commercial),
          samples: Math.max(stats.vehicle.length, stats.commercial.length),
        });
      }
    }
    out[pid] = rows.sort((a, b) => a.day - b.day || a.hour - b.hour);
  }
  return out;
}

interface RouteRecommendation {
  rank: number;
  port_id: string;
  name: string;
  city: string;
  region: string;
  drive_km: number;
  drive_min: number;
  arrival_min_from_now: number;
  current_wait_min: number | null;
  forecast_6h_min: number | null;
  forecast_24h_min: number | null;
  predicted_wait_at_arrival_min: number;
  predicted_wait_basis: string;
  total_eta_min: number;
  forecast_lift_vs_cbp_pct: number | null;
  forecast_concept_drift_warn: boolean;
  current_recorded_at: string | null;
}

async function recommendRoute(
  lat: number,
  lng: number,
  direction: string,
  departureOffsetMin: number,
  candidatePool: number,
): Promise<RouteRecommendation[]> {
  const candidates = await smartRoute(lat, lng, direction, candidatePool);
  // Fetch v0.4 6h + 24h forecasts in parallel for every candidate
  const forecasts = await Promise.all(
    candidates.flatMap((c) => [
      forecastV04(c.port_id, 360),
      forecastV04(c.port_id, 1440),
    ]),
  );
  const results: RouteRecommendation[] = candidates.map((c, i) => {
    const fc6 = forecasts[i * 2];
    const fc24 = forecasts[i * 2 + 1];
    const v6 = "error" in fc6 ? null : fc6.prediction_min;
    const v24 = "error" in fc24 ? null : fc24.prediction_min;
    const liftCbp = "error" in fc6 ? null : fc6.lift_vs_cbp_climatology_pct;
    const arrival = departureOffsetMin + c.driveMin;

    // Pick basis for predicted-wait-at-arrival:
    //   <30min:  use current
    //   30-360:  blend current → 6h linearly
    //   360-720: use 6h
    //   >720:    use 24h (or 6h fallback)
    let predicted: number;
    let basis: string;
    if (arrival < 30 || (v6 == null && v24 == null)) {
      predicted = c.waitMin ?? 30;
      basis = c.waitMin != null ? "current_live_reading" : "no_data_default_30min";
    } else if (arrival < 360 && v6 != null && c.waitMin != null) {
      const w = Math.max(0, Math.min(1, (arrival - 30) / (360 - 30)));
      predicted = Math.round((1 - w) * c.waitMin + w * v6);
      basis = `blend_current_to_6h_w=${w.toFixed(2)}`;
    } else if (arrival < 720 && v6 != null) {
      predicted = Math.round(v6);
      basis = "v0.4_6h_forecast";
    } else if (v24 != null) {
      predicted = Math.round(v24);
      basis = "v0.4_24h_forecast";
    } else if (v6 != null) {
      predicted = Math.round(v6);
      basis = "v0.4_6h_forecast_24h_unavailable";
    } else {
      predicted = c.waitMin ?? 30;
      basis = "fallback_current_or_default";
    }

    return {
      rank: 0,
      port_id: c.port_id,
      name: c.name,
      city: c.city,
      region: c.region,
      drive_km: c.distKm,
      drive_min: c.driveMin,
      arrival_min_from_now: arrival,
      current_wait_min: c.waitMin,
      forecast_6h_min: v6,
      forecast_24h_min: v24,
      predicted_wait_at_arrival_min: predicted,
      predicted_wait_basis: basis,
      total_eta_min: c.driveMin + predicted + departureOffsetMin,
      forecast_lift_vs_cbp_pct: liftCbp,
      forecast_concept_drift_warn: liftCbp != null && liftCbp < 0,
      current_recorded_at: c.recorded,
    };
  });

  results.sort((a, b) => a.total_eta_min - b.total_eta_min);
  results.forEach((r, i) => { r.rank = i + 1; });
  return results;
}

async function anomalyNow(portId: string) {
  const meta = PORT_META[portId];
  if (!meta) return { error: `Unknown port_id "${portId}"` };
  const now = new Date();
  const dow = now.getDay();
  const hour = now.getHours();
  const [live, hist] = await Promise.all([
    liveWait(portId),
    bestTimes([portId], dow, hour),
  ]);
  const livePort = live[0];
  const histRow = (hist[portId] || [])[0];
  const liveWaitMin = livePort?.vehicle_wait ?? null;
  const histAvg = histRow?.vehicle_avg ?? null;
  if (liveWaitMin == null) {
    return {
      port_id: portId, name: meta.localName || meta.city,
      status: "no_recent_reading",
      live_wait_min: null, historical_avg_min: histAvg,
    };
  }
  if (histAvg == null || histAvg <= 0) {
    return {
      port_id: portId, name: meta.localName || meta.city,
      status: "no_baseline",
      live_wait_min: liveWaitMin, historical_avg_min: null,
    };
  }
  const ratio = liveWaitMin / histAvg;
  let status: "anomaly_high" | "anomaly_low" | "normal";
  if (ratio >= 1.5) status = "anomaly_high";
  else if (ratio <= 0.67) status = "anomaly_low";
  else status = "normal";
  return {
    port_id: portId,
    name: meta.localName || meta.city,
    region: meta.region,
    status,
    live_wait_min: liveWaitMin,
    historical_avg_min: histAvg,
    ratio: Math.round(ratio * 100) / 100,
    delta_min: liveWaitMin - histAvg,
    pct_above_baseline: Math.round((ratio - 1) * 100),
    recorded_at: livePort.recorded_at,
    threshold: { high: 1.5, low: 0.67 },
  };
}

async function comparePorts(portIds: string[], horizonMin: number) {
  const fcs = await Promise.all(portIds.map((pid) => forecastV04(pid, horizonMin)));
  return portIds.map((pid, i) => {
    const fc = fcs[i];
    const meta = PORT_META[pid];
    if ("error" in fc) {
      return {
        port_id: pid, name: meta?.localName || meta?.city || pid,
        error: fc.error,
      };
    }
    return {
      port_id: pid,
      name: fc.port_name,
      region: meta?.region ?? null,
      forecast_min: fc.prediction_min,
      horizon_min: horizonMin,
      rmse_min: fc.rmse_min,
      lift_vs_cbp_pct: fc.lift_vs_cbp_climatology_pct,
      lift_vs_persistence_pct: fc.lift_vs_persistence_pct,
      concept_drift_warn: fc.lift_vs_cbp_climatology_pct != null && fc.lift_vs_cbp_climatology_pct < 0,
    };
  }).sort((a, b) => {
    const af = ("forecast_min" in a && a.forecast_min != null) ? a.forecast_min : Number.POSITIVE_INFINITY;
    const bf = ("forecast_min" in b && b.forecast_min != null) ? b.forecast_min : Number.POSITIVE_INFINITY;
    return af - bf;
  });
}

async function briefing(portId: string): Promise<string> {
  const meta = PORT_META[portId];
  if (!meta) return `Unknown port_id "${portId}".`;
  const portName = meta.localName || meta.city;
  const now = new Date();
  const dow = now.getDay();
  const hour = now.getHours();

  const [live, hist, fc6h] = await Promise.all([
    liveWait(portId),
    bestTimes([portId], dow, null),
    forecastV04(portId, 360),
  ]);

  const livePort = live[0];
  const histRows = hist[portId] || [];
  const currentHistAvg = histRows.find((r) => r.hour === hour)?.vehicle_avg ?? null;
  const liveVehicle = livePort?.vehicle_wait ?? null;

  let anomaly: string | null = null;
  if (liveVehicle !== null && currentHistAvg !== null && currentHistAvg > 0) {
    const ratio = liveVehicle / currentHistAvg;
    if (ratio >= 1.5) anomaly = `+${Math.round((ratio - 1) * 100)}% vs typical for this hour`;
    else if (ratio <= 0.5) anomaly = `-${Math.round((1 - ratio) * 100)}% vs typical (lighter than usual)`;
  }

  const remainingHours = histRows.filter((r) => r.hour > hour && r.vehicle_avg !== null);
  const bestUpcoming = remainingHours.sort((a, b) => (a.vehicle_avg ?? 999) - (b.vehicle_avg ?? 999))[0];

  const lines: string[] = [];
  lines.push(`# ${portName} (${meta.region}) — wait briefing`);
  lines.push(`Generated ${now.toISOString()}`);
  lines.push("");
  lines.push("## Right now");
  if (liveVehicle === null) lines.push("- No fresh CBP reading in the last hour.");
  else {
    lines.push(`- Vehicle wait: **${liveVehicle} min** (recorded ${livePort.recorded_at})`);
    if (livePort.sentri_wait !== null) lines.push(`- SENTRI: ${livePort.sentri_wait} min`);
    if (livePort.pedestrian_wait !== null) lines.push(`- Pedestrian: ${livePort.pedestrian_wait} min`);
    if (livePort.commercial_wait !== null) lines.push(`- Commercial: ${livePort.commercial_wait} min`);
  }
  lines.push("");
  lines.push("## Historical baseline");
  if (currentHistAvg === null) lines.push("- Not enough history for this DOW × hour yet.");
  else lines.push(`- Typical vehicle wait at this hour on this day-of-week: **${currentHistAvg} min**`);
  if (anomaly) lines.push(`- **Anomaly:** ${anomaly}`);
  lines.push("");
  lines.push("## 6-hour forecast (v0.4 ML)");
  if ("error" in fc6h) {
    lines.push(`- _Forecast unavailable: ${fc6h.error}_`);
  } else {
    const liftCbp = fc6h.lift_vs_cbp_climatology_pct;
    const liftPersist = fc6h.lift_vs_persistence_pct;
    lines.push(`- Predicted vehicle wait at +6h: **${fc6h.prediction_min} min**`);
    lines.push(`- Backtest RMSE: ${fc6h.rmse_min} min` +
      (liftCbp !== null ? ` (${liftCbp >= 0 ? "+" : ""}${liftCbp}% vs CBP climatology baseline)` : "") +
      (liftPersist !== null ? `, ${liftPersist >= 0 ? "+" : ""}${liftPersist}% vs persistence` : ""));
    if (liftCbp !== null && liftCbp < 0) {
      lines.push(`- ⚠️ This crossing currently underperforms the CBP baseline at 6h — concept drift (Pharr-Reynosa pattern). Use with caution.`);
    }
  }
  lines.push("");
  lines.push("## Best remaining window today (historical)");
  if (!bestUpcoming) lines.push("- No more good windows today (or insufficient data).");
  else lines.push(`- Hour ${bestUpcoming.hour}:00 looks lightest historically (${bestUpcoming.vehicle_avg} min avg, n=${bestUpcoming.samples}).`);
  lines.push("");
  lines.push("_Source: Cruzar wait_time_readings (CBP scrape, 15-min cadence) + v0.4 ML forecast (RandomForest, 8 RGV ports × 2 horizons)._");
  return lines.join("\n");
}

function buildServer(): McpServer {
  const server = new McpServer(
    { name: "cruzar-insights", version: "0.1.0" },
    {
      instructions: [
        "Cruzar Insights exposes US-MX border wait-time data and routing for the RGV corridor.",
        "Use cruzar_smart_route to pick the fastest crossing from a coordinate.",
        "Use cruzar_live_wait for current readings.",
        "Use cruzar_best_times for historical DOW × hour averages.",
        "Use cruzar_forecast for the v0.4 RandomForest ML prediction at a 6h or 24h horizon.",
        "Use cruzar_recommend_route for the FULL dispatcher decision: ranked crossings with predicted wait at the driver's actual arrival time, given drive distance + departure offset.",
        "Use cruzar_anomaly_now to check if a port is currently >1.5× or <0.67× its DOW × hour baseline (broker red-flag signal).",
        "Use cruzar_compare_ports for a side-by-side v0.4 forecast across multiple ports at a single horizon.",
        "Use cruzar_briefing for a one-shot markdown decision summary on a single port (live + historical + v0.4 forecast — best for dispatcher / broker workflows).",
        "Use cruzar_history to pull raw recent wait readings for a port over the last N days (max 14) for power users who want the underlying time series, not a summary.",
        "Use cruzar_load_eta for the dispatcher decision: load-tagged ETA-to-dock + P(make appointment) + detention $ exposure given origin, dock, appointment time.",
        "Use cruzar_safety_script for bilingual EN/ES emergency scripts (secondary inspection, vehicle breakdown, accident, lost SENTRI, document seizure, medical) — Cruzar Safety Net (Pillar 6) playbook.",
        "Use cruzar_generate_customs to compute a CBP 7501 / pedimento / IMMEX declaration draft with USMCA duty math and compliance warnings.",
        "Use cruzar_anomaly_camera_recent to read recent bridge-camera frames captured when a port crossed the 1.5× anomaly threshold.",
        "Use cruzar_transload_yards to find named transload, warehousing, distribution, freight-terminal, logistics-office, and freight-forwarding facilities within 50km of any US-MX port-of-entry. OSM-sourced; sparse in TX, dense in CA/Baja.",
      ].join(" "),
    },
  );

  server.registerTool(
    "cruzar_smart_route",
    {
      title: "Pick fastest border crossing from a coordinate",
      description: "Ranks RGV crossings by total time = current wait + drive distance from origin lat/lng. Returns top 5 by default. Heuristic baseline.",
      inputSchema: {
        lat: z.number().describe("Origin latitude (US-MX corridor: 14-50)"),
        lng: z.number().describe("Origin longitude (US-MX corridor: -125 to -85)"),
        direction: z.enum(["northbound", "southbound"]).default("northbound"),
        limit: z.number().int().min(1).max(10).default(5),
      },
    },
    async ({ lat, lng, direction, limit }) => {
      if (lat < 14 || lat > 50 || lng < -125 || lng > -85) {
        return {
          content: [{ type: "text", text: "Error: lat/lng out of US-MX corridor range" }],
          isError: true,
        };
      }
      const routes = await smartRoute(lat, lng, direction, limit);
      return {
        structuredContent: { routes, ranked_at: new Date().toISOString() },
        content: [{ type: "text", text: JSON.stringify({ routes }, null, 2) }],
      };
    },
  );

  server.registerTool(
    "cruzar_live_wait",
    {
      title: "Current wait time at a port (or all RGV ports)",
      description: "Returns the most recent CBP reading for a single port_id, or for all RGV ports if port_id is omitted. Includes vehicle/SENTRI/pedestrian/commercial lanes.",
      inputSchema: {
        port_id: z.string().optional().describe("Cruzar port_id (e.g. '230501' = Hidalgo). Omit to get all ports."),
      },
    },
    async ({ port_id }) => {
      const ports = await liveWait(port_id);
      return {
        structuredContent: { ports, fetched_at: new Date().toISOString() },
        content: [{ type: "text", text: JSON.stringify({ ports }, null, 2) }],
      };
    },
  );

  server.registerTool(
    "cruzar_best_times",
    {
      title: "Historical wait averages by day-of-week × hour",
      description: "Returns historical average wait per port_id, per day-of-week, per hour, computed over the last 90 days. Filter by specific day (0=Sun..6=Sat) or hour (0-23) to narrow.",
      inputSchema: {
        port_ids: z.array(z.string()).min(1).max(25).describe("List of Cruzar port_ids"),
        day: z.number().int().min(0).max(6).optional().describe("Day of week (0=Sun, 6=Sat). Omit for all days."),
        hour: z.number().int().min(0).max(23).optional().describe("Hour of day (0-23). Omit for all hours."),
      },
    },
    async ({ port_ids, day, hour }) => {
      const result = await bestTimes(port_ids, day ?? null, hour ?? null);
      return {
        structuredContent: { results: result },
        content: [{ type: "text", text: JSON.stringify({ results: result }, null, 2) }],
      };
    },
  );

  server.registerTool(
    "cruzar_recommend_route",
    {
      title: "Dispatcher decision tool — pick the best border crossing for a load",
      description:
        "Given an origin (lat/lng), direction, and optional departure time offset, returns ranked candidate crossings with the v0.4 ML-predicted wait at the driver's expected ARRIVAL time at each bridge (not just current wait). Total ETA = drive_min + predicted_wait_at_arrival_min + departure_offset. This is the broker decision artifact: no other product on the market combines drive distance + ML wait forecast at expected arrival.",
      inputSchema: {
        lat: z.number().describe("Origin latitude (US-MX corridor: 14-50)"),
        lng: z.number().describe("Origin longitude (US-MX corridor: -125 to -85)"),
        direction: z.enum(["northbound", "southbound"]).default("northbound"),
        departure_offset_min: z.number().int().min(0).max(1440).default(0).describe("Minutes from now until departure (0 = leaving now). Affects which forecast horizon is used."),
        candidate_pool: z.number().int().min(1).max(10).default(5).describe("How many nearest crossings to evaluate before returning the ranked list (sorted by total_eta_min)."),
      },
    },
    async ({ lat, lng, direction, departure_offset_min, candidate_pool }) => {
      if (lat < 14 || lat > 50 || lng < -125 || lng > -85) {
        return { content: [{ type: "text", text: "Error: lat/lng out of US-MX corridor range" }], isError: true };
      }
      const recs = await recommendRoute(lat, lng, direction, departure_offset_min, candidate_pool);
      return {
        structuredContent: { recommendations: recs, ranked_at: new Date().toISOString() },
        content: [{ type: "text", text: JSON.stringify({ recommendations: recs }, null, 2) }],
      };
    },
  );

  server.registerTool(
    "cruzar_anomaly_now",
    {
      title: "Anomaly detection — is this port running unusually high or low right now?",
      description: "Compares the port's current vehicle wait against the 90-day historical average for this DOW × hour. Returns status (anomaly_high | anomaly_low | normal | no_recent_reading | no_baseline) plus the ratio + delta. Threshold: ≥1.5× = high, ≤0.67× = low.",
      inputSchema: {
        port_id: z.string().describe("Cruzar port_id (e.g. '230402' = Laredo WTB)"),
      },
    },
    async ({ port_id }) => {
      const result = await anomalyNow(port_id);
      return {
        structuredContent: result as unknown as Record<string, unknown>,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "cruzar_compare_ports",
    {
      title: "Compare v0.4 forecasts across multiple ports side-by-side",
      description: "Calls v0.4 forecast for each port_id at the given horizon and returns them sorted by predicted wait (ascending). Useful when a dispatcher has flexibility on which corridor to use and wants to see the forecast horse race.",
      inputSchema: {
        port_ids: z.array(z.string()).min(1).max(13).describe("List of Cruzar port_ids to compare. 13 supported: 230501, 230502, 230503, 230402, 230401, 230301, 535502, 535501, 535503, 230701, 230901, 230902, 231001."),
        horizon_min: z.union([z.literal(360), z.literal(1440)]).default(360).describe("Forecast horizon: 360 (6h) or 1440 (24h)"),
      },
    },
    async ({ port_ids, horizon_min }) => {
      const result = await comparePorts(port_ids, horizon_min);
      return {
        structuredContent: { comparison: result, horizon_min, ranked_at: new Date().toISOString() },
        content: [{ type: "text", text: JSON.stringify({ comparison: result }, null, 2) }],
      };
    },
  );

  server.registerTool(
    "cruzar_forecast",
    {
      title: "v0.4 ML forecast for a port (6h or 24h horizon)",
      description: "Calls the Cruzar Insights v0.4 RandomForest model for a single port at a 6h or 24h horizon. Returns prediction + backtest RMSE + lift vs CBP-climatology and persistence baselines. 13 RGV ports supported (Hidalgo, Pharr, Anzalduas, Laredo WTB, Laredo I, Eagle Pass, Brownsville Veterans / Los Tomates, Brownsville Gateway, Rio Grande City, Progreso, Donna, Roma, Brownsville Los Indios). Drift-affected ports (negative lift_vs_cbp) auto-fall-back to CBP climatology baseline; response includes degraded:true + fallback_basis. Models retrained weekly (Sundays 06:00 UTC).",
      inputSchema: {
        port_id: z.string().describe("Cruzar port_id (e.g. '230402' = Laredo WTB)"),
        horizon_min: z.union([z.literal(360), z.literal(1440)]).default(360).describe("Forecast horizon in minutes: 360 (6h, headline) or 1440 (24h)"),
      },
    },
    async ({ port_id, horizon_min }) => {
      const fc = await forecastV04(port_id, horizon_min);
      if ("error" in fc) {
        return {
          content: [{ type: "text", text: `Error: ${fc.error}` }],
          isError: true,
        };
      }
      return {
        structuredContent: fc as unknown as Record<string, unknown>,
        content: [{ type: "text", text: JSON.stringify(fc, null, 2) }],
      };
    },
  );

  server.registerTool(
    "cruzar_briefing",
    {
      title: "One-shot markdown wait briefing for a port",
      description: "The broker decision artifact: current wait + historical baseline + anomaly flag (>+50% or <-50%) + best remaining window today. Returns markdown.",
      inputSchema: {
        port_id: z.string().describe("Cruzar port_id (e.g. '230402' = Laredo World Trade Bridge)"),
      },
    },
    async ({ port_id }) => {
      const md = await briefing(port_id);
      return { content: [{ type: "text", text: md }] };
    },
  );

  server.registerTool(
    "cruzar_history",
    {
      title: "Raw recent wait readings for a port",
      description:
        "Returns the underlying time series of CBP wait readings for one port over the last N days (max 14). Use when the briefing/forecast summary isn't enough and you need to see the actual recorded values yourself — e.g. spotting a multi-day pattern, debugging an anomaly, or computing your own statistic. Returns ascending by recorded_at.",
      inputSchema: {
        port_id: z.string().describe("Cruzar port_id (e.g. '230402' = Laredo WTB)"),
        days: z.number().int().min(1).max(14).default(3).describe("How many days back to pull. Default 3, max 14."),
        limit: z.number().int().min(1).max(2000).default(500).describe("Max rows to return. Default 500, max 2000."),
      },
    },
    async ({ port_id, days, limit }) => {
      const meta = PORT_META[port_id];
      if (!meta) {
        return { content: [{ type: "text", text: `Error: unknown port_id "${port_id}"` }], isError: true };
      }
      const db = getServiceClient();
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await db
        .from("wait_time_readings")
        .select("recorded_at, vehicle_wait, sentri_wait, pedestrian_wait, commercial_wait, source")
        .eq("port_id", port_id)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: true })
        .limit(limit);
      if (error) {
        return { content: [{ type: "text", text: `DB error: ${error.message}` }], isError: true };
      }
      const result = {
        port_id,
        name: meta.localName || meta.city,
        region: meta.region,
        days,
        rows: data ?? [],
        count: data?.length ?? 0,
        fetched_at: new Date().toISOString(),
      };
      return {
        structuredContent: result as unknown as Record<string, unknown>,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "cruzar_safety_script",
    {
      title: "Bilingual emergency script for a border-crossing situation",
      description:
        "Returns step-by-step bilingual (EN/ES) guidance for a specific emergency kind a border traveler may face: secondary_inspection, vehicle_breakdown, accident, lost_sentri, document_seizure, medical, other. Includes ready-phrases the user can read aloud + key hotlines (911 both sides, Mexico Green Angels, US Embassy MX, MX Consulate). Drawn from Cruzar's Safety Net (Pillar 6) playbook — no AI inference, the scripts are static and reviewed.",
      inputSchema: {
        kind: z.enum([
          "secondary_inspection","vehicle_breakdown","accident",
          "lost_sentri","document_seizure","medical","other",
        ]).describe("Type of emergency"),
      },
    },
    async ({ kind }) => {
      const s = SAFETY_SCRIPTS[kind as EmergencyKind];
      return {
        structuredContent: s as unknown as Record<string, unknown>,
        content: [{ type: "text", text: JSON.stringify(s, null, 2) }],
      };
    },
  );

  server.registerTool(
    "cruzar_generate_customs",
    {
      title: "Generate a customs declaration draft (CBP 7501 / pedimento / IMMEX)",
      description:
        "Compute-only customs declaration generator. Given importer + exporter + line items with HS codes, returns structured payload + bilingual markdown + duty calculation + USMCA savings. NOT a filing — broker review required. Returns warnings for missing EIN, 10-digit HTS, or USMCA criterion gaps. Form types: cbp_7501, pace, padv, immex_manifest, generic_invoice. Does NOT persist to the user's account.",
      inputSchema: {
        form_type: z.enum(["cbp_7501","pace","padv","immex_manifest","generic_invoice"]).describe("Customs form type"),
        lane: z.string().describe("Lane / port (e.g. 'Laredo WTB northbound')"),
        importer_name: z.string(),
        importer_ein: z.string().optional(),
        exporter_name: z.string(),
        origin_country: z.string().length(2).default("MX"),
        destination_country: z.string().length(2).default("US"),
        fta_claimed: z.enum(["USMCA","GSP","CBI","NONE"]).default("USMCA"),
        currency: z.string().length(3).default("USD"),
        hs_codes: z.array(z.object({
          hs_code: z.string().describe("HTS classification — 10-digit for CBP 7501, 8-digit for MX"),
          description: z.string(),
          qty: z.number().positive(),
          unit: z.string().default("EA"),
          unit_value_usd: z.number().min(0),
          origin_country: z.string().length(2).default("MX"),
          fta_eligible: z.boolean().optional(),
          fta_criterion: z.enum(["A","B","C","D"]).optional(),
          rvc_pct: z.number().min(0).max(100).optional(),
        })).min(1),
      },
    },
    async (args) => {
      const out = generateDeclaration(args as DeclarationInput);
      const result = {
        markdown: out.markdown,
        warnings: out.warnings,
        totals: out.payload.calculated,
        disclaimer: "Broker-grade draft, not a filing. Verify HTS + duty rates with a licensed customs broker before submitting through ACE/SAAI.",
      };
      return {
        structuredContent: result as unknown as Record<string, unknown>,
        content: [{ type: "text", text: out.markdown }],
      };
    },
  );

  server.registerTool(
    "cruzar_anomaly_camera_recent",
    {
      title: "Recent anomaly-triggered bridge camera frames",
      description:
        "Returns the most recent anomaly_camera_events rows (ports flagged with live wait ≥ 1.5× DOW × hour baseline). Each row includes port_id, anomaly ratio, captured frame URL (if camera was reachable), and source. Useful for AI-driven intelligence loops that want to combine wait-spike alerts with visual confirmation. Pull-only; cron writes the rows.",
      inputSchema: {
        port_id: z.string().optional().describe("Filter to a single port. Omit for all ports."),
        hours: z.number().int().min(1).max(72).default(24).describe("Look-back window in hours."),
        limit: z.number().int().min(1).max(200).default(50),
      },
    },
    async ({ port_id, hours, limit }) => {
      const db = getServiceClient();
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      let q = db
        .from("anomaly_camera_events")
        .select("id, port_id, anomaly_kind, ratio, live_wait_min, baseline_min, frame_blob_url, camera_source, triggered_at, notes")
        .gte("triggered_at", since)
        .order("triggered_at", { ascending: false })
        .limit(limit);
      if (port_id) q = q.eq("port_id", port_id);
      const { data, error } = await q;
      if (error) return { content: [{ type: "text", text: `DB error: ${error.message}` }], isError: true };
      const result = { rows: data ?? [], count: data?.length ?? 0, fetched_at: new Date().toISOString() };
      return {
        structuredContent: result as unknown as Record<string, unknown>,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "cruzar_load_eta",
    {
      title: "Load-tagged ETA-to-dock + detention risk",
      description:
        "THE dispatcher decision tool. Given a truck origin, dock destination, and appointment time, picks the bridge that maximizes P(make appointment), forecasts predicted-arrival, and surfaces dollar exposure to detention. Internally: HERE truck routing for drive segments, v0.5 ML forecast for wait, normal CDF on RMSE for confidence. Use this for every cross-border load you're dispatching today.",
      inputSchema: {
        origin_lat: z.number().describe("Truck's current/start latitude"),
        origin_lng: z.number().describe("Truck's current/start longitude"),
        dest_lat: z.number().describe("Dock destination latitude"),
        dest_lng: z.number().describe("Dock destination longitude"),
        appointment_at: z.string().describe("Dock appointment ISO timestamp (e.g. '2026-04-28T18:00:00-05:00')"),
        detention_rate_per_hour: z.number().optional().describe("Detention $/hour (default 75)"),
        detention_grace_hours: z.number().optional().describe("Free time before detention starts (default 2.0)"),
        preferred_port_id: z.string().optional().describe("Force a specific bridge (skip auto-pick). 6-digit Cruzar port_id."),
      },
    },
    async ({
      origin_lat, origin_lng, dest_lat, dest_lng, appointment_at,
      detention_rate_per_hour, detention_grace_hours, preferred_port_id,
    }) => {
      try {
        const { computeLoadEta } = await import("@/lib/loadEta");
        const result = await computeLoadEta({
          origin_lat, origin_lng, dest_lat, dest_lng, appointment_at,
          detention_rate_per_hour, detention_grace_hours,
          preferred_port_id: preferred_port_id ?? null,
        });
        return {
          structuredContent: result as unknown as Record<string, unknown>,
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "cruzar_transload_yards",
    {
      title: "Transload yards near a US-MX port-of-entry",
      description:
        "Returns named transload-relevant facilities (warehouses, freight terminals, distribution centers, logistics offices, freight forwarders, truck stops) within a radius of a port-of-entry, OR for an entire megaRegion. Source: OpenStreetMap (ODbL public domain). Cruzar tags each yard to its nearest port by Haversine distance and classifies it into a `kind`. Sparse in TX (Laredo / RGV) where OSM is undertagged; dense in CA / Baja where every Otay Mesa cross-dock has a node.",
      inputSchema: {
        port_id: z
          .string()
          .optional()
          .describe("Cruzar port_id (e.g. '230501'). If set, returns yards within radius_km of this port."),
        megaRegion: z
          .enum(["rgv", "laredo", "coahuila-tx", "el-paso", "sonora-az", "baja"])
          .optional()
          .describe("Filter to a megaRegion. Ignored if port_id is set."),
        radius_km: z
          .number()
          .min(1)
          .max(50)
          .default(25)
          .describe("Used with port_id; max 50."),
        kind: z
          .enum([
            "transhipment",
            "warehouse",
            "distribution_center",
            "freight_terminal",
            "container_terminal",
            "logistics_office",
            "freight_forwarder",
            "truck_stop",
          ])
          .optional()
          .describe("Filter by yard kind."),
      },
    },
    async ({ port_id, megaRegion, radius_km, kind }) => {
      let yards;
      if (port_id) {
        yards = getYardsByPort(port_id, radius_km ?? 25);
      } else if (megaRegion) {
        yards = getYardsByMegaRegion(megaRegion as MegaRegion);
      } else {
        yards = getAllYards();
      }
      if (kind) yards = yards.filter((y) => y.kind === kind);
      const result = {
        scraped_at: transloadScrapedAt(),
        total_in_directory: transloadCount(),
        returned: yards.length,
        yards,
        attribution: "OpenStreetMap contributors (ODbL)",
      };
      return {
        structuredContent: result as unknown as Record<string, unknown>,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  return server;
}

async function authorized(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  // Legacy env-var key — kept for Diego's own integrations / cold-call demos
  const legacy = process.env.CRUZAR_MCP_KEY;
  if (legacy && token === legacy) return true;

  // Self-serve keys live in mcp_keys (hashed). SHA-256 the bearer + look up.
  try {
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256").update(token).digest("hex");
    const db = getServiceClient();
    const { data } = await db
      .from("mcp_keys")
      .select("id, revoked_at")
      .eq("service", "cruzar-insights")
      .eq("key_hash", hash)
      .is("revoked_at", null)
      .maybeSingle();
    if (!data) return false;
    // Touch last_used_at, fire-and-forget
    db.from("mcp_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {}, () => {});
    return true;
  } catch {
    return false;
  }
}

async function handle(req: Request): Promise<Response> {
  if (!(await authorized(req))) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json", "www-authenticate": 'Bearer realm="cruzar-mcp"' },
    });
  }
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = buildServer();
  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function POST(req: Request) { return handle(req); }
export async function GET(req: Request) { return handle(req); }
export async function DELETE(req: Request) { return handle(req); }
