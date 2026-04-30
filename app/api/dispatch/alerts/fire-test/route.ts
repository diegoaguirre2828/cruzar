// /api/dispatch/alerts/fire-test — preview-and-send a single alert.
//
// POST { email, port_id, threshold_ratio?, force?: boolean }
// 1. Looks up live wait + 90d DOW × hour avg for the port (same logic as
//    the production /api/cron/dispatch-alerts isAnomalyHigh helper)
// 2. If `force=true` OR live ≥ threshold × baseline, runs ALERT_PERSONAS
//    panel for the narrative
// 3. Sends an email via Resend (already wired in env vars per CLAUDE.md)
//
// This is the "prove the plumbing works" surface for /dispatch/alerts.
// Production ongoing alerts come from the existing dispatch-alerts cron;
// this endpoint is for manual fire + preview.
//
// Auth: same secret check as the cron, OR allow anonymous if force=false
// AND email is the requester's own (best-effort: same email submitted in
// the form as the destination — no auth bypass risk because we only send
// to the email in the body, never a configurable third-party).

import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { getPortMeta } from "@/lib/portMeta";
import { runPersonaPanel, ALERT_PERSONAS } from "@/lib/personaPanel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FireBody {
  email: string;
  port_id: string;
  threshold_ratio?: number;
  force?: boolean;
}

interface BaselineResult {
  live_wait_min: number | null;
  baseline_avg_min: number | null;
  ratio: number | null;
  anomaly: boolean;
  samples: number;
}

async function lookupBaseline(portId: string, threshold: number): Promise<BaselineResult> {
  const db = getServiceClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: live } = await db
    .from("wait_time_readings")
    .select("vehicle_wait, recorded_at")
    .eq("port_id", portId)
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: false })
    .limit(1);
  const liveWait = live?.[0]?.vehicle_wait;

  const now = new Date();
  const dow = now.getDay();
  const hour = now.getHours();
  const ninetyDays = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: hist } = await db
    .from("wait_time_readings")
    .select("vehicle_wait")
    .eq("port_id", portId)
    .eq("day_of_week", dow)
    .eq("hour_of_day", hour)
    .gte("recorded_at", ninetyDays)
    .limit(2000);
  const vals = (hist || [])
    .map((r) => (r as { vehicle_wait: number | null }).vehicle_wait)
    .filter((v): v is number => typeof v === "number");
  if (vals.length < 5 || typeof liveWait !== "number") {
    return {
      live_wait_min: typeof liveWait === "number" ? liveWait : null,
      baseline_avg_min: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null,
      ratio: null,
      anomaly: false,
      samples: vals.length,
    };
  }
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  if (avg <= 0) {
    return { live_wait_min: liveWait, baseline_avg_min: avg, ratio: null, anomaly: false, samples: vals.length };
  }
  const ratio = liveWait / avg;
  return {
    live_wait_min: liveWait,
    baseline_avg_min: Math.round(avg * 10) / 10,
    ratio: Math.round(ratio * 100) / 100,
    anomaly: ratio >= threshold,
    samples: vals.length,
  };
}

async function sendEmail(to: string, subject: string, text: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, error: "RESEND_API_KEY not set" };
  const from = process.env.RESEND_FROM_EMAIL || "Cruzar Alerts <alerts@cruzar.app>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text, html }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { sent: false, error: `resend ${res.status}: ${errText.slice(0, 200)}` };
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, message_id: json.id ?? null };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "send threw" };
  }
}

function emailHtml(opts: {
  portLabel: string;
  baseline: BaselineResult;
  threshold: number;
  forced: boolean;
  synthesis: string;
  perspectives: Array<{ label: string; text: string }>;
}): string {
  const { portLabel, baseline, threshold, forced, synthesis, perspectives } = opts;
  const banner = forced
    ? `<span style="background:#fbbf24;color:#0a1020;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">test fire</span>`
    : baseline.anomaly
      ? `<span style="background:#fda4af;color:#5f1c2c;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">anomaly · ${baseline.ratio?.toFixed(1) ?? "?"}×</span>`
      : `<span style="background:#a7f3d0;color:#064e3b;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">below threshold</span>`;
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a1020;color:#f5f5f7">
  <div style="border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:12px;margin-bottom:18px">
    <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.55);margin-bottom:6px">Cruzar Dispatch · alert</div>
    <h2 style="margin:0;font-size:18px;font-weight:600">${portLabel}</h2>
    <div style="margin-top:6px">${banner}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px">
    <tr>
      <td style="padding:6px 0;color:rgba(255,255,255,0.55)">Now</td>
      <td style="padding:6px 0;text-align:right;font-family:monospace;color:#fbbf24">${baseline.live_wait_min ?? "—"} min</td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:rgba(255,255,255,0.55)">90d DOW × hour avg</td>
      <td style="padding:6px 0;text-align:right;font-family:monospace">${baseline.baseline_avg_min ?? "—"} min · n=${baseline.samples}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:rgba(255,255,255,0.55)">Ratio</td>
      <td style="padding:6px 0;text-align:right;font-family:monospace">${baseline.ratio ?? "—"}× · threshold ${threshold}×</td>
    </tr>
  </table>

  <div style="background:rgba(251,191,36,0.05);border:1px solid rgba(251,191,36,0.25);border-radius:12px;padding:14px;margin-bottom:14px">
    <div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:rgba(251,191,36,0.85);margin-bottom:8px">3-persona synthesis</div>
    <p style="margin:0;line-height:1.55;font-size:13.5px;color:rgba(255,255,255,0.9)">${synthesis}</p>
  </div>

  ${perspectives
    .map(
      (p) => `
  <div style="border-top:1px solid rgba(255,255,255,0.06);padding:12px 0">
    <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.85);margin-bottom:4px">${p.label}</div>
    <p style="margin:0;line-height:1.5;font-size:12.5px;color:rgba(255,255,255,0.7)">${p.text}</p>
  </div>`,
    )
    .join("")}

  <div style="border-top:1px solid rgba(255,255,255,0.06);margin-top:18px;padding-top:14px;font-size:11px;color:rgba(255,255,255,0.4);line-height:1.5">
    Sent by Cruzar Dispatch — <a href="https://cruzar.app/dispatch/alerts" style="color:#fbbf24;text-decoration:none">manage alerts</a>.
    Test-fire sends are tagged so you can tell them apart from production alerts.
  </div>
</div>
`.trim();
}

function emailText(opts: {
  portLabel: string;
  baseline: BaselineResult;
  threshold: number;
  forced: boolean;
  synthesis: string;
  perspectives: Array<{ label: string; text: string }>;
}): string {
  const { portLabel, baseline, threshold, forced, synthesis, perspectives } = opts;
  const banner = forced ? "[TEST FIRE]" : baseline.anomaly ? `[ANOMALY ${baseline.ratio?.toFixed(1)}×]` : "[below threshold]";
  return [
    `Cruzar Dispatch alert · ${portLabel} ${banner}`,
    `Now: ${baseline.live_wait_min ?? "—"} min`,
    `90d DOW × hour avg: ${baseline.baseline_avg_min ?? "—"} min (n=${baseline.samples})`,
    `Ratio: ${baseline.ratio ?? "—"}× (threshold ${threshold}×)`,
    "",
    "3-persona synthesis:",
    synthesis,
    "",
    ...perspectives.flatMap((p) => [`— ${p.label}`, p.text, ""]),
    "Manage alerts: https://cruzar.app/dispatch/alerts",
  ].join("\n");
}

export async function POST(req: Request) {
  let body: FireBody = { email: "", port_id: "" };
  try {
    body = (await req.json()) as FireBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const email = (body.email ?? "").trim();
  const portId = (body.port_id ?? "").trim();
  const threshold = body.threshold_ratio ?? 1.5;
  const force = !!body.force;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }
  if (!portId) {
    return NextResponse.json({ error: "port_id required" }, { status: 400 });
  }

  const meta = getPortMeta(portId);
  const portLabel = meta ? `${meta.localName ?? meta.city} (${portId}) — ${meta.region}` : portId;

  const baseline = await lookupBaseline(portId, threshold);

  // If not anomalous AND not forced, return early — no email sent.
  if (!baseline.anomaly && !force) {
    return NextResponse.json({
      sent: false,
      reason: "not_anomalous_and_not_forced",
      baseline,
      hint: "Pass { force: true } to send a preview email anyway.",
    });
  }

  // Run the panel for the narrative
  let panel;
  try {
    panel = await runPersonaPanel({
      input: [
        `Live alert context for ${portLabel}:`,
        `  Now: ${baseline.live_wait_min ?? "?"} min`,
        `  90d DOW × hour avg: ${baseline.baseline_avg_min ?? "?"} min (n=${baseline.samples})`,
        `  Ratio: ${baseline.ratio ?? "?"}× of baseline (threshold ${threshold}×)`,
        force ? "Note: this is a TEST FIRE; deliver the alert format the operator would actually receive." : "",
        "",
        "Each persona — 1-2 sentences from your perspective on what to do RIGHT NOW.",
      ]
        .filter(Boolean)
        .join("\n"),
      personas: ALERT_PERSONAS,
      synthesisInstruction:
        "Single 1-2 sentence summary an on-shift dispatcher can act on in 10 seconds. Concrete next step or reason to ignore.",
      maxTokens: 1200,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "panel_failed" },
      { status: 502 },
    );
  }

  const perspectives = panel.responses.map((r) => ({ label: r.persona_label, text: r.perspective }));
  const subject = `${force ? "[TEST] " : baseline.anomaly ? "[ANOMALY] " : ""}Cruzar — ${meta?.localName ?? portId} ${baseline.live_wait_min ?? "?"}m wait${baseline.ratio ? ` (${baseline.ratio.toFixed(1)}× baseline)` : ""}`;
  const text = emailText({ portLabel, baseline, threshold, forced: force, synthesis: panel.synthesis, perspectives });
  const html = emailHtml({ portLabel, baseline, threshold, forced: force, synthesis: panel.synthesis, perspectives });

  const send = await sendEmail(email, subject, text, html);

  return NextResponse.json({
    sent: send.sent,
    error: send.error ?? null,
    message_id: (send as { message_id?: string | null }).message_id ?? null,
    baseline,
    panel,
    rendered: { subject, text, html },
  });
}
