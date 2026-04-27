// Pillar 3 Family Layer — broadcast ETA to a circle.
// POST /api/family/eta — create a ping (in_transit by default)
// GET  /api/family/eta — list recent pings across user's circles + own pings

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

async function userClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
}

const Schema = z.object({
  circle_id: z.string().uuid(),
  port_id: z.string().optional(),
  predicted_arrival_at: z.string().datetime(),
  origin_lat: z.number().optional(),
  origin_lng: z.number().optional(),
  dest_label: z.string().max(120).optional(),
  message_es: z.string().max(280).optional(),
  message_en: z.string().max(280).optional(),
});

export async function GET() {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getServiceClient();
  const { data: members } = await db
    .from("circle_members")
    .select("circle_id")
    .eq("user_id", user.id);
  const circleIds = (members ?? []).map((m) => m.circle_id);
  if (circleIds.length === 0) return NextResponse.json({ pings: [] });

  const { data: pings, error } = await db
    .from("family_eta_pings")
    .select("*")
    .in("circle_id", circleIds)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pings: pings ?? [] });
}

export async function POST(req: NextRequest) {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "validation failed", issues: parsed.error.issues }, { status: 400 });

  const db = getServiceClient();
  // Confirm user is a member of the circle they're broadcasting to
  const { data: m } = await db
    .from("circle_members")
    .select("id")
    .eq("circle_id", parsed.data.circle_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!m) return NextResponse.json({ error: "not a circle member" }, { status: 403 });

  const { data: ping, error } = await db
    .from("family_eta_pings")
    .insert({
      user_id: user.id,
      circle_id: parsed.data.circle_id,
      port_id: parsed.data.port_id,
      predicted_arrival_at: parsed.data.predicted_arrival_at,
      origin_lat: parsed.data.origin_lat,
      origin_lng: parsed.data.origin_lng,
      dest_label: parsed.data.dest_label,
      status: "in_transit",
      message_es: parsed.data.message_es,
      message_en: parsed.data.message_en,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Push to circle co-members
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    const { data: members } = await db
      .from("circle_members")
      .select("user_id")
      .eq("circle_id", parsed.data.circle_id);
    const memberIds = (members ?? []).map((mm) => mm.user_id).filter((id) => id !== user.id);
    if (memberIds.length > 0) {
      const { data: subs } = await db
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .in("user_id", memberIds);
      const arrival = new Date(parsed.data.predicted_arrival_at).toLocaleTimeString();
      for (const sub of subs ?? []) {
        if (!sub?.endpoint) continue;
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: "Cruzar — ETA familiar",
              body: parsed.data.message_es || `Llegada estimada ${arrival}${parsed.data.dest_label ? ` a ${parsed.data.dest_label}` : ""}.`,
              tag: `family-eta-${ping.id}`,
              url: "/family",
            }),
            { urgency: "normal", TTL: 7200 },
          );
        } catch (err) {
          const e = err as { statusCode?: number };
          if (e?.statusCode === 410) {
            await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
      }
    }
  }

  return NextResponse.json({ ping }, { status: 201 });
}
