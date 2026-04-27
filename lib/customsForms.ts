// Customs declaration generator — produces structured payload + readable
// text/markdown for operator review. NOT a substitute for a licensed
// customs broker; the disclaimer must be ack'd before status moves out
// of 'draft'. CBP Form 7501 is the legal entry-summary document; we
// generate the payload that an operator hands to their broker for
// filing through ACE.
//
// Scope:
//   form_type = 'cbp_7501'         -> US import entry summary
//   form_type = 'pace'             -> Mexico Pedimento (border simple variant)
//   form_type = 'padv'             -> Mexico Pedimento de Aviso
//   form_type = 'immex_manifest'   -> IMMEX maquila manifest
//   form_type = 'generic_invoice'  -> commercial invoice + packing summary

export type FormType = "cbp_7501" | "pace" | "padv" | "immex_manifest" | "generic_invoice";

export interface HsLineItem {
  hs_code: string;            // 10-digit HTS for cbp_7501; 8-digit for MX forms
  description: string;
  qty: number;
  unit: string;               // e.g. 'EA', 'KG', 'PCS', 'L'
  unit_value_usd: number;
  origin_country: string;     // ISO-2
  duty_rate_pct?: number;     // override; null → look up MFN
  fta_eligible?: boolean;
  fta_criterion?: "A" | "B" | "C" | "D";  // USMCA preference criteria
  rvc_method?: "transaction" | "net_cost";
  rvc_pct?: number;
}

export interface DeclarationInput {
  form_type: FormType;
  lane: string;
  importer_name: string;
  importer_ein?: string;       // 9-digit EIN, or 11-digit IRS suffix
  exporter_name: string;
  origin_country: string;
  destination_country: string;
  port_of_entry?: string;      // CBP district/port code (5-digit)
  manifest_number?: string;
  bill_of_lading?: string;
  invoice_number?: string;
  invoice_date?: string;
  incoterms?: "EXW" | "FCA" | "CPT" | "CIP" | "DAP" | "DDP" | "FOB" | "CFR" | "CIF";
  currency: string;            // 3-letter ISO
  exchange_rate_to_usd?: number;
  fta_claimed?: "USMCA" | "GSP" | "CBI" | "NONE";
  hs_codes: HsLineItem[];
}

export interface DeclarationOutput {
  payload: DeclarationInput & { calculated: CalculatedTotals };
  markdown: string;
  text: string;
  warnings: string[];
}

export interface CalculatedTotals {
  invoice_total_usd: number;
  total_duty_usd: number;
  effective_duty_rate_pct: number;
  fta_savings_usd: number;
  line_breakdowns: Array<{
    hs_code: string;
    description: string;
    qty: number;
    unit_value_usd: number;
    line_value_usd: number;
    duty_rate_used_pct: number;
    duty_usd: number;
    fta_applied: boolean;
    rvc_pct: number | null;
  }>;
}

// Best-effort MFN duty rate lookup. Conservative defaults: most goods
// land 0–6.5%. We DO NOT pretend this is authoritative — a broker must
// confirm the actual HTS rate from the current Harmonized Tariff Schedule.
function fallbackMfnRatePct(hs10: string): number {
  const ch = hs10.slice(0, 2);
  // Rough industry-bucket fallbacks. Safe-side overestimate.
  if (["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].includes(ch)) return 5.0; // ag/food
  if (["28", "29", "30"].includes(ch)) return 4.0; // chems/pharma
  if (["39", "40"].includes(ch)) return 5.5; // plastics/rubber
  if (["44", "48", "49"].includes(ch)) return 3.0; // wood/paper
  if (["50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "60", "61", "62", "63"].includes(ch)) return 12.0; // textiles
  if (["64"].includes(ch)) return 9.0; // footwear
  if (["72", "73", "74", "75", "76", "78", "79", "80", "81", "82", "83"].includes(ch)) return 4.5; // metals
  if (["84", "85"].includes(ch)) return 2.5; // machinery/electronics
  if (["87"].includes(ch)) return 2.5; // vehicles
  if (["94", "95", "96"].includes(ch)) return 4.0; // furniture/toys/misc
  return 4.0;
}

export function generateDeclaration(input: DeclarationInput): DeclarationOutput {
  const warnings: string[] = [];
  if (!input.importer_ein && input.form_type === "cbp_7501") {
    warnings.push("CBP 7501 normally requires an Importer of Record number (EIN/IRS). Add before broker filing.");
  }
  if (input.fta_claimed === "USMCA") {
    for (const li of input.hs_codes) {
      if (!li.fta_criterion) {
        warnings.push(`HS ${li.hs_code}: USMCA criterion missing (A/B/C/D required per Annex 5-A).`);
      }
      if (li.fta_criterion === "B" && (li.rvc_pct == null || li.rvc_pct < 60)) {
        warnings.push(`HS ${li.hs_code}: criterion B requires RVC ≥ 60% (transaction) or ≥ 50% (net cost). Provided: ${li.rvc_pct ?? "—"}.`);
      }
    }
  }
  for (const li of input.hs_codes) {
    if (input.form_type === "cbp_7501" && li.hs_code.replace(/\D/g, "").length < 10) {
      warnings.push(`HS ${li.hs_code} is shorter than 10 digits — CBP 7501 needs the full HTSUS line.`);
    }
  }

  const lines = input.hs_codes.map((li) => {
    const lineValue = +(li.qty * li.unit_value_usd).toFixed(2);
    const usmcaApplies = input.fta_claimed === "USMCA" && Boolean(li.fta_eligible);
    const rateRaw = li.duty_rate_pct ?? fallbackMfnRatePct(li.hs_code);
    const rateUsed = usmcaApplies ? 0 : rateRaw;
    const duty = +((lineValue * rateUsed) / 100).toFixed(2);
    return {
      hs_code: li.hs_code,
      description: li.description,
      qty: li.qty,
      unit_value_usd: li.unit_value_usd,
      line_value_usd: lineValue,
      duty_rate_used_pct: rateUsed,
      duty_usd: duty,
      fta_applied: usmcaApplies,
      rvc_pct: li.rvc_pct ?? null,
    };
  });

  const invoice_total_usd = +lines.reduce((s, l) => s + l.line_value_usd, 0).toFixed(2);
  const total_duty_usd = +lines.reduce((s, l) => s + l.duty_usd, 0).toFixed(2);
  const effective_duty_rate_pct = invoice_total_usd > 0 ? +((total_duty_usd / invoice_total_usd) * 100).toFixed(2) : 0;
  const fta_savings_usd = +lines.reduce((s, l, i) => {
    const li = input.hs_codes[i];
    if (!l.fta_applied) return s;
    const mfn = li.duty_rate_pct ?? fallbackMfnRatePct(li.hs_code);
    return s + (l.line_value_usd * mfn) / 100;
  }, 0).toFixed(2);

  const calculated: CalculatedTotals = {
    invoice_total_usd,
    total_duty_usd,
    effective_duty_rate_pct,
    fta_savings_usd,
    line_breakdowns: lines,
  };

  const markdown = renderMarkdown(input, calculated);
  const text = renderText(input, calculated);

  return { payload: { ...input, calculated }, markdown, text, warnings };
}

function renderMarkdown(d: DeclarationInput, c: CalculatedTotals): string {
  const lines: string[] = [];
  const formTitle: Record<FormType, string> = {
    cbp_7501: "CBP Form 7501 — Entry Summary (US)",
    pace: "Pedimento PACE (MX)",
    padv: "Pedimento de Aviso (MX)",
    immex_manifest: "IMMEX Maquila Manifest",
    generic_invoice: "Commercial Invoice + Summary",
  };
  lines.push(`# ${formTitle[d.form_type]}`);
  lines.push("");
  lines.push("> **Generated by Cruzar Insights — verify with your licensed customs broker before filing.** This document is a structured working draft, not a binding entry filing. The HTS rate fallbacks are conservative buckets, not authoritative HTSUS lookups. Importer of record bears legal responsibility for the entry under 19 USC § 1592.");
  lines.push("");
  lines.push("## Parties & lane");
  lines.push(`- **Importer:** ${d.importer_name}${d.importer_ein ? ` (EIN: ${d.importer_ein})` : ""}`);
  lines.push(`- **Exporter:** ${d.exporter_name}`);
  lines.push(`- **Origin → Destination:** ${d.origin_country} → ${d.destination_country}`);
  lines.push(`- **Lane:** ${d.lane}`);
  if (d.port_of_entry) lines.push(`- **Port of entry code:** ${d.port_of_entry}`);
  if (d.incoterms) lines.push(`- **Incoterms 2020:** ${d.incoterms}`);
  if (d.manifest_number) lines.push(`- **Manifest #:** ${d.manifest_number}`);
  if (d.bill_of_lading) lines.push(`- **BOL/AWB:** ${d.bill_of_lading}`);
  if (d.invoice_number) lines.push(`- **Invoice:** ${d.invoice_number} (${d.invoice_date ?? "date n/a"})`);
  lines.push("");
  lines.push("## Line items");
  lines.push("");
  for (const l of c.line_breakdowns) {
    lines.push(`### ${l.hs_code} — ${l.description}`);
    lines.push(`- Qty: ${l.qty} · Unit: $${l.unit_value_usd.toFixed(2)} · Line value: **$${l.line_value_usd.toFixed(2)}**`);
    lines.push(`- Duty rate applied: **${l.duty_rate_used_pct}%** → duty $${l.duty_usd.toFixed(2)}`);
    if (l.fta_applied) lines.push(`- USMCA preference: ✅ applied${l.rvc_pct != null ? ` · RVC ${l.rvc_pct}%` : ""}`);
    lines.push("");
  }
  lines.push("## Totals");
  lines.push(`- Invoice value (USD): **$${c.invoice_total_usd.toFixed(2)}**`);
  lines.push(`- Duty (USD): **$${c.total_duty_usd.toFixed(2)}** (effective ${c.effective_duty_rate_pct}%)`);
  if (c.fta_savings_usd > 0) lines.push(`- USMCA savings vs MFN: **$${c.fta_savings_usd.toFixed(2)}**`);
  lines.push("");
  lines.push("## Filing checklist");
  lines.push("- [ ] Importer EIN active on ACE");
  lines.push("- [ ] Surety bond covers entry value");
  lines.push("- [ ] Commercial invoice attached (19 CFR § 141.86)");
  lines.push("- [ ] Packing list matches BOL count");
  if (d.fta_claimed === "USMCA") {
    lines.push("- [ ] USMCA certification with all 9 data elements (Article 5.2)");
    lines.push("- [ ] RVC supporting documentation retained 5 yrs");
  }
  lines.push("- [ ] Restricted-party screening cleared on importer + exporter");
  lines.push("- [ ] PGA (FDA / USDA / EPA / FCC) requirements identified");
  lines.push("");
  lines.push("_Generator version: v1 · Cruzar Insights — broker-grade draft, not a filing._");
  return lines.join("\n");
}

function renderText(d: DeclarationInput, c: CalculatedTotals): string {
  return renderMarkdown(d, c).replace(/^#+\s*/gm, "").replace(/\*\*/g, "");
}
