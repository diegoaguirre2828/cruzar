// GET /api/admin/calibration
//
// Admin-only read of calibration_log + calibration_accuracy_30d view.
// Service-role read bypasses RLS (raw rows are denied to authenticated users).
// Auth: requires logged-in user with email matching ADMIN_EMAIL.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase";

const ADMIN_EMAIL = "cruzabusiness@gmail.com";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Verify admin via the server-side Supabase client (cookies-backed session).
  const cookieStore = await cookies();
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const project = url.searchParams.get("project") ?? "cruzar";
  const simKind = url.searchParams.get("sim_kind");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "50"), 1), 500);

  const sb = getServiceClient();

  // Aggregate accuracy view (rolling 30 days)
  const { data: accuracy, error: accErr } = await sb
    .from("calibration_accuracy_30d")
    .select("*")
    .eq("project", project);

  if (accErr) {
    return NextResponse.json({ error: "accuracy_query_failed", detail: accErr.message }, { status: 500 });
  }

  // Recent predictions (raw rows)
  let q = sb
    .from("calibration_log")
    .select("id, project, sim_kind, sim_version, predicted, observed, observed_at, loss, tags, created_at")
    .eq("project", project)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (simKind) q = q.eq("sim_kind", simKind);

  const { data: rows, error: rowsErr } = await q;
  if (rowsErr) {
    return NextResponse.json({ error: "rows_query_failed", detail: rowsErr.message }, { status: 500 });
  }

  // Pending counts (predictions awaiting observation)
  const { count: pendingCount } = await sb
    .from("calibration_log")
    .select("id", { count: "exact", head: true })
    .eq("project", project)
    .is("observed", null);

  const { count: totalCount } = await sb
    .from("calibration_log")
    .select("id", { count: "exact", head: true })
    .eq("project", project);

  return NextResponse.json({
    project,
    accuracy_30d: accuracy ?? [],
    recent: rows ?? [],
    counts: {
      total: totalCount ?? 0,
      pending: pendingCount ?? 0,
      resolved: (totalCount ?? 0) - (pendingCount ?? 0),
    },
  });
}
