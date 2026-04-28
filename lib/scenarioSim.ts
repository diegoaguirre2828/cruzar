// Scenario Sim v0 — actionable cascade prediction for dispatcher decisions.
//
// Input: a scenario description ("Pharr closes 4 hours Friday 6am") + optional
// fleet context (current/upcoming loads).
//
// Output: primary recommendation in actionable hours-vs-alternative form,
// alternatives ranked, cascade predictions, and a simulated dispatcher-panel
// transcript that doubles as deliverable content.
//
// Per round-2 pressure-test (2026-04-28): output must be actionable,
// risk-weighted, decision-grade — NEVER abstract narrative. The "+2.3h vs
// alternative" form is mandatory.
//
// Per safety-audit rule (`feedback_safety_audit_before_scaling_automation_20260428`):
// every output explicitly labels itself as SIMULATION not advice, includes
// caveats about uncertainty, and never claims to predict actual real-world
// CBP wait times — only the dispatcher's expected differential.

import Anthropic from "@anthropic-ai/sdk";
import { PORT_META, getPortMeta } from "./portMeta";
import { logCalibrationPrediction } from "./calibration";

// Canonical port label from PORT_META — supersedes whatever Haiku chose.
// Eliminates label/port_id drift (e.g. "Nuevo Progreso ↔ Donna" labeled on a
// 230901-only port_id), keeps every output internally consistent.
function canonicalPortLabel(portId: string): string {
  const meta = getPortMeta(portId);
  return meta.localName ? `${meta.localName} (${meta.city})` : meta.city;
}

function isValidPortId(portId: unknown): portId is string {
  return typeof portId === "string" && portId in PORT_META;
}

export const SCENARIO_SIM_VERSION = "v0";

export type Lang = "en" | "es";
export type Confidence = "high" | "moderate" | "low";

export interface ScenarioInput {
  scenario: string; // free text, e.g. "Pharr closes 4 hours Friday 6am"
  origin?: { lat: number; lng: number; label?: string }; // optional load origin
  destination?: { lat: number; lng: number; label?: string }; // optional dock
  appointment_time_iso?: string; // optional appointment
  lang?: Lang; // default "en"
}

export interface PanelTranscriptLine {
  speaker: string; // e.g. "Broker", "Dispatcher", "Customs Agent"
  line: string;
}

export interface ScenarioSimOutput {
  scenario: string;
  generated_at: string; // ISO
  lang: Lang;
  primary_recommendation: {
    port_id: string;
    port_label: string;
    delta_vs_baseline_minutes: number; // e.g. 138 = +2.3h vs baseline
    reasoning: string;
    confidence: Confidence;
  };
  alternatives: {
    port_id: string;
    port_label: string;
    delta_vs_baseline_minutes: number;
    note: string;
  }[];
  cascade_predictions: string[]; // 2-4 bullet predictions about volume cascade
  transcript: {
    panelists: string[];
    excerpts: PanelTranscriptLine[];
  };
  caveats: string[];
  is_simulation: true; // explicit flag, never lies
}

// Compact port snapshot for the prompt — keeps grounding small but real.
function portSnapshotForPrompt(): string {
  const lines: string[] = [];
  for (const [id, meta] of Object.entries(PORT_META)) {
    if (meta.megaRegion === "rgv" || meta.megaRegion === "laredo") {
      lines.push(`${id} | ${meta.city} (${meta.region}) | lat=${meta.lat.toFixed(3)} lng=${meta.lng.toFixed(3)}`);
    }
  }
  return lines.join("\n");
}

const SYSTEM_PROMPT_EN = `You are a dispatcher decision-support agent for the US-Mexico border crossing context (RGV + Laredo). You produce SIMULATION output, never claims of fact about actual current wait times.

Your output MUST be actionable, risk-weighted, and decision-grade. Forbidden output forms:
- Abstract narrative ("the situation is complex")
- Multi-paragraph essays
- Hedged maybes without numbers

Required output form:
- Primary recommendation: a specific port + the differential vs the implied baseline alternative, in MINUTES (and hours when relevant). Example: "+138 minutes (+2.3h) vs Reynosa-Hidalgo alternative"
- 1-3 alternatives, ranked
- 2-4 cascade predictions (what happens to OTHER ports as result)
- A simulated panel transcript: 4-8 short exchanges between a Broker, Dispatcher, and Customs Agent

Always include caveats: this is SIMULATION, not real-time prediction. Cascade modeling is approximate. Real CBP data may diverge.

Reply with JSON only, matching the schema. Do not include any text outside the JSON.`;

const SYSTEM_PROMPT_ES = `Eres un agente de apoyo a decisiones de despachadores en el contexto de cruces fronterizos US-México (RGV + Laredo). Tu salida es SIMULACIÓN, nunca afirmaciones de hecho sobre tiempos de espera actuales.

Tu salida DEBE ser accionable, ponderada por riesgo, y de calidad de decisión. Formas prohibidas:
- Narrativa abstracta ("la situación es compleja")
- Ensayos de múltiples párrafos
- Quizás cubiertos sin números

Forma requerida:
- Recomendación primaria: un puerto específico + el diferencial contra la alternativa baseline implícita, en MINUTOS (y horas cuando sea relevante). Ejemplo: "+138 minutos (+2.3h) vs alternativa Reynosa-Hidalgo"
- 1-3 alternativas, clasificadas
- 2-4 predicciones de cascada (qué pasa con OTROS puertos como resultado)
- Transcripción simulada de panel: 4-8 intercambios cortos entre un Broker, Despachador, y Agente Aduanal

Incluye siempre advertencias: esto es SIMULACIÓN, no predicción en tiempo real. El modelado de cascada es aproximado. Los datos reales de CBP pueden divergir.

Responde solo con JSON, coincidiendo con el esquema. No incluyas texto fuera del JSON.`;

const RESPONSE_SCHEMA_DOC = `Required JSON shape:
{
  "primary_recommendation": {
    "port_id": "<one of the port IDs from the snapshot>",
    "port_label": "<MX side / US side bridge name>",
    "delta_vs_baseline_minutes": <integer, can be negative>,
    "reasoning": "<one sentence>",
    "confidence": "high" | "moderate" | "low"
  },
  "alternatives": [
    {
      "port_id": "...",
      "port_label": "...",
      "delta_vs_baseline_minutes": <integer>,
      "note": "<one sentence>"
    }
  ],
  "cascade_predictions": ["<bullet>", "<bullet>"],
  "transcript": {
    "panelists": ["Broker", "Dispatcher", "Customs Agent"],
    "excerpts": [
      { "speaker": "Broker", "line": "..." }
    ]
  },
  "caveats": ["<caveat>"]
}`;

export async function runScenarioSim(input: ScenarioInput): Promise<ScenarioSimOutput> {
  const lang = input.lang ?? "en";
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY missing in environment");
  }

  const client = new Anthropic({ apiKey });

  const portSnapshot = portSnapshotForPrompt();
  const userContext: string[] = [];
  if (input.origin) {
    userContext.push(`Origin: ${input.origin.label ?? "load"} @ ${input.origin.lat.toFixed(4)}, ${input.origin.lng.toFixed(4)}`);
  }
  if (input.destination) {
    userContext.push(`Destination: ${input.destination.label ?? "dock"} @ ${input.destination.lat.toFixed(4)}, ${input.destination.lng.toFixed(4)}`);
  }
  if (input.appointment_time_iso) {
    userContext.push(`Appointment: ${input.appointment_time_iso}`);
  }
  const contextBlock = userContext.length ? `\n\nLoad context:\n${userContext.join("\n")}` : "";

  const userMessage = `Scenario: ${input.scenario}${contextBlock}

Available RGV + Laredo ports:
${portSnapshot}

${RESPONSE_SCHEMA_DOC}`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001", // default Haiku per $30 budget rule
    max_tokens: 3000,
    system: lang === "es" ? SYSTEM_PROMPT_ES : SYSTEM_PROMPT_EN,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  // Strip optional code fences if model wraps the JSON.
  const cleaned = text.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Scenario sim returned non-JSON output: ${cleaned.slice(0, 200)}`);
  }

  // Minimal shape validation — the model is reliable but we're explicit.
  const obj = parsed as Record<string, unknown>;
  if (!obj.primary_recommendation || !Array.isArray(obj.alternatives) || !Array.isArray(obj.cascade_predictions) || !obj.transcript) {
    throw new Error("Scenario sim output missing required fields");
  }

  // Port hygiene — Haiku occasionally drifts the port_label even when the
  // port_id is valid (e.g. labels 230901 as "Progreso/Donna" mixing 230901
  // + 230902). Validate every port_id against PORT_META; replace the label
  // with the canonical name. Drop alternatives whose port_id is not real.
  const primary = obj.primary_recommendation as Record<string, unknown>;
  if (!isValidPortId(primary.port_id)) {
    throw new Error(
      `Scenario sim primary port_id "${String(primary.port_id)}" not in PORT_META — re-run`,
    );
  }
  primary.port_label = canonicalPortLabel(primary.port_id);

  const cleanAlternatives = (obj.alternatives as Array<Record<string, unknown>>)
    .filter((a) => isValidPortId(a.port_id))
    .map((a) => {
      a.port_label = canonicalPortLabel(a.port_id as string);
      return a;
    });
  obj.alternatives = cleanAlternatives;

  const baseCaveats: string[] =
    lang === "es"
      ? [
          "Esta es una SIMULACIÓN. No reemplaza datos en vivo de CBP ni el juicio del despachador.",
          "El modelado de cascada es aproximado y no garantiza tiempos reales de espera.",
        ]
      : [
          "This is a SIMULATION. Not a substitute for live CBP data or dispatcher judgment.",
          "Cascade modeling is approximate and does not guarantee real wait times.",
        ];

  const userCaveats = Array.isArray(obj.caveats) ? (obj.caveats as string[]) : [];
  const allCaveats = [...baseCaveats, ...userCaveats];

  const result: ScenarioSimOutput = {
    scenario: input.scenario,
    generated_at: new Date().toISOString(),
    lang,
    primary_recommendation: obj.primary_recommendation as ScenarioSimOutput["primary_recommendation"],
    alternatives: obj.alternatives as ScenarioSimOutput["alternatives"],
    cascade_predictions: obj.cascade_predictions as string[],
    transcript: obj.transcript as ScenarioSimOutput["transcript"],
    caveats: allCaveats,
    is_simulation: true,
  };

  // Calibration log write — non-blocking, fire-and-forget.
  // Stores the prediction so we can later compare predicted_minutes against
  // observed CBP wait differential for the same time window.
  const tags: string[] = [
    `port:${result.primary_recommendation.port_id}`,
    `lang:${lang}`,
    `confidence:${result.primary_recommendation.confidence}`,
  ];
  if (input.appointment_time_iso) tags.push("has_appointment");
  if (input.origin) tags.push("has_origin");

  void logCalibrationPrediction({
    project: "cruzar",
    sim_kind: "scenario-sim",
    sim_version: SCENARIO_SIM_VERSION,
    predicted: {
      primary_port_id: result.primary_recommendation.port_id,
      primary_delta_minutes: result.primary_recommendation.delta_vs_baseline_minutes,
      primary_confidence: result.primary_recommendation.confidence,
      alternatives: result.alternatives.map((a) => ({
        port_id: a.port_id,
        delta_minutes: a.delta_vs_baseline_minutes,
      })),
      cascade_count: result.cascade_predictions.length,
    },
    context: {
      scenario: input.scenario,
      origin: input.origin ?? null,
      destination: input.destination ?? null,
      appointment_time_iso: input.appointment_time_iso ?? null,
    },
    tags,
  });

  return result;
}
