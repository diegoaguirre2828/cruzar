// Layer 2 W2 — operator alert dispatcher.
//
// Runs every 5 minutes via cron-job.org. For each active operator_alert_rule:
//   1. Resolve the load(s) it applies to
//   2. For each load, evaluate the rule against the stored snapshot
//      (predicted_wait, p_make_appt, detention_dollars). For
//      `anomaly_at_recommended`, do an inline live-vs-baseline check.
//   3. If fired and outside cooldown:
//      - insert operator_alert_dispatches row
//      - deliver via channel (push, email, sms, mcp_log)
//      - update rule.last_fired_at
//
// Auth: ?secret=CRON_SECRET or Authorization: Bearer <CRON_SECRET>.

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { evaluateRule, renderAlertText, type AlertRule, type LoadSnapshot } from "@/lib/alertEngine";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:cruzabusiness@gmail.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const q = req.nextUrl.searchParams.get("secret");
  if (q && q === secret) return true;
  const auth = req.headers.get("authorization") || "";
  return auth.replace(/^Bearer\s+/i, "").trim() === secret;
}

async function isAnomalyHigh(db: ReturnType<typeof getServiceClient>, portId: string): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: live } = await db
    .from("wait_time_readings")
    .select("vehicle_wait, recorded_at")
    .eq("port_id", portId)
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: false })
    .limit(1);
  const liveWait = live?.[0]?.vehicle_wait;
  if (typeof liveWait !== "number") return false;

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
  const vals = (hist || []).map((r) => r.vehicle_wait).filter((v): v is number => typeof v === "number");
  if (vals.length < 5) return false;
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  if (avg <= 0) return false;
  return liveWait / avg >= 1.5;
}

async function deliverPush(
  db: ReturnType<typeof getServiceClient>,
  userId: string,
  text: { en: string; es: string },
  loadRef: string,
): Promise<{ delivered: boolean; error?: string }> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return { delivered: false, error: "vapid keys not set" };
  }
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs?.length) return { delivered: false, error: "no push subscriptions" };
  let anyDelivered = false;
  let lastErr: string | undefined;
  for (const sub of subs) {
    if (!sub?.endpoint) continue;
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: `Cruzar — load ${loadRef}`,
          body: text.es,
          tag: `operator-alert-${loadRef}`,
          url: "/insights/loads",
          requireInteraction: true,
        }),
        { urgency: "high", TTL: 1800 },
      );
      anyDelivered = true;
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      if (e?.statusCode === 410) {
        await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
      lastErr = e?.message || String(err);
    }
  }
  return { delivered: anyDelivered, error: anyDelivered ? undefined : lastErr };
}

async function deliverEmail(
  db: ReturnType<typeof getServiceClient>,
  userId: string,
  text: { en: string; es: string },
): Promise<{ delivered: boolean; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { delivered: false, error: "RESEND_API_KEY not set" };
  const { data: u } = await db.auth.admin.getUserById(userId);
  const email = u?.user?.email;
  if (!email) return { delivered: false, error: "user has no email" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "Cruzar Alerts <alerts@cruzar.app>",
        to: email,
        subject: text.en.split(":")[0] + " — Cruzar alert",
        text: `${text.en}\n\n${text.es}\n\n— Cruzar Insights\nManage alerts: https://cruzar.app/insights/loads`,
      }),
    });
    if (!res.ok) return { delivered: false, error: `resend ${res.status}` };
    return { delivered: true };
  } catch (e) {
    return { delivered: false, error: (e as Error).message };
  }
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = getServiceClient();
  const startedAt = new Date().toISOString();

  const { data: rules, error: rulesErr } = await db
    .from("operator_alert_rules")
    .select("*")
    .eq("active", true)
    .limit(1000);
  if (rulesErr) return NextResponse.json({ error: rulesErr.message }, { status: 500 });

  type Stat = { rule_id: string; load_id: string; fired: boolean; reason: string; delivered: boolean; error?: string };
  const stats: Stat[] = [];

  for (const rule of (rules || []) as AlertRule[]) {
    const { data: loads } = rule.load_id
      ? await db.from("tracked_loads").select("*").eq("id", rule.load_id).eq("user_id", rule.user_id).limit(1)
      : await db.from("tracked_loads").select("*").eq("user_id", rule.user_id).in("status", ["tracking", "crossed"]).limit(50);

    for (const ld of loads || []) {
      const snapshot: LoadSnapshot = {
        id: ld.id,
        load_ref: ld.load_ref,
        recommended_port_id: ld.recommended_port_id,
        predicted_wait_minutes: ld.predicted_wait_minutes,
        predicted_eta_minutes: ld.predicted_eta_minutes,
        predicted_arrival_at: ld.predicted_arrival_at,
        p_make_appointment: ld.p_make_appointment,
        detention_risk_dollars: ld.detention_risk_dollars,
        eta_refreshed_at: ld.eta_refreshed_at,
      };
      const anomalyHigh = rule.trigger_kind === "anomaly_at_recommended" && snapshot.recommended_port_id
        ? await isAnomalyHigh(db, snapshot.recommended_port_id)
        : false;
      const ev = evaluateRule(rule, snapshot, null, null, anomalyHigh);
      if (!ev.fired) {
        stats.push({ rule_id: rule.id, load_id: ld.id, fired: false, reason: ev.reason, delivered: false });
        continue;
      }
      const text = renderAlertText(rule, snapshot, ev);
      let outcome: { delivered: boolean; error?: string } = { delivered: true };
      if (rule.channel === "push") outcome = await deliverPush(db, rule.user_id, text, snapshot.load_ref);
      else if (rule.channel === "email") outcome = await deliverEmail(db, rule.user_id, text);
      else if (rule.channel === "sms") outcome = { delivered: false, error: "sms not provisioned (Twilio 10DLC pending)" };
      // 'mcp_log' is delivery-by-presence: dispatch row IS the delivery.

      await db.from("operator_alert_dispatches").insert({
        rule_id: rule.id,
        user_id: rule.user_id,
        load_id: ld.id,
        channel: rule.channel,
        payload: { ...ev.payload, text_en: text.en, text_es: text.es },
        delivered: outcome.delivered,
        delivery_error: outcome.error ?? null,
      });
      await db.from("operator_alert_rules").update({ last_fired_at: new Date().toISOString() }).eq("id", rule.id);
      stats.push({ rule_id: rule.id, load_id: ld.id, fired: true, reason: ev.reason, delivered: outcome.delivered, error: outcome.error });
    }
  }

  return NextResponse.json({
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    rules_evaluated: rules?.length ?? 0,
    fired: stats.filter((s) => s.fired).length,
    delivered: stats.filter((s) => s.delivered).length,
    stats,
  });
}
