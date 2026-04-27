// Operator-facing API for tracked loads.
// GET  /api/insights/loads     — list current user's loads
// POST /api/insights/loads     — create a new tracked load (geocodes dock + computes initial ETA)

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";
import { geocode } from "@/lib/geocode";
import { computeLoadEta } from "@/lib/loadEta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function serverClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
}

const CreateLoadSchema = z.object({
  load_ref: z.string().min(1).max(64),
  origin_lat: z.number().min(-90).max(90),
  origin_lng: z.number().min(-180).max(180),
  origin_label: z.string().max(120).optional(),
  dest_address: z.string().min(3).max(300),
  appointment_at: z.string().datetime(),
  detention_rate_per_hour: z.number().min(0).max(500).optional(),
  detention_grace_hours: z.number().min(0).max(24).optional(),
  loaded_value_dollars: z.number().min(0).optional(),
  preferred_port_id: z.string().regex(/^\d{6}$/).optional(),
});

export async function GET() {
  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await sb
    .from("tracked_loads")
    .select("*")
    .eq("user_id", user.id)
    .order("appointment_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ loads: data ?? [] });
}

export async function POST(req: NextRequest) {
  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const parsed = CreateLoadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  // Geocode the destination dock
  const geo = await geocode(parsed.data.dest_address);
  if (!geo) {
    return NextResponse.json(
      { error: "could not geocode dest_address — check the address or HERE config" },
      { status: 422 },
    );
  }

  // Compute initial ETA
  let eta;
  try {
    eta = await computeLoadEta({
      origin_lat: parsed.data.origin_lat,
      origin_lng: parsed.data.origin_lng,
      dest_lat: geo.lat,
      dest_lng: geo.lng,
      appointment_at: parsed.data.appointment_at,
      detention_rate_per_hour: parsed.data.detention_rate_per_hour,
      detention_grace_hours: parsed.data.detention_grace_hours,
      preferred_port_id: parsed.data.preferred_port_id ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `eta computation failed: ${(e as Error).message}` },
      { status: 503 },
    );
  }
  const r = eta.recommended;

  const { data, error } = await sb
    .from("tracked_loads")
    .insert({
      user_id: user.id,
      load_ref: parsed.data.load_ref,
      origin_lat: parsed.data.origin_lat,
      origin_lng: parsed.data.origin_lng,
      origin_label: parsed.data.origin_label,
      dest_address: parsed.data.dest_address,
      dest_lat: geo.lat,
      dest_lng: geo.lng,
      appointment_at: parsed.data.appointment_at,
      detention_rate_per_hour: parsed.data.detention_rate_per_hour ?? 75,
      detention_grace_hours: parsed.data.detention_grace_hours ?? 2,
      loaded_value_dollars: parsed.data.loaded_value_dollars ?? null,
      preferred_port_id: parsed.data.preferred_port_id ?? null,
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
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ load: data, eta }, { status: 201 });
}
