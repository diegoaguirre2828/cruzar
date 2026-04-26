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

async function briefing(portId: string): Promise<string> {
  const meta = PORT_META[portId];
  if (!meta) return `Unknown port_id "${portId}".`;
  const portName = meta.localName || meta.city;
  const now = new Date();
  const dow = now.getDay();
  const hour = now.getHours();

  const [live, hist] = await Promise.all([
    liveWait(portId),
    bestTimes([portId], dow, null),
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
  lines.push("## Best remaining window today");
  if (!bestUpcoming) lines.push("- No more good windows today (or insufficient data).");
  else lines.push(`- Hour ${bestUpcoming.hour}:00 looks lightest historically (${bestUpcoming.vehicle_avg} min avg, n=${bestUpcoming.samples}).`);
  lines.push("");
  lines.push("_Source: Cruzar wait_time_readings (CBP scrape, 15-min cadence). Heuristic baseline; v0.4 model coming._");
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
        "Use cruzar_briefing for a one-shot markdown decision summary on a single port (best for dispatcher / broker workflows).",
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

  return server;
}

async function authorized(req: Request): Promise<boolean> {
  const expected = process.env.CRUZAR_MCP_KEY;
  if (!expected) return false;
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return token === expected;
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
