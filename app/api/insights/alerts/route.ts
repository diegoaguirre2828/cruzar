// CRUD for operator_alert_rules.
// GET  /api/insights/alerts            — list user's rules (optional ?load_id=)
// POST /api/insights/alerts            — create a new rule
//
// Channels: 'push' uses the user's existing push_subscriptions; 'email' uses
// Resend with the user's auth.users.email; 'sms' is a NO-OP until Twilio
// 10DLC registration completes; 'mcp_log' creates a dispatch row for AI
// workflows that poll via MCP without external delivery.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";

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

const TRIGGERS = [
  "wait_threshold",
  "p_make_appt_below",
  "detention_dollars_above",
  "anomaly_at_recommended",
  "eta_slip_minutes",
] as const;

const CreateRuleSchema = z.object({
  load_id: z.string().uuid().nullable().optional(),
  trigger_kind: z.enum(TRIGGERS),
  threshold_value: z.number(),
  channel: z.enum(["push", "sms", "email", "mcp_log"]),
  cooldown_minutes: z.number().int().min(5).max(720).default(30),
  active: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const loadId = req.nextUrl.searchParams.get("load_id");
  let q = sb.from("operator_alert_rules").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  if (loadId) q = q.eq("load_id", loadId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(req: NextRequest) {
  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const parsed = CreateRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const { data, error } = await sb
    .from("operator_alert_rules")
    .insert({
      user_id: user.id,
      load_id: parsed.data.load_id ?? null,
      trigger_kind: parsed.data.trigger_kind,
      threshold_value: parsed.data.threshold_value,
      channel: parsed.data.channel,
      cooldown_minutes: parsed.data.cooldown_minutes,
      active: parsed.data.active,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data }, { status: 201 });
}
