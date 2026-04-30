"use client";

// /dispatch/load — load advisor.
//
// Dispatcher pastes (origin city, receiver city, appt time) + optional driver
// name → backend ranks the top 5 candidate ports by total_eta = drive_min +
// predicted_wait_at_arrival, computes detention $ exposure if total_eta > appt,
// and emits a copy-paste driver SMS template per pick.
//
// v0 uses a small geocoder lookup table for common RGV/border city names.
// Free-text city + lat/lng inputs both supported.

import { useState } from "react";
import Link from "next/link";

interface RecommendPort {
  port_id: string;
  name: string;
  region: string;
  drive_km: number;
  drive_min: number;
  predicted_wait_at_arrival_min: number | null;
  total_eta_min: number | null;
  estimated_arrival_at: string;
  detention_usd_at_risk: number | null;
  driver_sms: string;
}

interface RecommendResponse {
  generated_at: string;
  picks: RecommendPort[];
}

// Common border-region origins. Dispatcher can also paste raw lat/lng.
const ORIGIN_PRESETS: Array<{ label: string; lat: number; lng: number }> = [
  { label: "Reynosa, MX", lat: 26.0508, lng: -98.2806 },
  { label: "Matamoros, MX", lat: 25.8694, lng: -97.5028 },
  { label: "Nuevo Laredo, MX", lat: 27.4763, lng: -99.5161 },
  { label: "Monterrey, MX", lat: 25.6866, lng: -100.3161 },
  { label: "Cd. Juárez, MX", lat: 31.6904, lng: -106.4245 },
  { label: "San Luis Potosí, MX", lat: 22.1565, lng: -100.9855 },
  { label: "Saltillo, MX", lat: 25.4232, lng: -101.0053 },
  { label: "Querétaro, MX", lat: 20.5888, lng: -100.3899 },
];

export default function LoadAdvisor() {
  const [originLabel, setOriginLabel] = useState("Reynosa, MX");
  const [originLat, setOriginLat] = useState(ORIGIN_PRESETS[0].lat);
  const [originLng, setOriginLng] = useState(ORIGIN_PRESETS[0].lng);
  const [apptAt, setApptAt] = useState(""); // datetime-local
  const [cargo, setCargo] = useState("dry van");
  const [driverName, setDriverName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);

  function pickPreset(label: string) {
    const preset = ORIGIN_PRESETS.find((p) => p.label === label);
    if (preset) {
      setOriginLabel(label);
      setOriginLat(preset.lat);
      setOriginLng(preset.lng);
    }
  }

  async function submit() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/dispatch/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin_lat: originLat,
          origin_lng: originLng,
          appt_at: apptAt ? new Date(apptAt).toISOString() : undefined,
          cargo_type: cargo,
          driver_name: driverName || undefined,
        }),
      });
      const json = (await res.json()) as RecommendResponse | { error: string };
      if (!res.ok || "error" in json) {
        setError("error" in json ? json.error : `HTTP ${res.status}`);
        return;
      }
      setResult(json as RecommendResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1180px] px-5 sm:px-8 py-6">
      <div className="mb-5">
        <h1 className="text-[1.4rem] font-semibold text-white">
          Load advisor <span className="text-white/40 text-base font-normal">· asesor de carga</span>
        </h1>
        <p className="mt-1 text-[12.5px] text-white/55 max-w-2xl">
          Paste a load. We rank the top 5 ports by drive + predicted wait at arrival, flag detention $
          exposure if you give us an appointment, and emit a driver SMS template you can copy-paste.
        </p>
      </div>

      <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Input form */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="text-[10.5px] uppercase tracking-[0.2em] text-white/45 mb-4">
            Load details
          </div>

          <label className="block text-[11px] uppercase tracking-[0.15em] text-white/55 mb-1.5">
            Origin
          </label>
          <select
            value={originLabel}
            onChange={(e) => pickPreset(e.target.value)}
            className="w-full rounded-lg border border-white/[0.08] bg-[#040814] px-3 py-2 text-[13px] text-white focus:border-amber-300/40 focus:outline-none mb-2"
          >
            {ORIGIN_PRESETS.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="0.0001"
              value={originLat}
              onChange={(e) => setOriginLat(Number(e.target.value))}
              className="rounded-lg border border-white/[0.08] bg-[#040814] px-2 py-1.5 text-[12px] font-mono text-white focus:border-amber-300/40 focus:outline-none"
            />
            <input
              type="number"
              step="0.0001"
              value={originLng}
              onChange={(e) => setOriginLng(Number(e.target.value))}
              className="rounded-lg border border-white/[0.08] bg-[#040814] px-2 py-1.5 text-[12px] font-mono text-white focus:border-amber-300/40 focus:outline-none"
            />
          </div>

          <label className="block text-[11px] uppercase tracking-[0.15em] text-white/55 mt-4 mb-1.5">
            Receiver appointment <span className="text-white/35 normal-case font-normal">(optional)</span>
          </label>
          <input
            type="datetime-local"
            value={apptAt}
            onChange={(e) => setApptAt(e.target.value)}
            // colorScheme:dark forces the browser's native date picker
            // chrome (popup, today indicator, OK/Cancel buttons, the
            // calendar/clock toggle icon) to render in dark mode. Without
            // this Chrome+Safari render the icon black-on-black and
            // the calendar pop-up appears as a white block — typing
            // works but the picker is effectively invisible.
            style={{ colorScheme: "dark" }}
            className="w-full rounded-lg border border-white/[0.08] bg-[#040814] px-3 py-2 text-[13px] text-white focus:border-amber-300/40 focus:outline-none"
          />
          {apptAt && (
            <div className="mt-1.5 text-[11px] text-white/55">
              <span className="text-white/40">Set for </span>
              <span className="font-mono text-amber-200/85">
                {new Date(apptAt).toLocaleString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "America/Chicago",
                })}{" "}
                CT
              </span>
            </div>
          )}

          <label className="block text-[11px] uppercase tracking-[0.15em] text-white/55 mt-4 mb-1.5">
            Cargo type
          </label>
          <select
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            className="w-full rounded-lg border border-white/[0.08] bg-[#040814] px-3 py-2 text-[13px] text-white focus:border-amber-300/40 focus:outline-none"
          >
            <option value="dry van">Dry van</option>
            <option value="reefer">Reefer</option>
            <option value="flatbed">Flatbed</option>
            <option value="hazmat">Hazmat</option>
            <option value="produce">Produce</option>
            <option value="other">Other</option>
          </select>

          <label className="block text-[11px] uppercase tracking-[0.15em] text-white/55 mt-4 mb-1.5">
            Driver name <span className="text-white/35 normal-case font-normal">(for SMS)</span>
          </label>
          <input
            type="text"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            placeholder="e.g. Manny"
            className="w-full rounded-lg border border-white/[0.08] bg-[#040814] px-3 py-2 text-[13px] text-white placeholder-white/30 focus:border-amber-300/40 focus:outline-none"
          />

          <button
            onClick={submit}
            disabled={loading}
            className="mt-5 w-full rounded-xl bg-amber-400 py-2.5 text-[13.5px] font-semibold text-[#0a1020] hover:bg-amber-300 disabled:opacity-50 transition"
          >
            {loading ? "Computing…" : "Get recommendations →"}
          </button>

          {error && (
            <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-950/30 px-3 py-2 text-[12px] text-rose-200">
              ✗ {error}
            </div>
          )}
        </div>

        {/* Results */}
        <div>
          {!result && !loading && (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] p-10 text-center text-[12.5px] text-white/40">
              Recommendations appear here.
              <br />
              Pick origin + appointment, click <span className="text-amber-300">Get recommendations</span>.
            </div>
          )}
          {result && result.picks.length > 0 && (
            <div className="space-y-3">
              {result.picks.map((p, i) => (
                <PickCard key={p.port_id} pick={p} rank={i + 1} apptProvided={!!apptAt} apptAt={apptAt} />
              ))}
            </div>
          )}
        </div>
      </section>

      <p className="mt-8 text-[11px] text-white/35 leading-[1.5]">
        Drive time is haversine × 1.4 / 65 mph — within ±10 min for typical RGV/Laredo runs. Replace
        with HERE/Google routing once we&apos;ve validated demand. Detention math uses $85/hr industry
        baseline; configurable per fleet under <Link href="/dispatch/alerts" className="text-amber-300 hover:text-amber-200">Alerts</Link>.
      </p>
    </main>
  );
}

function PickCard({
  pick,
  rank,
  apptProvided,
  apptAt,
}: {
  pick: RecommendPort;
  rank: number;
  apptProvided: boolean;
  apptAt: string;
}) {
  const [copied, setCopied] = useState(false);
  const winner = rank === 1;
  function copy() {
    navigator.clipboard?.writeText(pick.driver_sms);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  // appt-vs-arrival math (client-side so we can show slack even when the
  // server returns detention_usd_at_risk = null because we arrive early).
  let apptSlackMin: number | null = null;
  let isLate = false;
  if (apptProvided && apptAt && pick.estimated_arrival_at) {
    const apptMs = new Date(apptAt).getTime();
    const arrivalMs = new Date(pick.estimated_arrival_at).getTime();
    apptSlackMin = Math.round((apptMs - arrivalMs) / 60_000);
    isLate = apptSlackMin < 0;
  }

  return (
    <div
      className={`rounded-2xl border p-5 ${
        winner
          ? "border-amber-300/40 bg-amber-300/[0.03]"
          : "border-white/[0.08] bg-white/[0.02]"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] tabular-nums text-white/35">#{rank}</span>
          <span className="text-[15px] font-semibold text-white">{pick.name}</span>
          <span className="text-[11px] text-white/40">{pick.region}</span>
        </div>
        {pick.detention_usd_at_risk !== null && pick.detention_usd_at_risk > 0 && (
          <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-rose-200">
            ${pick.detention_usd_at_risk.toLocaleString()} detention risk
          </span>
        )}
        {apptProvided && !isLate && apptSlackMin !== null && (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-200">
            on-time · +{apptSlackMin}m slack
          </span>
        )}
      </div>

      {apptProvided && apptSlackMin !== null && (
        <div className="mt-3 rounded-lg border border-white/[0.06] bg-[#040814] px-3 py-2 text-[11.5px]">
          <span className="text-white/45">Arrives </span>
          <span className="font-mono text-white/80">
            {new Date(pick.estimated_arrival_at).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              timeZone: "America/Chicago",
            })}{" "}
            CT
          </span>
          {isLate ? (
            <span className="ml-2 text-rose-300">· {Math.abs(apptSlackMin)} min LATE for appt</span>
          ) : (
            <span className="ml-2 text-emerald-300/85">· {apptSlackMin} min before appt</span>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-white/[0.06] bg-[#040814] p-2.5">
          <div className="text-[10px] uppercase tracking-[0.15em] text-white/40">Drive</div>
          <div className="mt-1 font-mono text-[15px] tabular-nums text-white">
            {pick.drive_min} <span className="text-[10px] text-white/45">min</span>
          </div>
          <div className="mt-0.5 text-[10px] text-white/40">{pick.drive_km} km</div>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-[#040814] p-2.5">
          <div className="text-[10px] uppercase tracking-[0.15em] text-white/40">Wait @ arrival</div>
          <div className="mt-1 font-mono text-[15px] tabular-nums text-white">
            {pick.predicted_wait_at_arrival_min ?? "—"}{" "}
            <span className="text-[10px] text-white/45">min</span>
          </div>
        </div>
        <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.04] p-2.5">
          <div className="text-[10px] uppercase tracking-[0.15em] text-amber-200/70">Total ETA</div>
          <div className="mt-1 font-mono text-[15px] tabular-nums text-amber-200">
            {pick.total_eta_min ?? "—"}{" "}
            <span className="text-[10px] text-amber-200/55">min</span>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-white/[0.06] bg-[#020410] p-3">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[10px] uppercase tracking-[0.15em] text-white/45">
            Driver SMS — copy + paste
          </span>
          <button
            onClick={copy}
            className="rounded-md border border-white/[0.1] px-2 py-0.5 text-[10.5px] text-white/60 hover:bg-white/[0.06] hover:text-white transition"
          >
            {copied ? "✓ copied" : "copy"}
          </button>
        </div>
        <code className="block whitespace-pre-wrap break-words font-mono text-[11.5px] text-white/85">
          {pick.driver_sms}
        </code>
      </div>
    </div>
  );
}
