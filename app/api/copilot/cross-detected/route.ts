// Pillar 2 Co-Pilot — auto-broadcast on cross detection.
// Writes a family_eta_pings row marked 'arrived' (so circle members see
// the post-cross status) and fires push to circle members who have a
// push subscription.

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

const Schema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  port_id: z.string().optional(),
  circle_id: z.string().uuid().nullable().optional(),
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
  if (!parsed.success) return NextResponse.json({ error: "validation failed" }, { status: 400 });

  const db = getServiceClient();
  const circleId = parsed.data.circle_id ?? null;
  const now = new Date().toISOString();

  if (!circleId) {
    return NextResponse.json({ ok: true, ping: null, note: "no circle_id, no broadcast" });
  }

  const { data: ping, error } = await db
    .from("family_eta_pings")
    .insert({
      user_id: user.id,
      circle_id: circleId,
      port_id: parsed.data.port_id,
      predicted_arrival_at: now,
      actual_arrival_at: now,
      origin_lat: parsed.data.lat,
      origin_lng: parsed.data.lng,
      status: "arrived",
      message_es: `Crucé en ${parsed.data.port_id ?? "puente"}.`,
      message_en: `I crossed at ${parsed.data.port_id ?? "the bridge"}.`,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Push to other circle members
  let delivered = 0;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    const { data: members } = await db
      .from("circle_members")
      .select("user_id")
      .eq("circle_id", circleId);
    const memberIds = (members ?? []).map((m) => m.user_id).filter((id) => id !== user.id);
    if (memberIds.length > 0) {
      const { data: subs } = await db
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth, user_id")
        .in("user_id", memberIds);
      for (const sub of subs ?? []) {
        if (!sub?.endpoint) continue;
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: "Cruzar — cruce reportado",
              body: `Tu familiar cruzó en ${parsed.data.port_id ?? "el puente"}.`,
              tag: `family-cross-${ping.id}`,
              url: "/circle",
            }),
            { urgency: "normal", TTL: 3600 },
          );
          delivered++;
        } catch (err) {
          const e = err as { statusCode?: number };
          if (e?.statusCode === 410) {
            await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true, ping, delivered });
}
