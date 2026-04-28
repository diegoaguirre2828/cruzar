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
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error";
    // Surface error as 502 so callers know it's an upstream / generation issue,
    // not a malformed request.
    return NextResponse.json({ error: "sim_failed", message: msg }, { status: 502 });
  }
}
