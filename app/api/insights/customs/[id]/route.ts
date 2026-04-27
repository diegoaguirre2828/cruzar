import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const { data, error } = await sb
    .from("customs_declarations")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Re-render from stored payload
  const input = data.payload as DeclarationInput;
  const out = generateDeclaration(input);
  return NextResponse.json({ declaration: data, rendered: { markdown: out.markdown, text: out.text }, warnings: out.warnings });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const allowed: Record<string, unknown> = {};
  if (typeof body.status === "string") allowed.status = body.status;
  if (typeof body.generator_disclaimer_acked === "boolean") allowed.generator_disclaimer_acked = body.generator_disclaimer_acked;
  const { data, error } = await sb
    .from("customs_declarations")
    .update(allowed)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ declaration: data });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const { error } = await sb.from("customs_declarations").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
