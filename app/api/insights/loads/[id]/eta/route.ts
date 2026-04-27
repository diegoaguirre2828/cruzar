// POST /api/insights/loads/:id/eta — recompute ETA + detention risk against
// current model + traffic conditions and persist back to the row.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { computeLoadEta } from "@/lib/loadEta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function serverClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: load, error: loadErr } = await sb
    .from("tracked_loads").select("*")
    .eq("id", id).eq("user_id", user.id).single();
  if (loadErr || !load) return NextResponse.json({ error: "load not found" }, { status: 404 });
  if (!load.dest_lat || !load.dest_lng) {
    return NextResponse.json({ error: "load is missing geocoded dest coords" }, { status: 422 });
  }

  let eta;
  try {
    eta = await computeLoadEta({
      origin_lat: load.origin_lat,
      origin_lng: load.origin_lng,
      dest_lat: load.dest_lat,
      dest_lng: load.dest_lng,
      appointment_at: load.appointment_at,
      detention_rate_per_hour: load.detention_rate_per_hour,
      detention_grace_hours: load.detention_grace_hours,
      preferred_port_id: load.preferred_port_id ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }

  const r = eta.recommended;
  const { error: updErr } = await sb
    .from("tracked_loads").update({
      recommended_port_id: r.port_id,
      predicted_arrival_at: r.predicted_arrival_at,
      predicted_eta_minutes: r.total_eta_min,
      predicted_wait_minutes: r.predicted_wait_min,
      predicted_drive_minutes: r.drive_to_bridge_min + r.drive_to_dock_min,
      rmse_minutes: r.rmse_min,
      p_make_appointment: r.p_make_appointment,
      detention_risk_dollars: r.detention_dollars,
      eta_refreshed_at: new Date().toISOString(),
    })
    .eq("id", id).eq("user_id", user.id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ eta });
}
