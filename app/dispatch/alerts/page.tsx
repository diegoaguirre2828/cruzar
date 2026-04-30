"use client";

// /dispatch/alerts — alerts manager (v0 — UI + localStorage persistence).
//
// Wires to email/SMS/WhatsApp once channel creds land in Vercel env. Until
// then, "Save" persists locally + the channel toggles show their gated state
// (e.g., "WhatsApp pending Meta verification"). Test-fire button hits a local
// log endpoint so we can prove the round-trip.
//
// Per-fleet schema (v70 migration is queued in the audit synthesis but not
// applied yet). Today this state lives in localStorage. Migration day, we
// upload localStorage → insights_subscribers table once.

import { useEffect, useState } from "react";
import Link from "next/link";
import { PORT_META } from "@/lib/portMeta";

const STORAGE_KEY = "cruzar.dispatch.alerts.v1";
const WATCHED_KEY = "cruzar.dispatch.watched.v1";

interface AlertConfig {
  // Per-port settings
  port_thresholds: Record<string, number>; // port_id → ratio (default 1.5)

  // Channels
  email_to: string;
  email_enabled: boolean;
  sms_to_e164: string;
  sms_enabled: boolean;
  whatsapp_to_e164: string;
  whatsapp_enabled: boolean;

  // Quiet hours (CT)
  quiet_start_hour: number; // 0–23 in CT
  quiet_end_hour: number;
  quiet_enabled: boolean;

  // Detention rate for the load advisor
  detention_usd_per_hr: number;
}

const DEFAULT_CONFIG: AlertConfig = {
  port_thresholds: {},
  email_to: "",
  email_enabled: false,
  sms_to_e164: "",
  sms_enabled: false,
  whatsapp_to_e164: "",
  whatsapp_enabled: false,
  quiet_start_hour: 22,
  quiet_end_hour: 5,
  quiet_enabled: true,
  detention_usd_per_hr: 85,
};

function loadConfig(): AlertConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) } as AlertConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function loadWatched(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCHED_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default function AlertsManager() {
  const [config, setConfig] = useState<AlertConfig>(DEFAULT_CONFIG);
  const [watched, setWatched] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setConfig(loadConfig());
    setWatched(loadWatched());
    setHydrated(true);
  }, []);

  function update<K extends keyof AlertConfig>(k: K, v: AlertConfig[K]) {
    setConfig((c) => ({ ...c, [k]: v }));
  }
  function setThreshold(portId: string, ratio: number) {
    setConfig((c) => ({
      ...c,
      port_thresholds: { ...c.port_thresholds, [portId]: ratio },
    }));
  }

  function save() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* quota — silent */
    }
  }

  // Test-fire state (Phase 4) — proves the email plumbing + 3-persona narrative
  const [testPort, setTestPort] = useState<string>(watched[0] ?? "230502");
  const [testForce, setTestForce] = useState(true);
  const [testFiring, setTestFiring] = useState(false);
  const [testResult, setTestResult] = useState<{ sent: boolean; error?: string | null; baseline?: { live_wait_min: number | null; baseline_avg_min: number | null; ratio: number | null; anomaly: boolean }; rendered?: { subject: string } } | null>(null);

  async function fireTest() {
    if (!config.email_to) {
      setTestResult({ sent: false, error: "Set an email address in the Channels section above first." });
      return;
    }
    setTestFiring(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/dispatch/alerts/fire-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: config.email_to,
          port_id: testPort || (watched[0] ?? "230502"),
          threshold_ratio: config.port_thresholds[testPort] ?? 1.5,
          force: testForce,
        }),
      });
      const json = await res.json();
      setTestResult(json);
    } catch (e) {
      setTestResult({ sent: false, error: e instanceof Error ? e.message : "request failed" });
    } finally {
      setTestFiring(false);
    }
  }

  if (!hydrated) {
    return <main className="mx-auto max-w-[860px] px-5 py-6 text-white/45">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-[860px] px-5 sm:px-8 py-6">
      <div className="mb-5">
        <h1 className="text-[1.4rem] font-semibold text-white">
          Alerts <span className="text-white/40 text-base font-normal">· alertas</span>
        </h1>
        <p className="mt-1 text-[12.5px] text-white/55">
          When a watched port runs above its threshold, push the alert to your channels of choice.
          Quiet hours pause notifications overnight.
        </p>
      </div>

      {/* Per-port thresholds */}
      <Section title="Per-port threshold" subtitle="Anomaly fires when current wait ≥ ratio × 90-day DOW × hour avg. Default 1.5×.">
        {watched.length === 0 ? (
          <div className="text-[12.5px] text-white/40">
            No watched ports yet. <Link href="/dispatch" className="text-amber-300 hover:text-amber-200">Add some on the console →</Link>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {watched.map((id) => {
              const meta = PORT_META[id];
              const cur = config.port_thresholds[id] ?? 1.5;
              return (
                <li key={id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[13.5px] text-white">{meta?.localName ?? meta?.city ?? id}</div>
                    <div className="text-[10.5px] text-white/40">{meta?.region ?? ""}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1.0}
                      max={5}
                      step={0.1}
                      value={cur}
                      onChange={(e) => setThreshold(id, Number(e.target.value))}
                      className="w-20 rounded-lg border border-white/[0.08] bg-[#040814] px-2 py-1 text-right font-mono text-[12.5px] text-white focus:border-amber-300/40 focus:outline-none"
                    />
                    <span className="text-[11px] text-white/45">×</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Channels */}
      <Section title="Channels" subtitle="Where the alerts land. WhatsApp unlocks once Meta verification clears.">
        <ChannelRow
          name="Email"
          subtitle="Resend — domain verified."
          ready
          enabled={config.email_enabled}
          onToggle={(v) => update("email_enabled", v)}
          value={config.email_to}
          onChange={(v) => update("email_to", v)}
          placeholder="dispatch@yourfleet.com"
          inputType="email"
        />
        <ChannelRow
          name="SMS"
          subtitle="Twilio — sandbox or paid number."
          ready={false}
          gateNote="Twilio number provisioning queued"
          enabled={config.sms_enabled}
          onToggle={(v) => update("sms_enabled", v)}
          value={config.sms_to_e164}
          onChange={(v) => update("sms_to_e164", v)}
          placeholder="+19561234567"
          inputType="tel"
        />
        <ChannelRow
          name="WhatsApp"
          subtitle="Meta Cloud API + lib/whatsappIntent.ts (inbound v0 shipped 04-29)."
          ready={false}
          gateNote="Meta business verification under appeal"
          enabled={config.whatsapp_enabled}
          onToggle={(v) => update("whatsapp_enabled", v)}
          value={config.whatsapp_to_e164}
          onChange={(v) => update("whatsapp_to_e164", v)}
          placeholder="+19561234567"
          inputType="tel"
        />
      </Section>

      {/* Quiet hours */}
      <Section title="Quiet hours" subtitle="Skip alerts overnight. Times in Central (CT).">
        <label className="flex items-center gap-2 text-[12.5px] text-white/75 mb-3">
          <input
            type="checkbox"
            checked={config.quiet_enabled}
            onChange={(e) => update("quiet_enabled", e.target.checked)}
            className="accent-amber-400"
          />
          Enabled
        </label>
        <div className="flex items-center gap-3 text-[12.5px] text-white/70">
          <span>From</span>
          <input
            type="number"
            min={0}
            max={23}
            value={config.quiet_start_hour}
            onChange={(e) => update("quiet_start_hour", Number(e.target.value))}
            className="w-16 rounded-lg border border-white/[0.08] bg-[#040814] px-2 py-1 text-right font-mono text-white focus:border-amber-300/40 focus:outline-none"
          />
          <span>to</span>
          <input
            type="number"
            min={0}
            max={23}
            value={config.quiet_end_hour}
            onChange={(e) => update("quiet_end_hour", Number(e.target.value))}
            className="w-16 rounded-lg border border-white/[0.08] bg-[#040814] px-2 py-1 text-right font-mono text-white focus:border-amber-300/40 focus:outline-none"
          />
          <span className="text-white/40">CT</span>
        </div>
      </Section>

      {/* Detention rate */}
      <Section title="Detention rate" subtitle="Used by /dispatch/load to compute $ exposure when a load can't make appointment.">
        <div className="flex items-center gap-2">
          <span className="text-white/55">$</span>
          <input
            type="number"
            min={0}
            value={config.detention_usd_per_hr}
            onChange={(e) => update("detention_usd_per_hr", Number(e.target.value))}
            className="w-28 rounded-lg border border-white/[0.08] bg-[#040814] px-2 py-1.5 font-mono text-[13px] text-white focus:border-amber-300/40 focus:outline-none"
          />
          <span className="text-[12px] text-white/55">/ hour</span>
          <span className="ml-2 text-[10.5px] text-white/35">industry default $85/hr</span>
        </div>
      </Section>

      {/* Test fire (Phase 4) */}
      <Section title="Send a test alert" subtitle="Fire one alert through the email channel to confirm delivery + see how a real anomaly notification will read.">
        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <div>
            <label className="block text-[10.5px] uppercase tracking-[0.15em] text-white/55 mb-1.5">Port</label>
            {watched.length === 0 ? (
              <input
                type="text"
                value={testPort}
                onChange={(e) => setTestPort(e.target.value)}
                placeholder="230502"
                className="w-full rounded-lg border border-white/[0.08] bg-[#040814] px-2 py-1.5 font-mono text-[12.5px] text-white focus:border-amber-300/40 focus:outline-none"
              />
            ) : (
              <select
                value={testPort}
                onChange={(e) => setTestPort(e.target.value)}
                style={{ colorScheme: "dark" }}
                className="w-full rounded-lg border border-white/[0.08] bg-[#040814] px-2 py-1.5 text-[12.5px] text-white focus:border-amber-300/40 focus:outline-none"
              >
                {watched.map((id) => {
                  const meta = PORT_META[id];
                  return (
                    <option key={id} value={id}>
                      {meta?.localName ?? meta?.city ?? id}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
          <div>
            <label className="block text-[10.5px] uppercase tracking-[0.15em] text-white/55 mb-1.5">Mode</label>
            <label className="flex items-center gap-2 text-[12.5px] text-white/75">
              <input
                type="checkbox"
                checked={testForce}
                onChange={(e) => setTestForce(e.target.checked)}
                className="accent-amber-400"
              />
              Force send (preview format even when port isn&apos;t actually anomalous)
            </label>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={fireTest}
            disabled={testFiring || !config.email_to}
            className="rounded-lg bg-amber-400 px-3 py-1.5 text-[12px] font-semibold text-[#0a1020] hover:bg-amber-300 disabled:opacity-40"
          >
            {testFiring ? "Sending…" : "Send test alert →"}
          </button>
          {!config.email_to && (
            <span className="text-[11px] text-amber-300/80">Set your email above first.</span>
          )}
        </div>
        {testResult && (
          <div
            className={`mt-3 rounded-lg border px-3 py-2 text-[12px] ${
              testResult.sent
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                : "border-rose-400/30 bg-rose-950/30 text-rose-200"
            }`}
          >
            {testResult.sent ? (
              <>
                ✓ Sent to <span className="font-mono">{config.email_to}</span> · subject: <span className="text-white/85">{testResult.rendered?.subject}</span>
              </>
            ) : (
              <>
                ✗ {testResult.error ?? "did not send"}
                {testResult.baseline && (
                  <div className="mt-1 text-[11px] text-white/60">
                    live={testResult.baseline.live_wait_min ?? "—"}min · baseline={testResult.baseline.baseline_avg_min ?? "—"}min · ratio={testResult.baseline.ratio ?? "—"}× · anomaly={String(testResult.baseline.anomaly)}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Section>

      <div className="sticky bottom-4 mt-8 flex justify-end">
        <button
          onClick={save}
          className="rounded-xl bg-amber-400 px-5 py-2.5 text-[13.5px] font-semibold text-[#0a1020] hover:bg-amber-300 transition shadow-lg"
        >
          {saved ? "✓ Saved" : "Save settings"}
        </button>
      </div>

      <p className="mt-6 text-[11px] text-white/35 leading-[1.5]">
        v0 stores config in this browser&apos;s localStorage. Once the v70 subscribers schema lands +
        Meta clears, we migrate your settings to the server-side <code className="font-mono text-white/55">insights_subscribers</code> table
        — no re-entry required.
      </p>
    </main>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="mb-3">
        <div className="text-[10.5px] uppercase tracking-[0.2em] text-white/55">{title}</div>
        {subtitle && <div className="mt-1 text-[12px] text-white/45 leading-[1.45]">{subtitle}</div>}
      </div>
      {children}
    </section>
  );
}

function ChannelRow({
  name,
  subtitle,
  ready,
  gateNote,
  enabled,
  onToggle,
  value,
  onChange,
  placeholder,
  inputType,
}: {
  name: string;
  subtitle: string;
  ready: boolean;
  gateNote?: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  inputType: string;
}) {
  return (
    <div className="border-t border-white/[0.04] first:border-t-0 py-3 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <span className="text-[13.5px] font-medium text-white">{name}</span>
          <span className="ml-2 text-[11px] text-white/40">{subtitle}</span>
        </div>
        <label className="flex items-center gap-2 text-[12px] text-white/70">
          <input
            type="checkbox"
            checked={enabled && ready}
            disabled={!ready}
            onChange={(e) => onToggle(e.target.checked)}
            className="accent-amber-400 disabled:opacity-30"
          />
          {ready ? "On" : <span className="text-white/35">{gateNote ?? "Pending"}</span>}
        </label>
      </div>
      <input
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={!ready}
        className="mt-2 w-full rounded-lg border border-white/[0.08] bg-[#040814] px-3 py-2 text-[12.5px] text-white placeholder-white/30 focus:border-amber-300/40 focus:outline-none disabled:opacity-40"
      />
    </div>
  );
}
