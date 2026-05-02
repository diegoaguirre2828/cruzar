"use client";

// /dispatch — live dispatcher console.
//
// What it is: the screen a broker keeps open all shift. Watched ports
// auto-refresh every 60s. Anomaly badges fire when a port runs ≥1.5× its
// 90-day DOW × hour baseline. Click a row to expand for live + 6h forecast
// + drift status + raw CBP age.
//
// State: watched port_ids persisted in localStorage AND mirrored to ?ports=
// query param so a dispatcher can bookmark / share a specific watch list.

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { PORT_META } from "@/lib/portMeta";
import Link from "next/link";
import { DispatchHero } from "@/components/DispatchHero";
import { AlertsRail } from "@/components/AlertsRail";

const REFRESH_MS = 60_000;
const STORAGE_KEY = "cruzar.dispatch.watched.v1";
const DEFAULT_WATCHED = ["230502", "230501", "230503", "535501", "230402"]; // RGV-heavy starter
const DEMO_WATCHED = ["230502", "230501", "230503", "230402", "230403", "535501"]; // Raul's broker-office demo preset

interface DispatchPort {
  port_id: string;
  name: string;
  region: string;
  cluster: string;
  live_wait_min: number | null;
  live_recorded_at: string | null;
  live_stale_min: number | null;
  predicted_6h_min: number | null;
  delta_min: number | null;
  anomaly_high: boolean;
  anomaly_ratio: number | null;
  drift_status:
    | "decision-grade"
    | "marginal"
    | "self-baseline"
    | "marginal-self"
    | "drift-fallback"
    | "untracked";
  has_forecast: boolean;
}

interface SnapshotResponse {
  snapshot: { generated_at: string; ports: DispatchPort[] };
}

interface SubscriberPrefs {
  id: number;
  tier: 'free' | 'starter' | 'pro' | 'fleet';
  status: string;
  language: 'en' | 'es';
  briefing_enabled: boolean;
  briefing_local_hour: number;
  briefing_tz: string;
  channel_email: boolean;
  channel_sms: boolean;
  channel_whatsapp: boolean;
  recipient_emails: string[];
  recipient_phones: string[];
  last_anomaly_fired_at: string | null;
}

const fetcher = <T,>(url: string): Promise<T> => fetch(url).then((r) => r.json());

function loadWatched(): string[] {
  if (typeof window === "undefined") return DEFAULT_WATCHED;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WATCHED;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.every((s) => typeof s === "string")) return arr;
    return DEFAULT_WATCHED;
  } catch {
    return DEFAULT_WATCHED;
  }
}

function saveWatched(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* quota — fail silent */
  }
}

const STATUS_LABEL: Record<DispatchPort["drift_status"], { en: string; tone: string }> = {
  "decision-grade": { en: "decision-grade", tone: "text-emerald-300/90" },
  marginal: { en: "marginal vs CBP", tone: "text-amber-300/90" },
  "self-baseline": { en: "first-party baseline", tone: "text-sky-300/90" },
  "marginal-self": { en: "marginal (self)", tone: "text-amber-300/70" },
  "drift-fallback": { en: "matching CBP", tone: "text-slate-400" },
  untracked: { en: "untracked", tone: "text-white/30" },
};

export default function DispatchConsole() {
  const router = useRouter();
  const params = useSearchParams();
  const [watched, setWatched] = useState<string[]>(DEFAULT_WATCHED);
  const [hydrated, setHydrated] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  // Hydrate from URL → fallback to localStorage. URL wins so shared links work.
  // Demo mode (?demo=rgv) loads a preset RGV-heavy list and skips persistence.
  useEffect(() => {
    if (params.get("demo") === "rgv") {
      setWatched(DEMO_WATCHED);
      setHydrated(true);
      return;
    }
    const fromUrl = params.get("ports")?.split(",").filter(Boolean) ?? null;
    const initial = fromUrl && fromUrl.length > 0 ? fromUrl : loadWatched();
    setWatched(initial);
    setHydrated(true);
  }, [params]);

  // Persist + mirror to URL whenever watched changes after hydration.
  // Demo mode skips persistence — read-only preset for in-office demos.
  useEffect(() => {
    if (!hydrated) return;
    if (params.get("demo") === "rgv") return;
    saveWatched(watched);
    const next = new URLSearchParams(params.toString());
    if (watched.length > 0) next.set("ports", watched.join(","));
    else next.delete("ports");
    router.replace(`/dispatch?${next.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched, hydrated]);

  const portsQuery = watched.join(",");
  const { data, isLoading, mutate } = useSWR<SnapshotResponse>(
    hydrated && watched.length > 0 ? `/api/dispatch/snapshot?ports=${portsQuery}` : null,
    fetcher,
    {
      refreshInterval: REFRESH_MS,
      revalidateOnFocus: true,
    },
  );

  // Subscriber preferences + accuracy summary fuel the stress-reliever hero.
  const { data: prefsData } = useSWR<{ subscriber: SubscriberPrefs | null }>(
    hydrated ? "/api/insights/preferences" : null,
    fetcher,
  );
  const subscriber = prefsData?.subscriber ?? null;
  const { data: accData } = useSWR<{ median_pct: number | null }>(
    hydrated && watched.length > 0 ? `/api/insights/accuracy-summary?ports=${portsQuery}` : null,
    fetcher,
  );
  const accuracyPct = accData?.median_pct ?? null;

  const generated = data?.snapshot.generated_at;
  const ports = data?.snapshot.ports ?? [];
  const anomalyCount = ports.filter((p) => p.anomaly_high).length;

  function nextBriefingLabel(): string | null {
    if (!subscriber?.briefing_enabled) return null;
    try {
      const tz = subscriber.briefing_tz || "America/Chicago";
      const local = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
      const next = new Date(local);
      next.setHours(subscriber.briefing_local_hour, 0, 0, 0);
      if (next <= local) next.setDate(next.getDate() + 1);
      return next.toLocaleString("en-US", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: tz,
      });
    } catch {
      return null;
    }
  }

  // Picker — all known ports filtered by query, minus already-watched
  const pickerCandidates = useMemo(() => {
    const watchedSet = new Set(watched);
    const q = pickerQuery.trim().toLowerCase();
    return Object.entries(PORT_META)
      .filter(([id]) => !watchedSet.has(id))
      .filter(([id, meta]) => {
        if (!q) return true;
        const hay = `${id} ${meta.localName ?? ""} ${meta.city} ${meta.region}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 20);
  }, [watched, pickerQuery]);

  function addPort(id: string) {
    setWatched((prev) => (prev.includes(id) ? prev : [...prev, id].slice(0, 12)));
    setPickerQuery("");
    setPickerOpen(false);
  }
  function removePort(id: string) {
    setWatched((prev) => prev.filter((p) => p !== id));
  }

  return (
    <main className="mx-auto max-w-[1180px] px-5 sm:px-8 py-6">
      <DispatchHero
        watchedCount={watched.length}
        anomalyCount={anomalyCount}
        accuracyPct={accuracyPct}
        briefingTimeLabel={nextBriefingLabel()}
        recipientLabel={subscriber?.recipient_emails?.[0] ?? null}
        lang={subscriber?.language ?? "en"}
      />
      {/* Watched chips */}
      <section className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10.5px] uppercase tracking-[0.2em] text-white/45 mr-1">Watching</span>
          {watched.map((id) => {
            const meta = PORT_META[id];
            const label = meta?.localName ?? meta?.city ?? id;
            return (
              <button
                key={id}
                onClick={() => removePort(id)}
                className="group flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/[0.07] px-3 py-1 text-[12px] text-amber-200/90 hover:border-rose-400/50 hover:bg-rose-400/[0.08] hover:text-rose-200 transition"
                title="Click to remove"
              >
                <span>{label}</span>
                <span className="text-amber-300/40 group-hover:text-rose-300/70 text-[14px] leading-none">×</span>
              </button>
            );
          })}
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className={`rounded-full px-3 py-1 text-[12px] transition border ${
              pickerOpen
                ? "border-white/30 bg-white/[0.1] text-white"
                : "border-white/[0.12] bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            {pickerOpen ? "× close" : "+ add port"}
          </button>
          {watched.length === 0 && (
            <span className="text-[12px] text-white/45 ml-2">
              No ports watched. Add one to start.
            </span>
          )}
          {generated && (
            <span className="ml-auto text-[10.5px] text-white/35 tabular-nums">
              refreshed {new Date(generated).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Chicago" })} CT
            </span>
          )}
          <button
            onClick={() => mutate()}
            className="rounded-lg border border-white/[0.12] px-2 py-0.5 text-[11px] text-white/55 hover:bg-white/[0.06] hover:text-white transition"
            title="Force refresh"
          >
            ↻
          </button>
        </div>

        {pickerOpen && (
          <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setPickerOpen(false);
                }}
                placeholder="Search by name, city, or port ID..."
                className="flex-1 rounded-lg border border-white/[0.08] bg-[#040814] px-3 py-2 text-[13px] text-white placeholder-white/35 focus:border-amber-300/40 focus:outline-none"
                autoFocus
              />
              <button
                onClick={() => setPickerOpen(false)}
                aria-label="Close picker"
                className="flex-shrink-0 rounded-lg border border-white/[0.12] px-2.5 py-1.5 text-[12px] text-white/55 hover:bg-white/[0.06] hover:text-white transition"
              >
                ×
              </button>
            </div>
            <ul className="mt-2 max-h-60 overflow-y-auto divide-y divide-white/[0.04]">
              {pickerCandidates.map(([id, meta]) => (
                <li key={id}>
                  <button
                    onClick={() => addPort(id)}
                    className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-[12.5px] text-left hover:bg-white/[0.04] transition"
                  >
                    <span className="text-white/85">
                      {meta.localName ?? meta.city}
                      <span className="ml-2 text-white/40">{meta.region}</span>
                    </span>
                    <span className="font-mono text-[10.5px] text-white/30">{id}</span>
                  </button>
                </li>
              ))}
              {pickerCandidates.length === 0 && (
                <li className="px-2 py-3 text-[12px] text-white/40">No matches</li>
              )}
            </ul>
          </div>
        )}
      </section>

      {/* Snapshot table */}
      <section>
        {isLoading && watched.length > 0 && (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 text-center text-[12.5px] text-white/45">
            Loading snapshot…
          </div>
        )}

        {!isLoading && ports.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            <table className="w-full text-[13px]">
              <thead className="text-[10.5px] uppercase tracking-[0.18em] text-white/45">
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-3 text-left">Port</th>
                  <th className="px-4 py-3 text-right">Now</th>
                  <th className="px-4 py-3 text-right">+6h</th>
                  <th className="px-4 py-3 text-right">Δ</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {ports.map((p) => (
                  <DispatchRow
                    key={p.port_id}
                    p={p}
                    subscriberChannels={
                      subscriber
                        ? {
                            email: subscriber.channel_email,
                            sms: subscriber.channel_sms,
                            whatsapp: subscriber.channel_whatsapp,
                          }
                        : null
                    }
                    lastFired={subscriber?.last_anomaly_fired_at ?? null}
                    lang={subscriber?.language ?? "en"}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-[11px] text-white/35 leading-[1.5]">
          Auto-refreshes every 60s. Anomaly fires when current wait ≥ 1.5× the 90-day DOW × hour
          average. Drift status indicates whether our 6h forecast model currently beats CBP&apos;s own
          baseline; <span className="text-slate-300">matching CBP</span> means we serve their number rather
          than a worse model output.
        </p>
        <p className="mt-3 text-[12px] text-white/55">
          Want anomaly pushes to your phone or email?{" "}
          <Link
            href="/dispatch/account"
            className="text-amber-300 hover:text-amber-200 underline decoration-amber-300/40"
          >
            Set up alerts →
          </Link>
        </p>
      </section>
    </main>
  );
}

function DispatchRow({
  p,
  subscriberChannels,
  lastFired,
  lang,
}: {
  p: DispatchPort;
  subscriberChannels: { email: boolean; sms: boolean; whatsapp: boolean } | null;
  lastFired: string | null;
  lang: 'en' | 'es';
}) {
  const status = STATUS_LABEL[p.drift_status];
  const live =
    typeof p.live_wait_min === "number" ? `${p.live_wait_min} min` : "—";
  const pred =
    typeof p.predicted_6h_min === "number" ? `${p.predicted_6h_min} min` : "—";
  const delta =
    typeof p.delta_min === "number"
      ? p.delta_min === 0
        ? "·"
        : `${p.delta_min > 0 ? "▲" : "▼"} ${Math.abs(p.delta_min)}`
      : "—";
  const deltaTone =
    typeof p.delta_min === "number"
      ? p.delta_min > 5
        ? "text-rose-300"
        : p.delta_min < -5
          ? "text-emerald-300"
          : "text-white/55"
      : "text-white/30";

  return (
    <tr className="hover:bg-white/[0.02] transition">
      <td className="px-4 py-3.5">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="font-medium text-white">{p.name}</span>
          <span className="font-mono text-[10.5px] text-white/30">{p.port_id}</span>
          {p.anomaly_high && (
            <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-rose-300 border border-rose-400/30">
              anomaly{" "}
              {typeof p.anomaly_ratio === "number" && (
                <span className="font-mono">{p.anomaly_ratio.toFixed(1)}×</span>
              )}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-white/40">{p.region}</div>
      </td>
      <td className="px-4 py-3.5 text-right">
        <div className="font-mono text-[15px] tabular-nums text-white">{live}</div>
        {typeof p.live_stale_min === "number" && p.live_stale_min > 30 && (
          <div className="mt-0.5 text-[10px] text-amber-300/70">stale {p.live_stale_min}m</div>
        )}
      </td>
      <td className="px-4 py-3.5 text-right">
        <span className="font-mono text-[15px] tabular-nums text-white/80">{pred}</span>
      </td>
      <td className={`px-4 py-3.5 text-right font-mono text-[13px] tabular-nums ${deltaTone}`}>
        {delta}
      </td>
      <td className={`px-4 py-3.5 text-[11.5px] ${status.tone}`}>
        {status.en}
        {subscriberChannels && (
          <div className="mt-1.5">
            <AlertsRail channels={subscriberChannels} lastFiredAt={lastFired} lang={lang} />
          </div>
        )}
      </td>
    </tr>
  );
}
