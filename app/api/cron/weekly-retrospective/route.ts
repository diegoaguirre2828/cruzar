// Weekly retrospective email — fires Sundays 13:00 UTC (8am CT).
//
// For every operator who tracked at least one load in the prior 7 days,
// compute total dispatched / completed / detained / dollars saved-vs-recommended,
// then send a Resend email summarizing it. Hard-retention feature: hits the
// dispatcher's Monday inbox with the number that sells the renewal ("Cruzar
// flagged $1,240 in detention exposure on 7 loads last week").
//
// Auth: ?secret=CRON_SECRET query OR Authorization: Bearer CRON_SECRET header.

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface LoadRow {
  id: string;
  user_id: string;
  load_ref: string;
  recommended_port_id: string | null;
  predicted_wait_minutes: number | null;
  predicted_eta_minutes: number | null;
  p_make_appointment: number | null;
  detention_risk_dollars: number | null;
  status: string;
  appointment_at: string;
}

interface CrossingRow {
  user_id: string;
  load_ref: string | null;
  port_id_used: string;
  port_id_recommended: string | null;
  savings_minutes: number | null;
  savings_dollars: number | null;
  detention_minutes: number | null;
  detention_dollars: number | null;
  on_time: boolean | null;
  crossed_at: string;
}

interface UserSummary {
  email: string;
  ownerName: string | null;
  loadsTracked: number;
  loadsCompleted: number;
  loadsAtRisk: number;          // P(make_appt) < 0.5
  totalDetentionExposure: number;  // $ from tracked loads' detention_risk_dollars
  totalDetentionRealized: number;  // $ from crossing_events
  totalSavingsRealized: number;    // $ from crossing_events.savings_dollars
  topAtRiskLoads: Array<{ ref: string; appt: string; risk: number; pmakeappt: number | null }>;
}

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === secret) return true;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

async function sendEmail(s: UserSummary, fromDate: string, toDate: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;
  const from = process.env.RESEND_FROM_EMAIL || "Cruzar Insights <onboarding@resend.dev>";

  const dollars = (n: number) => `$${Math.round(n).toLocaleString()}`;

  const html = `
<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fafafa;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Cruzar Insights flagged ${dollars(s.totalDetentionExposure)} in detention exposure on ${s.loadsTracked} loads
  </div>
  <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;">
    🛂 Cruzar Insights · Weekly retrospective
  </h2>
  <p style="color:#64748b;font-size:13px;margin:0 0 24px;">${fromDate} → ${toDate}</p>

  <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border:1px solid #fcd34d;border-radius:14px;padding:22px;margin-bottom:20px;">
    <p style="margin:0;font-size:12px;font-weight:600;color:#78350f;text-transform:uppercase;letter-spacing:1px;">
      Detention exposure detected · Exposición a detention detectada
    </p>
    <p style="margin:6px 0 0;font-size:42px;font-weight:900;color:#92400e;line-height:1;">
      ${dollars(s.totalDetentionExposure)}
    </p>
    <p style="margin:8px 0 0;font-size:13px;color:#78350f;">
      ${s.loadsTracked} loads tracked · ${s.loadsAtRisk} at risk · ${s.loadsCompleted} completed
    </p>
  </div>

  ${s.totalSavingsRealized > 0 ? `
  <div style="background:#dcfce7;border:1px solid #86efac;border-radius:14px;padding:18px;margin-bottom:20px;">
    <p style="margin:0;font-size:12px;font-weight:600;color:#14532d;text-transform:uppercase;letter-spacing:1px;">
      Estimated savings realized · Ahorro estimado realizado
    </p>
    <p style="margin:6px 0 0;font-size:30px;font-weight:900;color:#166534;line-height:1;">
      ${dollars(s.totalSavingsRealized)}
    </p>
    <p style="margin:8px 0 0;font-size:12px;color:#14532d;">
      vs. taking the bridge you would've defaulted to
    </p>
  </div>
  ` : ""}

  ${s.topAtRiskLoads.length > 0 ? `
  <h3 style="color:#0f172a;font-size:15px;margin:24px 0 10px;">
    Loads at risk this period · Cargas en riesgo
  </h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="text-align:left;">
        <th style="padding:6px 0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Ref</th>
        <th style="padding:6px 0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Appt</th>
        <th style="padding:6px 0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:600;text-align:right;">P(on time)</th>
        <th style="padding:6px 0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:600;text-align:right;">Risk $</th>
      </tr>
    </thead>
    <tbody>
      ${s.topAtRiskLoads.map(l => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:12px;color:#0f172a;">${l.ref}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#475569;font-size:12px;">${new Date(l.appt).toLocaleDateString()}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;color:${l.pmakeappt != null && l.pmakeappt < 0.5 ? "#b91c1c" : "#0f172a"};font-weight:600;">${l.pmakeappt != null ? `${Math.round(l.pmakeappt * 100)}%` : "—"}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;color:#b91c1c;">${dollars(l.risk)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  ` : ""}

  <div style="margin-top:28px;">
    <a href="https://cruzar.app/insights/loads"
       style="display:inline-block;background:#0f172a;color:white;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">
      Open dispatch board →
    </a>
  </div>

  <p style="margin:28px 0 0;font-size:11px;color:#94a3b8;line-height:1.5;">
    ${s.ownerName ?? "Dispatcher"}, this is your weekly Cruzar Insights summary. ·
    Resumen semanal de Cruzar Insights.
    <br>
    <a href="https://cruzar.app/dashboard" style="color:#64748b;">Manage preferences</a> ·
    <a href="https://cruzar.app/insights" style="color:#64748b;">Methodology</a>
  </p>
</div>`;

  const subject = s.totalDetentionExposure > 0
    ? `🛂 ${dollars(s.totalDetentionExposure)} detention exposure flagged · ${s.loadsTracked} loads`
    : `🛂 Cruzar Insights weekly · ${s.loadsTracked} loads tracked`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: s.email, subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function getEmailFor(userId: string): Promise<{ email: string; name: string | null } | null> {
  const db = getServiceClient();
  const { data: profile } = await db
    .from("profiles").select("display_name").eq("id", userId).maybeSingle();
  // Email isn't on profiles in this schema — fetch from auth.users via admin API
  const { data: { user } } = await db.auth.admin.getUserById(userId);
  if (!user?.email) return null;
  return { email: user.email, name: profile?.display_name ?? null };
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fromDate = new Date(since).toLocaleDateString();
  const toDate = new Date().toLocaleDateString();

  // Pull last-7d tracked loads
  const { data: loads } = await db
    .from("tracked_loads")
    .select("id,user_id,load_ref,recommended_port_id,predicted_wait_minutes,predicted_eta_minutes,p_make_appointment,detention_risk_dollars,status,appointment_at")
    .gte("appointment_at", since)
    .order("appointment_at", { ascending: true });

  // Pull last-7d crossing events (retrospective ledger)
  const { data: events } = await db
    .from("crossing_events")
    .select("user_id,load_ref,port_id_used,port_id_recommended,savings_minutes,savings_dollars,detention_minutes,detention_dollars,on_time,crossed_at")
    .gte("crossed_at", since);

  // Group by user
  const byUser = new Map<string, UserSummary>();
  for (const l of (loads ?? []) as LoadRow[]) {
    const u = byUser.get(l.user_id) ?? {
      email: "", ownerName: null,
      loadsTracked: 0, loadsCompleted: 0, loadsAtRisk: 0,
      totalDetentionExposure: 0, totalDetentionRealized: 0, totalSavingsRealized: 0,
      topAtRiskLoads: [],
    };
    u.loadsTracked += 1;
    if (l.status === "completed" || l.status === "crossed") u.loadsCompleted += 1;
    if (l.p_make_appointment != null && l.p_make_appointment < 0.5) u.loadsAtRisk += 1;
    if (l.detention_risk_dollars && l.detention_risk_dollars > 0) {
      u.totalDetentionExposure += Number(l.detention_risk_dollars);
      u.topAtRiskLoads.push({
        ref: l.load_ref,
        appt: l.appointment_at,
        risk: Number(l.detention_risk_dollars),
        pmakeappt: l.p_make_appointment,
      });
    }
    byUser.set(l.user_id, u);
  }

  for (const e of (events ?? []) as CrossingRow[]) {
    const u = byUser.get(e.user_id) ?? {
      email: "", ownerName: null,
      loadsTracked: 0, loadsCompleted: 0, loadsAtRisk: 0,
      totalDetentionExposure: 0, totalDetentionRealized: 0, totalSavingsRealized: 0,
      topAtRiskLoads: [],
    };
    if (e.detention_dollars) u.totalDetentionRealized += Number(e.detention_dollars);
    if (e.savings_dollars) u.totalSavingsRealized += Number(e.savings_dollars);
    byUser.set(e.user_id, u);
  }

  // Top-5 at-risk loads by $ exposure
  for (const u of byUser.values()) {
    u.topAtRiskLoads = u.topAtRiskLoads
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 5);
  }

  // Resolve emails + send
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const [userId, summary] of byUser) {
    const ident = await getEmailFor(userId);
    if (!ident) { skipped += 1; continue; }
    summary.email = ident.email;
    summary.ownerName = ident.name;
    const ok = await sendEmail(summary, fromDate, toDate);
    if (ok) sent += 1; else errors.push(`${ident.email} send failed`);
  }

  return NextResponse.json({
    ok: true,
    period: { from: fromDate, to: toDate },
    users_with_loads: byUser.size,
    emails_sent: sent,
    skipped_no_email: skipped,
    errors,
  });
}
