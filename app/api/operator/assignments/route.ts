// Operator load assignments — wire a driver to a tracked load.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function userClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
}

const Schema = z.object({
  driver_id: z.string().uuid(),
  load_id: z.string().uuid(),
});

export async function GET() {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await sb
    .from("operator_load_assignments")
    .select("*, operator_drivers(display_name, status, truck_number), tracked_loads(load_ref, recommended_port_id, predicted_arrival_at, p_make_appointment, detention_risk_dollars)")
    .eq("user_id", user.id)
    .is("unassigned_at", null)
    .order("assigned_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignments: data ?? [] });
}

export async function POST(req: NextRequest) {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "validation failed" }, { status: 400 });

  // Soft-unassign any prior active assignment for this load (one driver per load).
  await sb
    .from("operator_load_assignments")
    .update({ unassigned_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("load_id", parsed.data.load_id)
    .is("unassigned_at", null);

  const { data, error } = await sb
    .from("operator_load_assignments")
    .insert({ user_id: user.id, ...parsed.data })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignment: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const { error } = await sb
    .from("operator_load_assignments")
    .update({ unassigned_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
