// /insights/loads — operator dashboard for tracked-load ETA + detention risk.
//
// Auth-gated. Editorial style matching /insights. Two surfaces:
//   1. Add-load form (origin coords / dock address / appointment / detention rate)
//   2. Tracked loads table with risk badges (green ≥0.85 P, amber 0.5–0.85, red <0.5)

"use client";

import { useEffect, useState } from "react";

interface TrackedLoad {
  id: string;
  load_ref: string;
  origin_label: string | null;
  origin_lat: number;
  origin_lng: number;
  dest_address: string;
  appointment_at: string;
  detention_rate_per_hour: number;
  recommended_port_id: string | null;
  predicted_arrival_at: string | null;
  predicted_eta_minutes: number | null;
  predicted_wait_minutes: number | null;
  rmse_minutes: number | null;
  p_make_appointment: number | null;
  detention_risk_dollars: number | null;
  status: string;
  eta_refreshed_at: string | null;
}

function fmtMinutes(min: number | null): string {
  if (min == null) return "—";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtDateLocal(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function riskColor(p: number | null): string {
  if (p == null) return "text-white/40";
  if (p >= 0.85) return "text-emerald-400";
  if (p >= 0.5) return "text-amber-400";
  return "text-rose-400";
}

function riskLabel(p: number | null): string {
  if (p == null) return "—";
  if (p >= 0.85) return "On time";
  if (p >= 0.5) return "At risk";
  return "Likely late";
}

export default function LoadsPage() {
  const [loads, setLoads] = useState<TrackedLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean>(true);

  // Form fields
  const [loadRef, setLoadRef] = useState("");
  const [originLat, setOriginLat] = useState("");
  const [originLng, setOriginLng] = useState("");
  const [originLabel, setOriginLabel] = useState("");
  const [destAddress, setDestAddress] = useState("");
  const [appointmentAt, setAppointmentAt] = useState("");
  const [detentionRate, setDetentionRate] = useState("75");

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/insights/loads", { cache: "no-store" });
      if (res.status === 401) { setSignedIn(false); setLoads([]); return; }
      if (!res.ok) {
        setError(`could not load: HTTP ${res.status}`);
        return;
      }
      const json = await res.json();
      setLoads(json.loads ?? []);
      setSignedIn(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/insights/loads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          load_ref: loadRef,
          origin_lat: parseFloat(originLat),
          origin_lng: parseFloat(originLng),
          origin_label: originLabel || undefined,
          dest_address: destAddress,
          appointment_at: new Date(appointmentAt).toISOString(),
          detention_rate_per_hour: parseFloat(detentionRate || "75"),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `submit failed: HTTP ${res.status}`);
        return;
      }
      // reset
      setLoadRef(""); setOriginLat(""); setOriginLng("");
      setOriginLabel(""); setDestAddress(""); setAppointmentAt("");
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshEta(id: string) {
    const res = await fetch(`/api/insights/loads/${id}/eta`, { method: "POST" });
    if (res.ok) await refresh();
  }

  async function deleteLoad(id: string) {
    if (!confirm("Delete this load?")) return;
    const res = await fetch(`/api/insights/loads/${id}`, { method: "DELETE" });
    if (res.ok) await refresh();
  }

  if (!signedIn) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white px-6 py-16">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-semibold mb-4">Cruzar Insights — Loads</h1>
          <p className="text-white/70 mb-6">
            Sign in to track loads, get bridge recommendations, and see detention-risk dollars.
          </p>
          <a href="/welcome?redirect=/insights/loads"
             className="inline-block bg-amber-500 text-[#0f172a] px-5 py-2.5 rounded-lg font-medium hover:bg-amber-400">
            Sign in
          </a>
          <p className="mt-6 text-sm text-white/50">
            <a href="/insights" className="underline hover:text-amber-400">← Back to Insights</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-400/80 mb-2">§ Tracked loads</p>
          <h1 className="text-3xl md:text-4xl font-semibold mb-3">
            ETA-to-dock <span className="text-white/40">·</span> detention risk
          </h1>
          <p className="text-white/60 text-base md:text-lg max-w-3xl">
            Tag a load with origin, dock address, and appointment time. We'll pick the bridge,
            forecast wait, and tell you the probability of making the appointment + dollar exposure
            if you don't.
          </p>
        </header>

        {/* Add-load form */}
        <section className="mb-12 border border-white/10 rounded-2xl p-6 bg-white/[0.02]">
          <h2 className="text-lg font-medium mb-4">Add a load</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wider text-white/50">Load ref</span>
              <input value={loadRef} onChange={(e) => setLoadRef(e.target.value)} required
                placeholder="ABC-12345" className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm" />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wider text-white/50">Appointment (local)</span>
              <input type="datetime-local" value={appointmentAt}
                onChange={(e) => setAppointmentAt(e.target.value)} required
                className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm" />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wider text-white/50">Origin lat</span>
              <input value={originLat} onChange={(e) => setOriginLat(e.target.value)} required
                placeholder="26.0762" inputMode="decimal"
                className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm font-mono" />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wider text-white/50">Origin lng</span>
              <input value={originLng} onChange={(e) => setOriginLng(e.target.value)} required
                placeholder="-98.2866" inputMode="decimal"
                className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm font-mono" />
            </label>

            <label className="flex flex-col gap-1.5 md:col-span-2">
              <span className="text-xs uppercase tracking-wider text-white/50">Origin label (optional)</span>
              <input value={originLabel} onChange={(e) => setOriginLabel(e.target.value)}
                placeholder="Reynosa terminal · Driver Mike"
                className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm" />
            </label>

            <label className="flex flex-col gap-1.5 md:col-span-2">
              <span className="text-xs uppercase tracking-wider text-white/50">Destination dock address</span>
              <input value={destAddress} onChange={(e) => setDestAddress(e.target.value)} required
                placeholder="3500 W Loop 281, Longview, TX 75604"
                className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm" />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wider text-white/50">Detention rate ($/hr)</span>
              <input value={detentionRate} onChange={(e) => setDetentionRate(e.target.value)}
                inputMode="decimal" placeholder="75"
                className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm font-mono" />
            </label>

            <div className="flex items-end">
              <button type="submit" disabled={submitting}
                className="w-full bg-amber-500 text-[#0f172a] font-medium px-4 py-2 rounded hover:bg-amber-400 disabled:opacity-50">
                {submitting ? "Computing ETA…" : "Track this load"}
              </button>
            </div>

            {error && (
              <div className="md:col-span-2 text-rose-400 text-sm">{error}</div>
            )}
          </form>
        </section>

        {/* Loads table */}
        <section>
          <h2 className="text-lg font-medium mb-4">
            Tracking <span className="text-white/40">({loads.length})</span>
          </h2>
          {loading ? (
            <p className="text-white/40 text-sm">Loading…</p>
          ) : loads.length === 0 ? (
            <p className="text-white/50 text-sm">
              No loads yet. Add one above — we'll pick a bridge and surface detention risk in seconds.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10 text-white/50 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left py-2 pr-3">Ref</th>
                    <th className="text-left py-2 pr-3">Appt</th>
                    <th className="text-left py-2 pr-3">Bridge</th>
                    <th className="text-right py-2 pr-3">Wait</th>
                    <th className="text-right py-2 pr-3">ETA</th>
                    <th className="text-right py-2 pr-3">P(on time)</th>
                    <th className="text-right py-2 pr-3">Detention $</th>
                    <th className="text-right py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loads.map((l) => (
                    <tr key={l.id}>
                      <td className="py-3 pr-3 font-mono text-xs">{l.load_ref}</td>
                      <td className="py-3 pr-3">{fmtDateLocal(l.appointment_at)}</td>
                      <td className="py-3 pr-3 font-mono text-xs">{l.recommended_port_id ?? "—"}</td>
                      <td className="py-3 pr-3 text-right font-mono">{fmtMinutes(l.predicted_wait_minutes)}</td>
                      <td className="py-3 pr-3 text-right font-mono">{fmtMinutes(l.predicted_eta_minutes)}</td>
                      <td className={`py-3 pr-3 text-right font-mono ${riskColor(l.p_make_appointment)}`}>
                        {l.p_make_appointment != null ? `${(l.p_make_appointment * 100).toFixed(0)}%` : "—"}
                        <span className="block text-[10px] uppercase tracking-wider text-white/40 font-sans">
                          {riskLabel(l.p_make_appointment)}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-right font-mono text-rose-300">
                        {l.detention_risk_dollars != null && l.detention_risk_dollars > 0
                          ? `$${l.detention_risk_dollars.toFixed(0)}`
                          : "—"}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <button onClick={() => refreshEta(l.id)}
                          className="text-xs text-amber-400 hover:text-amber-300 mr-3">
                          Refresh
                        </button>
                        <button onClick={() => deleteLoad(l.id)}
                          className="text-xs text-white/40 hover:text-rose-400">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-16 text-xs text-white/40">
          <p>
            Wait predictions: v0.5 forecast, RMSE-based confidence band. Drive times: HERE Maps
            truck routing. P(on-time) computed via normal CDF on slack vs. RMSE.{" "}
            <a href="/insights" className="underline hover:text-amber-400">Methodology →</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
