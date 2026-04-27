// Pillar 4 Wallet — document metadata + (optional) encrypted blob URL.
// Blob payloads are encrypted client-side (AES-GCM with PBKDF2 from a
// user-chosen passphrase). Server stores ciphertext URL + IV + salt;
// it never sees the passphrase or plaintext.

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

const DOC_TYPES = [
  "passport", "passport_card", "sentri", "nexus", "global_entry",
  "mx_id", "mx_ine", "mx_passport", "vehicle_registration", "insurance",
  "fmm", "tip_permit", "other",
] as const;

const CreateSchema = z.object({
  doc_type: z.enum(DOC_TYPES),
  label: z.string().max(80).optional(),
  blob_url: z.string().url().optional(),
  encryption_iv: z.string().optional(),
  encryption_kdf_salt: z.string().optional(),
  expires_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  shared_with_circle_id: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await sb
    .from("wallet_documents")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(req: NextRequest) {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = CreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "validation failed", issues: parsed.error.issues }, { status: 400 });

  const { data, error } = await sb
    .from("wallet_documents")
    .insert({ user_id: user.id, ...parsed.data })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data }, { status: 201 });
}
