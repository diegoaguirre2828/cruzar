// Daily cron — push 30d/7d expiry reminders for wallet documents.
// Runs once per day at 14:00 UTC (8am CT).

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
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

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);

  const { data: docs } = await db
    .from("wallet_documents")
    .select("id, user_id, doc_type, label, expires_at, reminded_30d_at, reminded_7d_at")
    .gte("expires_at", today)
    .lte("expires_at", in30);

  let sent = 0;
  for (const d of docs ?? []) {
    if (!d.expires_at) continue;
    const inWindow30 = d.expires_at <= in30 && !d.reminded_30d_at;
    const inWindow7 = d.expires_at <= in7 && !d.reminded_7d_at;
    if (!inWindow30 && !inWindow7) continue;

    const { data: subs } = await db
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", d.user_id);

    const days = Math.ceil((new Date(d.expires_at).getTime() - Date.now()) / 86400_000);
    const body = `${d.doc_type.replace(/_/g, " ")}${d.label ? ` (${d.label})` : ""} vence en ${days}d`;

    let delivered = false;
    for (const sub of subs ?? []) {
      if (!sub?.endpoint) continue;
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: "Cruzar — documento por vencer",
            body,
            tag: `wallet-expiry-${d.id}`,
            url: "/wallet",
          }),
          { urgency: "normal", TTL: 86400 },
        );
        delivered = true;
        sent++;
      } catch (err) {
        const e = err as { statusCode?: number };
        if (e?.statusCode === 410) await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
    if (delivered) {
      const upd: Record<string, string> = {};
      if (inWindow7) upd.reminded_7d_at = new Date().toISOString();
      else if (inWindow30) upd.reminded_30d_at = new Date().toISOString();
      await db.from("wallet_documents").update(upd).eq("id", d.id);
    }
  }
  return NextResponse.json({ checked: docs?.length ?? 0, sent });
}
