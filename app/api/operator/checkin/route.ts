// Token-based driver checkin (no auth required) — driver opens a link
// /driver-app/<token> and posts their status + lat/lng. Service-role
// client bypasses RLS for the lookup.

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  token: z.string().min(8).max(64),
  status: z.enum(["available", "en_route", "in_line", "at_agent", "crossed", "delivered", "off_duty"]).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });
  const db = getServiceClient();
  const { data: driver } = await db
    .from("operator_drivers")
    .select("id, display_name, truck_number, status, last_seen_at")
    .eq("checkin_token", token)
    .maybeSingle();
  if (!driver) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: assignments } = await db
    .from("operator_load_assignments")
    .select("id, load_id, tracked_loads(load_ref, recommended_port_id, predicted_arrival_at, dest_address, appointment_at)")
    .eq("driver_id", driver.id)
    .is("unassigned_at", null)
    .limit(5);
  return NextResponse.json({ driver, assignments: assignments ?? [] });
}

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "validation failed", issues: parsed.error.issues }, { status: 400 });
  const db = getServiceClient();
  const updates: Record<string, unknown> = { last_seen_at: new Date().toISOString() };
  if (parsed.data.status) updates.status = parsed.data.status;
  if (parsed.data.lat != null) updates.last_lat = parsed.data.lat;
  if (parsed.data.lng != null) updates.last_lng = parsed.data.lng;
  const { data, error } = await db
    .from("operator_drivers")
    .update(updates)
    .eq("checkin_token", parsed.data.token)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, driver: data });
}
