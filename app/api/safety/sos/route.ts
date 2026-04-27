// Pillar 6 Safety Net — SOS event broadcast.
// POST creates an emergency_events row + pushes to all of the user's
// emergency_contacts (Resend email if email present) AND all their
// circle co-members (web push).

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase";
import webpush from "web-push";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:cruzabusiness@gmail.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

const KINDS = [
  "secondary_inspection", "vehicle_breakdown", "accident",
  "lost_sentri", "document_seizure", "medical", "other",
] as const;

const Schema = z.object({
  kind: z.enum(KINDS),
  port_id: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  notes: z.string().max(500).optional(),
  notify_circles: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "validation failed", issues: parsed.error.issues }, { status: 400 });

  const db = getServiceClient();

  // Notify circles I'm in (Pillar 3 link)
  let circleIds: string[] = [];
  if (parsed.data.notify_circles) {
    const { data: cm } = await db.from("circle_members").select("circle_id").eq("user_id", user.id);
    circleIds = (cm ?? []).map((m) => m.circle_id);
  }

  const { data: contacts } = await db
    .from("emergency_contacts")
    .select("id, display_name, phone, email")
    .eq("user_id", user.id)
    .eq("notify_on_emergency", true)
    .order("priority", { ascending: true });

  const contactIds = (contacts ?? []).map((c) => c.id);

  const { data: ev, error } = await db
    .from("emergency_events")
    .insert({
      user_id: user.id,
      kind: parsed.data.kind,
      port_id: parsed.data.port_id,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      notes: parsed.data.notes,
      notified_contact_ids: contactIds,
      notified_circle_ids: circleIds,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Push to circle co-members
  let pushDelivered = 0;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && circleIds.length > 0) {
    const { data: members } = await db.from("circle_members").select("user_id").in("circle_id", circleIds);
    const memberIds = Array.from(new Set((members ?? []).map((m) => m.user_id))).filter((id) => id !== user.id);
    if (memberIds.length > 0) {
      const { data: subs } = await db
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .in("user_id", memberIds);
      for (const sub of subs ?? []) {
        if (!sub?.endpoint) continue;
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: "🚨 Cruzar — SOS familiar",
              body: `Alguien de tu círculo activó SOS (${parsed.data.kind.replace(/_/g, " ")}).`,
              tag: `sos-${ev.id}`,
              url: "/sos",
              requireInteraction: true,
            }),
            { urgency: "high", TTL: 3600 },
          );
          pushDelivered++;
        } catch (err) {
          const e = err as { statusCode?: number };
          if (e?.statusCode === 410) await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    }
  }

  // Email emergency_contacts who have an email
  let emailDelivered = 0;
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const emails = (contacts ?? []).filter((c) => c.email).map((c) => c.email!);
    if (emails.length > 0) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || "Cruzar Alerts <alerts@cruzar.app>",
            to: emails,
            subject: `🚨 Cruzar SOS — ${parsed.data.kind.replace(/_/g, " ")}`,
            text: [
              `An emergency contact has triggered SOS in Cruzar.`,
              `Kind: ${parsed.data.kind}`,
              parsed.data.port_id ? `Port: ${parsed.data.port_id}` : "",
              parsed.data.lat ? `Location: ${parsed.data.lat.toFixed(5)}, ${parsed.data.lng?.toFixed(5)}` : "",
              parsed.data.notes ? `Notes: ${parsed.data.notes}` : "",
              "",
              "Open Cruzar: https://cruzar.app/sos",
            ].filter(Boolean).join("\n"),
          }),
        });
        if (res.ok) emailDelivered = emails.length;
      } catch {/* ignore — dispatch row already written */}
    }
  }

  return NextResponse.json({ event: ev, push_delivered: pushDelivered, email_delivered: emailDelivered }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body.id || !body.status) return NextResponse.json({ error: "id + status required" }, { status: 400 });
  const updates: Record<string, unknown> = { status: body.status };
  if (body.status === "resolved" || body.status === "false_alarm") {
    updates.resolved_at = new Date().toISOString();
  }
  const { data, error } = await sb.from("emergency_events").update(updates).eq("id", body.id).eq("user_id", user.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data });
}
