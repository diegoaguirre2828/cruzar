// Cruzar Insights WhatsApp inbound intent parser + reply builder.
//
// Dispatchers don't open Cursor — they live in WhatsApp. v0 supports two
// intents: "live wait at <port>" and a help fallback. Lang detected by simple
// Spanish-token check; defaults to ES for the RGV/MX audience.
//
// Cited rationale: project_cruzar_rgv_freight_broker_research_20260429.md
// — "WhatsApp is the operating system of US-MX cross-border freight."

import { PORT_META } from "./portMeta";
import { getServiceClient } from "./supabase";

export type IntentKind = "live_wait" | "best_now" | "anomaly" | "help" | "stop";

export interface ParsedIntent {
  kind: IntentKind;
  port_id?: string;
  lang: "en" | "es";
  raw: string;
}

// Port-name keyword map — substring matched against normalized inbound text.
// Order matters: longer/more-specific keywords first so "pharr-reynosa" wins
// before "pharr". When a keyword matches, we pick the first port_id listed.
const PORT_KEYWORDS: Array<{ keywords: string[]; port_id: string }> = [
  // RGV (highest-volume corridor for first customers)
  { keywords: ["pharr-reynosa", "pharr"], port_id: "230502" },
  { keywords: ["anzaldua", "anzalduas"], port_id: "230503" },
  { keywords: ["hidalgo", "mcallen-hidalgo"], port_id: "230501" },
  { keywords: ["progreso"], port_id: "230901" },
  { keywords: ["donna"], port_id: "230902" },
  { keywords: ["roma"], port_id: "231001" },
  { keywords: ["rio grande city", "rgc"], port_id: "230701" },
  { keywords: ["gateway", "brownsville-gateway", "b&m"], port_id: "535501" },
  { keywords: ["veterans", "brownsville-veterans"], port_id: "535502" },
  { keywords: ["los tomates", "los-tomates"], port_id: "535503" },
  // Laredo
  { keywords: ["world trade", "wtb", "laredo ii", "laredo-ii", "laredo 2"], port_id: "230402" },
  { keywords: ["colombia"], port_id: "230403" },
  { keywords: ["laredo i", "laredo-i", "laredo 1", "gateway international"], port_id: "230401" },
  // Eagle Pass / Del Rio
  { keywords: ["eagle pass ii", "eagle-pass-ii", "eagle pass 2"], port_id: "240202" },
  { keywords: ["eagle pass"], port_id: "240201" },
  { keywords: ["del rio"], port_id: "240301" },
  // El Paso
  { keywords: ["paso del norte", "pdn"], port_id: "240801" },
  { keywords: ["bota", "bridge of the americas"], port_id: "240601" },
  { keywords: ["ysleta", "zaragoza"], port_id: "240221" },
  // Just match "laredo" generically last to avoid clobbering laredo i/ii
  { keywords: ["laredo"], port_id: "230402" },
];

const SPANISH_TOKENS = [
  "espera",
  "puente",
  "ahorita",
  "ahora",
  "cruzar",
  "cruzando",
  "tiempo",
  "hola",
  "buenos",
  "mejor",
  "ahorita",
];

const STOP_TOKENS = ["stop", "alto", "pausa", "unsubscribe", "cancelar"];
const WAIT_INTENT_TOKENS = [
  "wait",
  "espera",
  "espera en",
  "wait at",
  "how long",
  "cuanto",
  "cuánto",
  "tiempo en",
  "tiempo de",
  "time at",
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectLang(text: string): "en" | "es" {
  const t = normalize(text);
  for (const tok of SPANISH_TOKENS) {
    if (t.includes(tok)) return "es";
  }
  return "en";
}

export function resolvePortId(text: string): string | null {
  const t = normalize(text);
  for (const entry of PORT_KEYWORDS) {
    for (const kw of entry.keywords) {
      if (t.includes(normalize(kw))) return entry.port_id;
    }
  }
  return null;
}

export function parseInbound(text: string): ParsedIntent {
  const lang = detectLang(text);
  const t = normalize(text);

  // STOP intent — always wins
  if (STOP_TOKENS.some((tok) => t === tok || t.startsWith(`${tok} `))) {
    return { kind: "stop", lang, raw: text };
  }

  // ANOMALY — list ports running hot right now (no port required)
  if (/\b(anomaly|anomalia|hot|caliente|que esta mal|qu[eé] est[aá] mal)\b/.test(t)) {
    return { kind: "anomaly", lang, raw: text };
  }

  // BEST NOW — recommend a port across the corridor (no port required)
  if (/\b(best now|best port|mejor puente|mejor ahora|recommend|recomienda|cual cruzo|cu[aá]l cruzo)\b/.test(t)) {
    return { kind: "best_now", lang, raw: text };
  }

  // Wait intent — explicit wait verb OR a recognized port name alone
  const port_id = resolvePortId(text);
  const hasWaitVerb = WAIT_INTENT_TOKENS.some((tok) => t.includes(tok));

  if (port_id) {
    return { kind: "live_wait", port_id, lang, raw: text };
  }

  if (hasWaitVerb && !port_id) {
    return { kind: "help", lang, raw: text };
  }

  return { kind: "help", lang, raw: text };
}

interface LatestReading {
  vehicle_wait: number | null;
  sentri_wait: number | null;
  pedestrian_wait: number | null;
  commercial_wait: number | null;
  recorded_at: string;
}

async function fetchLatestReading(port_id: string): Promise<LatestReading | null> {
  try {
    const db = getServiceClient();
    const { data, error } = await db
      .from("wait_time_readings")
      .select("vehicle_wait, sentri_wait, pedestrian_wait, commercial_wait, recorded_at")
      .eq("port_id", port_id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as LatestReading;
  } catch {
    return null;
  }
}

function formatTime(iso: string, lang: "en" | "es"): string {
  // CT (Texas/RGV) display — most users in this timezone.
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(lang === "es" ? "es-MX" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Chicago",
    });
  } catch {
    return iso;
  }
}

function portLabel(port_id: string): string {
  const meta = PORT_META[port_id];
  if (!meta) return port_id;
  const name = meta.localName ?? meta.city;
  return `${name} (${meta.region})`;
}

export async function buildLiveWaitReply(port_id: string, lang: "en" | "es"): Promise<string> {
  const label = portLabel(port_id);
  const reading = await fetchLatestReading(port_id);
  if (!reading) {
    return lang === "es"
      ? `Cruzar — sin lectura reciente para ${label}. Intenta otro puerto.`
      : `Cruzar — no recent reading for ${label}. Try another port.`;
  }

  const lines: string[] = [];
  if (reading.vehicle_wait != null) {
    lines.push(
      lang === "es"
        ? `• Vehículos: ${reading.vehicle_wait} min`
        : `• Vehicle: ${reading.vehicle_wait} min`,
    );
  }
  if (reading.sentri_wait != null) {
    lines.push(
      lang === "es" ? `• SENTRI: ${reading.sentri_wait} min` : `• SENTRI: ${reading.sentri_wait} min`,
    );
  }
  if (reading.commercial_wait != null) {
    lines.push(
      lang === "es"
        ? `• Comercial: ${reading.commercial_wait} min`
        : `• Commercial: ${reading.commercial_wait} min`,
    );
  }
  if (reading.pedestrian_wait != null) {
    lines.push(
      lang === "es"
        ? `• Peatón: ${reading.pedestrian_wait} min`
        : `• Pedestrian: ${reading.pedestrian_wait} min`,
    );
  }
  if (lines.length === 0) {
    lines.push(lang === "es" ? "• Sin datos por carril" : "• No lane data");
  }

  const time = formatTime(reading.recorded_at, lang);
  const header =
    lang === "es"
      ? `*${label}* — actualizado ${time} CT`
      : `*${label}* — updated ${time} CT`;

  const tail =
    lang === "es"
      ? `\n\nEnvía otro puerto para más, o "stop" para pausar.`
      : `\n\nSend another port for more, or "stop" to pause.`;

  return [header, ...lines].join("\n") + tail;
}

export function buildHelpReply(lang: "en" | "es"): string {
  if (lang === "es") {
    return [
      "*Cruzar Insights* — escribe el nombre de un puente y te respondo con la espera viva.",
      "",
      "Ejemplos:",
      `• "espera en pharr"`,
      `• "hidalgo"`,
      `• "donna"`,
      `• "world trade"`,
      "",
      'Responde "stop" para pausar.',
    ].join("\n");
  }
  return [
    "*Cruzar Insights* — text any bridge name and I'll reply with the live wait.",
    "",
    "Examples:",
    `• "wait at pharr"`,
    `• "hidalgo"`,
    `• "donna"`,
    `• "world trade"`,
    "",
    'Reply "stop" to pause.',
  ].join("\n");
}

export function buildStopReply(lang: "en" | "es"): string {
  return lang === "es"
    ? "Cruzar — pausado. Escribe cualquier mensaje para reactivar."
    : "Cruzar — paused. Send any message to resume.";
}

/**
 * Anomaly scan across the covered corridor — returns a comma list of ports
 * running ≥1.5× their 90-day DOW × hour baseline right now.
 */
async function buildAnomalyReply(lang: "en" | "es"): Promise<string> {
  const COVERED = ['230501', '230502', '230503', '230402', '230401', '230301', '535502', '535501'];
  try {
    const db = getServiceClient();
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const ninety = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date();
    const dow = now.getDay();
    const hour = now.getHours();
    const [{ data: live }, { data: hist }] = await Promise.all([
      db.from('wait_time_readings').select('port_id, vehicle_wait').in('port_id', COVERED).gte('recorded_at', since).order('recorded_at', { ascending: false }).limit(500),
      db.from('wait_time_readings').select('port_id, vehicle_wait').in('port_id', COVERED).gte('recorded_at', ninety).eq('day_of_week', dow).eq('hour_of_day', hour).limit(20000),
    ]);
    const liveBy = new Map<string, number>();
    for (const r of live ?? []) if (!liveBy.has(String(r.port_id)) && r.vehicle_wait != null) liveBy.set(String(r.port_id), r.vehicle_wait);
    const sums = new Map<string, { s: number; n: number }>();
    for (const r of hist ?? []) {
      if (r.vehicle_wait == null) continue;
      const cur = sums.get(String(r.port_id)) ?? { s: 0, n: 0 };
      cur.s += r.vehicle_wait; cur.n += 1; sums.set(String(r.port_id), cur);
    }
    const hot: string[] = [];
    for (const pid of COVERED) {
      const lv = liveBy.get(pid); const sm = sums.get(pid);
      if (lv == null || !sm || sm.n === 0) continue;
      const ratio = lv / (sm.s / sm.n);
      if (ratio >= 1.5) {
        const meta = PORT_META[pid];
        hot.push(`${meta?.localName ?? meta?.city ?? pid} ${ratio.toFixed(1)}×`);
      }
    }
    if (hot.length === 0) return lang === 'es' ? 'Cruzar — nada anómalo ahorita.' : 'Cruzar — nothing flagging right now.';
    return lang === 'es' ? `Cruzar — anómalos: ${hot.join(', ')}.` : `Cruzar — anomalies: ${hot.join(', ')}.`;
  } catch {
    return lang === 'es' ? 'Cruzar — error al consultar. Intenta de nuevo.' : 'Cruzar — query failed. Try again.';
  }
}

/**
 * Resolve an inbound message to a reply string. Returns null when no reply
 * should be sent (e.g., we couldn't even parse a coherent intent).
 */
export async function buildReplyForInbound(messageText: string): Promise<string | null> {
  if (!messageText || !messageText.trim()) return null;
  const intent = parseInbound(messageText);

  if (intent.kind === "stop") return buildStopReply(intent.lang);
  if (intent.kind === "anomaly") return buildAnomalyReply(intent.lang);
  if (intent.kind === "best_now") {
    return intent.lang === 'es'
      ? 'Cruzar — abre cruzar.app/dispatch para la recomendación.'
      : 'Cruzar — open cruzar.app/dispatch for the recommendation.';
  }
  if (intent.kind === "live_wait" && intent.port_id) {
    return buildLiveWaitReply(intent.port_id, intent.lang);
  }
  return buildHelpReply(intent.lang);
}
