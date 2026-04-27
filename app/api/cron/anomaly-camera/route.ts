// Vision Tier 2 — anomaly-triggered bridge camera capture.
//
// Runs every 30 minutes. For each RGV port: compute live-vs-baseline
// ratio. If anomaly_high (>=1.5x), grab one HLS frame, upload to Vercel
// Blob, and write a row to anomaly_camera_events. The /admin/intel
// dashboard reads this for the "what's actually happening at the bridge
// right now" overlay.

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { PORT_META } from "@/lib/portMeta";
import { extractHlsFrame, pickPrimaryFeed } from "@/lib/cameraVision";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const q = req.nextUrl.searchParams.get("secret");
  if (q && q === secret) return true;
  const auth = req.headers.get("authorization") || "";
  return auth.replace(/^Bearer\s+/i, "").trim() === secret;
}

async function evaluatePort(db: ReturnType<typeof getServiceClient>, portId: string): Promise<{
  triggered: boolean;
  ratio: number | null;
  liveWait: number | null;
  baseline: number | null;
}> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: live } = await db
    .from("wait_time_readings")
    .select("vehicle_wait, recorded_at")
    .eq("port_id", portId)
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: false })
    .limit(1);
  const liveWait = typeof live?.[0]?.vehicle_wait === "number" ? live![0].vehicle_wait : null;
  if (liveWait == null) return { triggered: false, ratio: null, liveWait: null, baseline: null };

  const now = new Date();
  const dow = now.getDay();
  const hour = now.getHours();
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: hist } = await db
    .from("wait_time_readings")
    .select("vehicle_wait")
    .eq("port_id", portId)
    .eq("day_of_week", dow)
    .eq("hour_of_day", hour)
    .gte("recorded_at", since90)
    .limit(2000);
  const vals = (hist || []).map((r) => r.vehicle_wait).filter((v): v is number => typeof v === "number");
  if (vals.length < 5) return { triggered: false, ratio: null, liveWait, baseline: null };
  const baseline = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  if (baseline <= 0) return { triggered: false, ratio: null, liveWait, baseline };
  const ratio = liveWait / baseline;
  return { triggered: ratio >= 1.5, ratio, liveWait, baseline };
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getServiceClient();
  const portIds = Object.keys(PORT_META);
  let triggered = 0;
  let captured = 0;
  const events: Array<Record<string, unknown>> = [];

  for (const portId of portIds) {
    const ev = await evaluatePort(db, portId);
    if (!ev.triggered) continue;
    triggered++;

    // Avoid duplicate events: skip if last event for this port < 90min ago.
    const cutoff = new Date(Date.now() - 90 * 60_000).toISOString();
    const { data: recent } = await db
      .from("anomaly_camera_events")
      .select("id")
      .eq("port_id", portId)
      .gte("triggered_at", cutoff)
      .limit(1);
    if (recent && recent.length > 0) continue;

    let frame_blob_url: string | null = null;
    let camera_source: string | null = null;
    try {
      const feed = pickPrimaryFeed(portId);
      if (feed && feed.feed.kind === "hls" && process.env.BLOB_READ_WRITE_TOKEN) {
        const out = await extractHlsFrame(feed.feed.src);
        if (out.ok) {
          const filename = `anomaly-camera/${portId}/${Date.now()}.jpg`;
          const upload = await put(filename, out.jpeg, {
            access: "public",
            contentType: "image/jpeg",
            token: process.env.BLOB_READ_WRITE_TOKEN,
          });
          frame_blob_url = upload.url;
          camera_source = "hls_bridge_feed";
          captured++;
        }
      }
    } catch {/* swallow — log row written either way */}

    const { data: row } = await db
      .from("anomaly_camera_events")
      .insert({
        port_id: portId,
        anomaly_kind: "high",
        ratio: ev.ratio,
        live_wait_min: ev.liveWait,
        baseline_min: ev.baseline,
        frame_blob_url,
        camera_source,
        notes: frame_blob_url ? null : "no camera frame captured",
      })
      .select()
      .single();
    if (row) events.push(row);
  }

  return NextResponse.json({ ports_evaluated: portIds.length, triggered, captured, events });
}
