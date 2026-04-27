// Load ETA + detention-risk computation for the Cruzar Insights B2B feature.
//
// Given an origin (truck position) + destination dock + appointment time,
// pick the bridge that minimizes expected arrival time, surface the predicted
// ETA, P(make_appointment), and dollar exposure to detention.
//
// Wait time comes from the v0.5 forecast (lib/forecastClient.ts). Drive
// times come from HERE Routing v8. We do NOT geocode the destination here —
// callers pass dest_lat/lng. (Geocoding lives in lib/geocode.ts; address →
// coords happens at /api/insights/loads POST time.)

import { PORT_META } from "./portMeta";
import { forecast, isForecastError } from "./forecastClient";

const HERE_KEY = process.env.HERE_API_KEY;

interface BridgeApproach {
  approach: { lat: number; lng: number };  // queue start (Mexico side)
  border:   { lat: number; lng: number };  // booth (US side)
}

// Reuse the calibration from lib/traffic.ts for queue points; for ports not
// in that table we use the PORT_META coord as both approach and border (the
// drive-time error from a missing 1.5km approach offset is <2 min, acceptable).
const APPROACHES: Record<string, BridgeApproach> = {
  '230501': { approach: { lat: 26.0928, lng: -98.2728 }, border: { lat: 26.1080, lng: -98.2708 } },
  '230502': { approach: { lat: 26.1620, lng: -98.1860 }, border: { lat: 26.1764, lng: -98.1836 } },
  '230503': { approach: { lat: 26.0290, lng: -98.3660 }, border: { lat: 26.0432, lng: -98.3647 } },
  '230901': { approach: { lat: 26.0760, lng: -97.9760 }, border: { lat: 26.0905, lng: -97.9736 } },
  '230902': { approach: { lat: 26.1500, lng: -98.0510 }, border: { lat: 26.1649, lng: -98.0492 } },
  '535501': { approach: { lat: 25.8870, lng: -97.4945 }, border: { lat: 25.9007, lng: -97.4935 } },
  '535502': { approach: { lat: 25.8590, lng: -97.4880 }, border: { lat: 25.8726, lng: -97.4866 } },
  '535503': { approach: { lat: 26.0285, lng: -97.7385 }, border: { lat: 26.0416, lng: -97.7367 } },
  '535504': { approach: { lat: 25.8910, lng: -97.5050 }, border: { lat: 25.9044, lng: -97.5040 } },
};

function getApproach(portId: string): BridgeApproach {
  const cal = APPROACHES[portId];
  if (cal) return cal;
  const meta = PORT_META[portId];
  if (!meta) return { approach: { lat: 0, lng: 0 }, border: { lat: 0, lng: 0 } };
  return {
    approach: { lat: meta.lat, lng: meta.lng },
    border:   { lat: meta.lat, lng: meta.lng },
  };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface HereSummary {
  routes?: Array<{
    sections?: Array<{
      summary?: { duration?: number; baseDuration?: number; length?: number };
    }>;
  }>;
}

async function hereDriveMinutes(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number
): Promise<number | null> {
  if (!HERE_KEY) return null;
  const url =
    `https://router.hereapi.com/v8/routes` +
    `?transportMode=truck&origin=${fromLat},${fromLng}&destination=${toLat},${toLng}` +
    `&return=summary&departureTime=any&apiKey=${HERE_KEY}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data: HereSummary = await res.json();
    const seconds = data.routes?.[0]?.sections?.[0]?.summary?.duration;
    if (typeof seconds !== "number") return null;
    return Math.round(seconds / 60);
  } catch {
    return null;
  }
}

// Crow-flies fallback when HERE is unavailable / fails. 80 km/h = 48 mph
// avg truck w/ stops. Adds 15% for non-direct roads.
function fallbackDriveMinutes(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const km = haversineKm(fromLat, fromLng, toLat, toLng) * 1.15;
  return Math.round((km / 80) * 60);
}

async function driveMinutes(fromLat: number, fromLng: number, toLat: number, toLng: number): Promise<number> {
  const here = await hereDriveMinutes(fromLat, fromLng, toLat, toLng);
  if (here != null) return here;
  return fallbackDriveMinutes(fromLat, fromLng, toLat, toLng);
}

// Standard normal CDF approximation (Abramowitz & Stegun 26.2.17).
function normCdf(x: number): number {
  const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741;
  const a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * ax);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1.0 + sign * y);
}

export interface LoadEtaInput {
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  appointment_at: string | Date;        // ISO timestamp
  detention_rate_per_hour?: number;     // default $75
  detention_grace_hours?: number;       // default 2.0
  preferred_port_id?: string | null;    // null = auto-pick best
  candidate_pool?: string[];            // override default RGV+Brownsville set
}

export interface BridgeOption {
  port_id: string;
  port_name: string;
  drive_to_bridge_min: number;
  predicted_wait_min: number;
  drive_to_dock_min: number;
  total_eta_min: number;
  predicted_arrival_at: string;          // ISO
  rmse_min: number;
  p_make_appointment: number;            // 0–1
  detention_minutes: number;             // expected, conditional on arrival
  detention_dollars: number;
  forecast_basis: string;                // "v0.5_RF" | "cbp_climatology_baseline" | …
  degraded: boolean;
  notes?: string;
}

export interface LoadEtaResult {
  recommended: BridgeOption;
  alternatives: BridgeOption[];          // ranked, recommended is duplicated as [0]
  computed_at: string;
  inputs_echo: Required<Omit<LoadEtaInput, "preferred_port_id" | "candidate_pool">> & {
    preferred_port_id: string | null;
  };
}

const DEFAULT_POOL = [
  "230401", "230402", "230403",                          // Laredo I, WTB, Colombia
  "230501", "230502", "230503",                          // Hidalgo, Pharr, Anzalduas
  "230701", "230901", "230902", "231001",                // Rio Grande City, Progreso, Donna, Roma
  "535501", "535502", "535503", "535504",                // Brownsville (B&M, Vets, Los Tomates, Gateway)
  "230301", "230302",                                    // Eagle Pass I, II
];

async function evaluateBridge(
  portId: string,
  input: LoadEtaInput,
): Promise<BridgeOption | null> {
  const meta = PORT_META[portId];
  if (!meta) return null;
  const approach = getApproach(portId);

  // Drive to the bridge
  const driveToBridge = await driveMinutes(
    input.origin_lat, input.origin_lng,
    approach.approach.lat, approach.approach.lng,
  );

  // Pick forecast horizon — match the predicted-arrival window
  const horizonMin = driveToBridge < 90 ? 360 : 1440;

  const fc = await forecast(portId, horizonMin);
  if (isForecastError(fc)) {
    return null;  // skip this bridge
  }
  const waitMin = Math.max(0, Math.round(fc.prediction_min));
  const rmse = fc.rmse_min ?? 20;

  // Drive from US-side booth to dock
  const driveToDock = await driveMinutes(
    approach.border.lat, approach.border.lng,
    input.dest_lat, input.dest_lng,
  );

  const totalEta = driveToBridge + waitMin + driveToDock;
  const arrival = new Date(Date.now() + totalEta * 60_000);
  const apptMs = new Date(input.appointment_at).getTime();
  const slackMin = (apptMs - arrival.getTime()) / 60_000;

  // P(make appointment) using the model's RMSE as σ on the wait component
  const p = normCdf(slackMin / rmse);

  const grace = input.detention_grace_hours ?? 2;
  const rate = input.detention_rate_per_hour ?? 75;
  const detentionMin = Math.max(0, -slackMin - grace * 60);
  const detentionDollars = (detentionMin / 60) * rate;

  return {
    port_id: portId,
    port_name: meta.localName || meta.city,
    drive_to_bridge_min: driveToBridge,
    predicted_wait_min: waitMin,
    drive_to_dock_min: driveToDock,
    total_eta_min: totalEta,
    predicted_arrival_at: arrival.toISOString(),
    rmse_min: rmse,
    p_make_appointment: Math.max(0, Math.min(1, p)),
    detention_minutes: Math.round(detentionMin),
    detention_dollars: Math.round(detentionDollars * 100) / 100,
    forecast_basis: fc.fallback_basis ?? fc.model,
    degraded: !!fc.degraded,
  };
}

export async function computeLoadEta(input: LoadEtaInput): Promise<LoadEtaResult> {
  const pool = input.preferred_port_id ? [input.preferred_port_id] : (input.candidate_pool ?? DEFAULT_POOL);
  const evaluated = await Promise.all(pool.map((id) => evaluateBridge(id, input)));
  const valid = evaluated.filter((b): b is BridgeOption => b !== null);
  if (valid.length === 0) {
    throw new Error("no bridges could be evaluated — forecast API or HERE may be unavailable");
  }
  // Recommended = highest P(make appt), tiebreak on lowest detention $
  const ranked = valid.sort((a, b) => {
    if (b.p_make_appointment !== a.p_make_appointment) {
      return b.p_make_appointment - a.p_make_appointment;
    }
    return a.detention_dollars - b.detention_dollars;
  });
  return {
    recommended: ranked[0],
    alternatives: ranked,
    computed_at: new Date().toISOString(),
    inputs_echo: {
      origin_lat: input.origin_lat,
      origin_lng: input.origin_lng,
      dest_lat: input.dest_lat,
      dest_lng: input.dest_lng,
      appointment_at: typeof input.appointment_at === "string" ? input.appointment_at : input.appointment_at.toISOString(),
      detention_rate_per_hour: input.detention_rate_per_hour ?? 75,
      detention_grace_hours: input.detention_grace_hours ?? 2,
      preferred_port_id: input.preferred_port_id ?? null,
    },
  };
}
