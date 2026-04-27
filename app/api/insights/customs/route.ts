// Customs declaration generator — operator-facing.
// POST /api/insights/customs   — create + render
// GET  /api/insights/customs   — list user's declarations

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";
import { generateDeclaration, type DeclarationInput } from "@/lib/customsForms";

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

const HsLineSchema = z.object({
  hs_code: z.string().min(4).max(12),
  description: z.string().min(1).max(300),
  qty: z.number().positive(),
  unit: z.string().min(1).max(8),
  unit_value_usd: z.number().min(0),
  origin_country: z.string().length(2),
  duty_rate_pct: z.number().min(0).max(100).optional(),
  fta_eligible: z.boolean().optional(),
  fta_criterion: z.enum(["A", "B", "C", "D"]).optional(),
  rvc_method: z.enum(["transaction", "net_cost"]).optional(),
  rvc_pct: z.number().min(0).max(100).optional(),
});

const InputSchema = z.object({
  load_id: z.string().uuid().nullable().optional(),
  form_type: z.enum(["cbp_7501", "pace", "padv", "immex_manifest", "generic_invoice"]),
  lane: z.string().min(1).max(60),
  importer_name: z.string().min(1).max(120),
  importer_ein: z.string().max(20).optional(),
  exporter_name: z.string().min(1).max(120),
  origin_country: z.string().length(2).default("MX"),
  destination_country: z.string().length(2).default("US"),
  port_of_entry: z.string().max(8).optional(),
  manifest_number: z.string().max(40).optional(),
  bill_of_lading: z.string().max(60).optional(),
  invoice_number: z.string().max(40).optional(),
  invoice_date: z.string().optional(),
  incoterms: z.enum(["EXW", "FCA", "CPT", "CIP", "DAP", "DDP", "FOB", "CFR", "CIF"]).optional(),
  currency: z.string().length(3).default("USD"),
  exchange_rate_to_usd: z.number().positive().optional(),
  fta_claimed: z.enum(["USMCA", "GSP", "CBI", "NONE"]).default("NONE"),
  hs_codes: z.array(HsLineSchema).min(1).max(50),
  generator_disclaimer_acked: z.boolean().default(false),
});

export async function GET() {
  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await sb
    .from("customs_declarations")
    .select("id, load_id, form_type, lane, importer_name, exporter_name, status, invoice_total_usd, fta_claimed, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ declarations: data ?? [] });
}

export async function POST(req: NextRequest) {
  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const input: DeclarationInput = parsed.data as unknown as DeclarationInput;
  const out = generateDeclaration(input);

  const { data, error } = await sb
    .from("customs_declarations")
    .insert({
      user_id: user.id,
      load_id: parsed.data.load_id ?? null,
      form_type: parsed.data.form_type,
      lane: parsed.data.lane,
      importer_name: parsed.data.importer_name,
      importer_ein: parsed.data.importer_ein,
      exporter_name: parsed.data.exporter_name,
      origin_country: parsed.data.origin_country,
      destination_country: parsed.data.destination_country,
      hs_codes: parsed.data.hs_codes,
      invoice_total_usd: out.payload.calculated.invoice_total_usd,
      fta_claimed: parsed.data.fta_claimed === "NONE" ? null : parsed.data.fta_claimed,
      payload: out.payload,
      status: parsed.data.generator_disclaimer_acked ? "generated" : "draft",
      generator_disclaimer_acked: parsed.data.generator_disclaimer_acked,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    declaration: data,
    rendered: { markdown: out.markdown, text: out.text },
    warnings: out.warnings,
  }, { status: 201 });
}
