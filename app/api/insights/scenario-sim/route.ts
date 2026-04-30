// POST /api/insights/scenario-sim
//
// Accepts a scenario description + optional load context, returns a Claude-
// generated SIMULATION (per `lib/scenarioSim.ts`) of recommended port,
// alternatives, cascade predictions, and a panel transcript.
//
// This is the v0 dispatcher-decision sim. Output is explicitly labeled
// SIMULATION (never claims real-time fact). Per the round-2 reviewer
// standard, output form is actionable hours-vs-alternative — not abstract
// narrative.
//
// No Supabase write in v0. Calibration logging (predicted vs observed)
// will wire when the calibration_log table lands cross-portfolio.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runScenarioSim } from "@/lib/scenarioSim";
import { runPersonaPanel, ROUTE_PERSONAS } from "@/lib/personaPanel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const InputSchema = z.object({
  scenario: z.string().min(8).max(800),
  origin: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      label: z.string().max(120).optional(),
    })
    .optional(),
  destination: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      label: z.string().max(120).optional(),
    })
    .optional(),
  appointment_time_iso: z.string().datetime().optional(),
  lang: z.enum(["en", "es"]).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await runScenarioSim(parsed.data);

    // MiroFish 3-persona panel — adds Driver / Dispatcher / Receiver Ops review
    // of the structured recommendation. Surfaces issues a single LLM pass
    // would miss (HOS, customer SLA, dock-window fit). Failure is non-fatal:
    // sim still ships even if panel call errors, just without the panel block.
    let panel: Awaited<ReturnType<typeof runPersonaPanel>> | null = null;
    try {
      panel = await runPersonaPanel({
        input: [
          "Pre-execution review of a dispatcher scenario simulation. The sim recommends a primary port + alternatives. From your perspective, is this the right call?",
          "",
          "SCENARIO:",
          parsed.data.scenario,
          "",
          "PRIMARY RECOMMENDATION:",
          `${result.primary_recommendation.port_label} (${result.primary_recommendation.port_id})`,
          `Delta vs baseline: ${result.primary_recommendation.delta_vs_baseline_minutes >= 0 ? "+" : ""}${result.primary_recommendation.delta_vs_baseline_minutes} min`,
          `Confidence: ${result.primary_recommendation.confidence}`,
          `Reasoning: ${result.primary_recommendation.reasoning}`,
          "",
          result.alternatives.length > 0
            ? `ALTERNATIVES: ${result.alternatives.map((a) => `${a.port_label} (${a.delta_vs_baseline_minutes >= 0 ? "+" : ""}${a.delta_vs_baseline_minutes}m)`).join(" · ")}`
            : "ALTERNATIVES: none",
          "",
          result.cascade_predictions.length > 0
            ? `CASCADE PREDICTIONS:\n${result.cascade_predictions.map((c) => `- ${c}`).join("\n")}`
            : "",
          "",
          "Each persona — assess from your professional standpoint:",
          "- Driver: hours-of-service, fuel/parking, route safety, sleep tonight, SENTRI/FAST relevance",
          "- Dispatcher: customer SLA, broker relationships, OTP impact, knock-on effect on next load",
          "- Receiver Operations: dock window fit, lumper, OS&D risk, trailer-pool churn",
          "Flag concrete issues — not generic warnings.",
        ]
          .filter(Boolean)
          .join("\n"),
        personas: ROUTE_PERSONAS,
        synthesisInstruction:
          "Recommend: stick with the primary, switch to a named alternative, or pause and reroute. Cite the dominant concern if you flag a switch.",
        maxTokens: 1800,
      });
    } catch (panelErr) {
      // Panel failure is logged but does not break the sim response.
      console.warn(
        "[scenario-sim] panel call failed:",
        panelErr instanceof Error ? panelErr.message : panelErr,
      );
    }

    return NextResponse.json({ ...result, panel }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error";
    // Surface error as 502 so callers know it's an upstream / generation issue,
    // not a malformed request.
    return NextResponse.json({ error: "sim_failed", message: msg }, { status: 502 });
  }
}
