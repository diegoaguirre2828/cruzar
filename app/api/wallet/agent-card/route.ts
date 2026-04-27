// Agent-prep card — bilingual one-page summary the user shows the CBP
// officer at the booth. Renders WHAT documents the user has on hand
// (not the document contents) + key dates + USMCA/SENTRI flags.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, { en: string; es: string }> = {
  passport: { en: "Passport", es: "Pasaporte" },
  passport_card: { en: "Passport card", es: "Tarjeta de pasaporte" },
  sentri: { en: "SENTRI", es: "SENTRI" },
  nexus: { en: "NEXUS", es: "NEXUS" },
  global_entry: { en: "Global Entry", es: "Global Entry" },
  mx_id: { en: "MX ID", es: "Identificación MX" },
  mx_ine: { en: "INE", es: "INE" },
  mx_passport: { en: "MX passport", es: "Pasaporte MX" },
  vehicle_registration: { en: "Vehicle registration", es: "Tarjeta de circulación" },
  insurance: { en: "Insurance", es: "Seguro" },
  fmm: { en: "FMM", es: "FMM" },
  tip_permit: { en: "TIP", es: "Permiso TIP" },
  other: { en: "Other", es: "Otro" },
};

export async function GET() {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: docs } = await sb
    .from("wallet_documents")
    .select("doc_type, label, expires_at")
    .eq("user_id", user.id)
    .order("doc_type", { ascending: true });

  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push("# Cruzar — Agent prep card / Tarjeta para el agente");
  lines.push("");
  lines.push("**EN:** Documents I'm carrying right now. Show this on your phone if helpful.");
  lines.push("**ES:** Documentos que llevo en este momento. Muéstrelo en su teléfono si ayuda.");
  lines.push("");
  lines.push("## On hand / En mano");
  if (!docs || docs.length === 0) {
    lines.push("- _(no documents added yet / sin documentos agregados)_");
  } else {
    for (const d of docs) {
      const lbl = TYPE_LABELS[d.doc_type] || { en: d.doc_type, es: d.doc_type };
      const exp = d.expires_at
        ? d.expires_at < today
          ? ` ⚠️ EXPIRED ${d.expires_at}`
          : ` (exp ${d.expires_at})`
        : "";
      lines.push(`- **${lbl.en} / ${lbl.es}**${d.label ? ` — ${d.label}` : ""}${exp}`);
    }
  }
  lines.push("");
  lines.push("## Phrases / Frases");
  lines.push("- **EN:** \"My passport is in my hand. I'm a US citizen / lawful resident.\"");
  lines.push("- **ES:** \"Mi pasaporte está en mi mano. Soy ciudadano / residente legal.\"");
  lines.push("- **EN:** \"Nothing to declare. / I have items to declare.\"");
  lines.push("- **ES:** \"Nada que declarar. / Tengo artículos para declarar.\"");
  lines.push("");
  lines.push("_Generated " + new Date().toISOString() + " — Cruzar_");

  return NextResponse.json({ markdown: lines.join("\n"), generated_at: new Date().toISOString() });
}
