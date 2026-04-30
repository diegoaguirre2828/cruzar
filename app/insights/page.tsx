import { MomentsNav } from "@/components/MomentsNav";
import { InsightsExpertPanel } from "@/components/InsightsExpertPanel";
import { getPortMeta } from "@/lib/portMeta";
import manifest from "@/data/insights-manifest.json";

// Cruzar Insights B2B landing — editorial / data-journalism rebuild.
//
// Audience: SMB Mexico import/export ops, customs brokers, dispatchers, fleet
// ops at carriers. Skeptical buyers. They want proof, decision-making clarity,
// honest disclosure of where the model degrades.
//
// Design intent: feel like a Bloomberg / FT data dossier, not a SaaS landing.
// Numerics in mono, bilingual headlines, amber accent, no stock illustrations,
// inline bar-chart bars sized by the actual % improvement.
//
// Source data: live v0.5.2 manifest snapshot at data/insights-manifest.json
// (52 ports across TX / NM / AZ / CA). Refresh via the weekly retrain workflow.
// Status derives from lift_vs_cbp_climatology_pct against the same baselines
// every broker already has access to.

export const runtime = "nodejs";
export const revalidate = 3600;

export const metadata = {
  title: "Cruzar Insights — ML wait-time forecasts that beat the CBP baseline",
  description:
    "Per-port machine-learning forecasts for every US-Mexico border crossing CBP publishes wait times for — TX, NM, AZ, CA. Delivered to your dispatch desk via WhatsApp, email, and driver SMS. Backtested against CBP's own free climatology.",
  alternates: { canonical: "https://www.cruzar.app/insights" },
};

// Backtest results — derived live from the v0.5 manifest, 6-hour horizon.
// Two baselines:
//   CBP climatology — strongest baseline a TX broker already uses. Only
//     published by the CBP API for TX ports (verified empirically — CA/AZ/NM
//     return literal "{}" sentinel, not a Cruzar gap).
//   Self climatology — Cruzar's own DOW × hour mean from the training window.
//     Available for every trained port. Honest first-party baseline.
//
// Status thresholds (CBP wins when both available, since brokers can verify it):
//   lift_vs_cbp >= 5     → decision-grade (we beat CBP meaningfully)
//   lift_vs_cbp 0-5%     → marginal vs CBP
//   lift_vs_cbp < 0      → drift-fallback (inference auto-serves CBP)
//   no CBP, lift_vs_self ≥ 5  → self-baseline (we beat our own historical avg)
//   no CBP, lift_vs_self 0-5% → marginal-self
//   no CBP, lift_vs_self < 0  → drift-fallback (inference auto-serves self-climatology)
type PortStatus =
  | "decision-grade"
  | "marginal"
  | "self-baseline"
  | "marginal-self"
  | "drift-fallback";
type ClusterKey = "rgv" | "laredo" | "coahuila-tx" | "el-paso" | "sonora-az" | "baja" | "other";

type PortRow = {
  portId: string;
  name: string;
  cluster: ClusterKey;
  rmse: number | null;
  vsCbp: number | null;
  vsPersistence: number | null;
  vsSelfClimatology: number | null;
  status: PortStatus;
  note?: string;
  noteEs?: string;
};

interface ManifestModel {
  port_id: string;
  port_name: string;
  horizon_min: number;
  rmse_min: number | null;
  lift_vs_persistence_pct: number | null;
  lift_vs_cbp_climatology_pct: number | null;
  // v0.5.3: first-party DOW × hour climatology baseline. Available for every
  // trained port (including CA/AZ/NM where CBP doesn't publish).
  lift_vs_self_climatology_pct?: number | null;
  n_train: number;
  n_test: number;
}

interface Manifest {
  model_version: string;
  saved_at: string;
  ports: string[];
  models: ManifestModel[];
}

// Pull the 6h (360) horizon row for each port. 24h is in the manifest too;
// we keep this page focused on the planning horizon dispatchers actually use.
function buildPortRows(m: Manifest): PortRow[] {
  const sixH = m.models.filter((row) => row.horizon_min === 360);
  return sixH.map((row): PortRow => {
    const meta = getPortMeta(row.port_id);
    const liftCbp = row.lift_vs_cbp_climatology_pct;
    const liftPers = row.lift_vs_persistence_pct;
    const liftSelf = row.lift_vs_self_climatology_pct ?? null;

    let status: PortStatus;
    let note: string | undefined;
    let noteEs: string | undefined;

    // CBP /api/historicalwaittimes/ returns null climatology for CA/AZ/NM
    // ports (structurally — verified across 30k API rows). For those ports
    // we use Cruzar's own DOW × hour climatology computed from the training
    // window (lift_vs_self_climatology). Same shape, different upstream.
    const cbpAvailable = liftCbp !== null && liftCbp !== 0;

    if (cbpAvailable) {
      if (liftCbp! >= 5) {
        status = "decision-grade";
      } else if (liftCbp! > 0) {
        status = "marginal";
      } else {
        status = "drift-fallback";
        // Honest framing — "drift-fallback" is what the model does, but the
        // user-facing meaning is "we serve CBP's number rather than a worse
        // model output." That's a feature (no fake numbers), not a failure.
        // Most ML wait-time products don't disclose this. We do.
        note = "Currently matches CBP's own published baseline — we serve their number rather than a model output that would be less accurate. We disclose this honestly; most products don't.";
        noteEs = "Coincide con la línea base que CBP mismo publica — entregamos su número en vez de uno del modelo que sería menos preciso. Lo decimos abierto; la mayoría no.";
      }
    } else if (liftSelf !== null) {
      // CBP doesn't publish here. Compare against Cruzar's own climatology.
      if (liftSelf >= 5) {
        status = "self-baseline";
        note = "CBP doesn't publish historical climatology for this corridor. Lift quoted vs Cruzar's own DOW × hour baseline (first-party, computed from the training window).";
        noteEs = "CBP no publica climatología histórica para este corredor. Lift comparado contra el baseline propio de Cruzar (DOW × hora, computado de la ventana de entrenamiento).";
      } else if (liftSelf > 0) {
        status = "marginal-self";
        note = "No CBP baseline for this corridor. Small edge over Cruzar's own DOW × hour climatology.";
        noteEs = "Sin baseline CBP en este corredor. Ventaja pequeña sobre la propia climatología DOW × hora de Cruzar.";
      } else {
        status = "drift-fallback";
        note = "Model trails Cruzar's own climatology baseline. Inference falls back to that baseline until next retrain.";
        noteEs = "El modelo va detrás del baseline propio de Cruzar. Inferencia cae a ese baseline hasta el siguiente reentrenamiento.";
      }
    } else {
      // Neither baseline available — use persistence as a last-resort frame.
      const liftP = liftPers ?? 0;
      if (liftP >= 5) {
        status = "self-baseline";
      } else if (liftP > 0) {
        status = "marginal-self";
      } else {
        status = "drift-fallback";
      }
    }

    return {
      portId: row.port_id,
      name: meta.localName ?? `${meta.city}`,
      cluster: meta.megaRegion as ClusterKey,
      rmse: row.rmse_min,
      // self-baseline / marginal-self: render "—" for the CBP column since the
      // upstream API doesn't publish a baseline for this port.
      vsCbp:
        status === "self-baseline" || status === "marginal-self" ? null : liftCbp,
      vsPersistence: liftPers,
      vsSelfClimatology: liftSelf,
      status,
      note,
      noteEs,
    };
  });
}

const PORTS: PortRow[] = buildPortRows(manifest as Manifest)
  // Sort: decision-grade first by CBP lift, then self-baseline by self lift,
  // then marginals, then drift.
  .sort((a, b) => {
    const order = {
      "decision-grade": 0,
      "self-baseline": 1,
      marginal: 2,
      "marginal-self": 3,
      "drift-fallback": 4,
    } as const;
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    const aKey =
      a.status === "self-baseline" || a.status === "marginal-self"
        ? (a.vsSelfClimatology ?? -1000)
        : (a.vsCbp ?? -1000);
    const bKey =
      b.status === "self-baseline" || b.status === "marginal-self"
        ? (b.vsSelfClimatology ?? -1000)
        : (b.vsCbp ?? -1000);
    return bKey - aKey;
  });

const TOOLS = [
  {
    id: "cruzar_recommend_route",
    one: "Routing decision",
    desc: "Ranks crossings by total ETA = drive_min + ML-predicted wait at expected arrival.",
    descEs: "Ranquea cruces por ETA total = manejo + espera predicha a la hora de llegar.",
  },
  {
    id: "cruzar_briefing",
    one: "Decision artifact",
    desc: "One-shot markdown: live + historical + 6h forecast + best window. Paste into any chat.",
    descEs: "Markdown completo: vivo + histórico + pronóstico 6h + mejor ventana. Pega en cualquier chat.",
  },
  {
    id: "cruzar_anomaly_now",
    one: "Anomaly flag",
    desc: "Fires when a port runs ≥1.5× or ≤0.67× the 90-day day-of-week × hour baseline.",
    descEs: "Avisa cuando un puerto va ≥1.5× o ≤0.67× del baseline 90-días por DOW × hora.",
  },
  {
    id: "cruzar_forecast",
    one: "Per-port prediction",
    desc: "RandomForest forecast at 6h or 24h horizon. RMSE + lift returned with every call.",
    descEs: "Pronóstico RandomForest a 6h o 24h. RMSE + lift incluidos en cada respuesta.",
  },
  {
    id: "cruzar_compare_ports",
    one: "Side-by-side",
    desc: "Forecast across multiple ports, sorted by predicted wait. Built for dispatcher screens.",
    descEs: "Pronóstico de varios puertos, ordenado por espera predicha. Para dispatchers.",
  },
  {
    id: "cruzar_smart_route",
    one: "Heuristic fallback",
    desc: "current_wait + drive_distance, 5 nearest crossings. Used when the ML model is in fallback.",
    descEs: "espera_actual + distancia, 5 cruces más cercanos. Cuando el modelo está en fallback.",
  },
  {
    id: "cruzar_live_wait",
    one: "Raw CBP feed",
    desc: "Most recent reading per port: vehicle / SENTRI / pedestrian / commercial.",
    descEs: "Última lectura por puerto: vehículo / SENTRI / peatonal / comercial.",
  },
];

// Cluster grouping — every megaRegion that has at least one trained port.
// Ordered by border state west-to-east: California, Arizona, NM/El Paso, then Texas border (Eagle Pass, Laredo, RGV).
const CLUSTERS: Array<{ key: ClusterKey; en: string; es: string }> = [
  { key: "baja", en: "California / Baja", es: "California / Baja" },
  { key: "sonora-az", en: "Arizona / Sonora", es: "Arizona / Sonora" },
  { key: "el-paso", en: "El Paso / Juárez / NM", es: "El Paso / Juárez / NM" },
  { key: "coahuila-tx", en: "Eagle Pass / Del Rio / Coahuila", es: "Eagle Pass / Del Rio / Coahuila" },
  { key: "laredo", en: "Laredo / I-35 corridor", es: "Laredo / corredor I-35" },
  { key: "rgv", en: "RGV / McAllen / Brownsville", es: "RGV / McAllen / Brownsville" },
];

function fmtPct(n: number | null): string {
  if (n === null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

// Bar width capped at 100% — anything ≥40% is already strong evidence; we map
// to a 0..100 range where 40 = full bar so the visual lift reads honestly.
function barWidth(n: number | null): string {
  if (n === null) return "0%";
  const clamped = Math.max(0, Math.min(40, n));
  return `${(clamped / 40) * 100}%`;
}

export default function InsightsPage() {
  const ldjson = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Cruzar Insights",
    description:
      "Border wait-time ML forecasting service for US-Mexico freight operations. Per-port RandomForest models backtested against CBP climatology.",
    provider: { "@type": "Organization", name: "Cruzar" },
    areaServed: { "@type": "Place", name: "US-Mexico land border" },
    url: "https://www.cruzar.app/insights",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free during v0.1" },
  };

  // Aggregate stats for the masthead
  const decisionGradePorts = PORTS.filter((p) => p.status === "decision-grade");
  const decisionGradeCount = decisionGradePorts.length;
  const liftValues = decisionGradePorts.filter((p) => p.vsCbp !== null).map((p) => p.vsCbp!) as number[];
  const medianLift = (() => {
    const s = [...liftValues].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  })();
  const maxLift = liftValues.length > 0 ? Math.max(...liftValues) : 0;
  // Find the actual port at maxLift — the previous "Paso del Norte" caption was
  // hardcoded and wrong (PDN is in drift-fallback, not decision-grade). Always
  // compute from data.
  const bestPort = decisionGradePorts.find((p) => p.vsCbp === maxLift) ?? null;
  // Counts for honest disclosure
  const selfBaselineCount = PORTS.filter((p) => p.status === "self-baseline").length;
  const driftFallbackCount = PORTS.filter((p) => p.status === "drift-fallback").length;

  return (
    <div className="min-h-screen bg-[#0a1020] text-slate-100 selection:bg-amber-400/30 selection:text-amber-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldjson) }} />

      <MomentsNav current="before" />

      {/* ─── Masthead bar ─────────────────────────────────────────── */}
      <div className="border-b border-white/[0.07] bg-[#070b18]">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-white/55 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
            <span className="font-mono text-white/80">Cruzar Insights</span>
            <span className="hidden text-white/30 sm:inline">/ Vol. 0 · Iss. 5</span>
          </div>
          <div className="hidden items-center gap-5 sm:flex">
            <span className="font-mono">{(manifest as Manifest).model_version} · {new Date().toISOString().slice(0, 10)}</span>
            <a href="/" className="text-white/55 transition hover:text-amber-300">cruzar.app</a>
          </div>
        </div>
      </div>

      {/* ─── HERO / DOSSIER COVER ─────────────────────────────────── */}
      <header className="border-b border-white/[0.07] bg-gradient-to-b from-[#070b18] via-[#0a1020] to-[#0a1020]">
        <div className="mx-auto max-w-[1180px] px-5 py-12 sm:px-8 sm:py-20">
          {/* Eyebrow */}
          <div className="mb-8 grid grid-cols-2 gap-x-10 gap-y-2 text-[10.5px] uppercase tracking-[0.22em] text-white/45 sm:grid-cols-4">
            <div>
              <div className="text-white/35">Issue</div>
              <div className="font-mono text-white/80">No. 04</div>
            </div>
            <div>
              <div className="text-white/35">Filed</div>
              <div className="font-mono text-white/80">Apr 2026 · TX/NM/AZ/CA</div>
            </div>
            <div>
              <div className="text-white/35">Audience</div>
              <div className="font-mono text-white/80">Brokers · Fleets · 3PL</div>
            </div>
            <div>
              <div className="text-white/35">Delivery</div>
              <div className="font-mono text-white/80">WhatsApp · email · SMS</div>
            </div>
          </div>

          {/* Headline — honest version. The previous one led with the +52%
              outlier (Laredo Colombia Solidarity). That's one port. Real
              picture: 6 decision-grade, median +12.1%, range +9% to +52%. */}
          <h1 className="font-serif text-[clamp(2.0rem,5.4vw,4.2rem)] font-medium leading-[1.02] tracking-[-0.02em] text-white">
            We beat CBP at <span className="text-amber-400">{decisionGradeCount}</span> ports.<br />
            <span className="text-white/85">Median lift: <span className="text-amber-400">+{medianLift.toFixed(1)}%</span>.</span><br />
            <span className="text-white/55 text-[0.6em]">Honest about the rest.</span>
          </h1>

          {/* Subhead — bilingual, intentionally direct */}
          <div className="mt-7 grid max-w-3xl gap-4 sm:grid-cols-2 sm:gap-10">
            <p className="text-[15px] leading-[1.55] text-white/70">
              Per-port ML across {PORTS.length} US-Mexico crossings. {decisionGradeCount} ports
              meaningfully beat CBP's free baseline (median +{medianLift.toFixed(1)}%, max +{maxLift.toFixed(1)}% at {bestPort?.name ?? "—"}).
              {selfBaselineCount} more ports CBP doesn&apos;t even publish baselines for — we beat our own first-party climatology there.
              {driftFallbackCount} ports we honestly defer to CBP. We tell you which is which.
            </p>
            <p className="text-[15px] leading-[1.55] text-white/55" lang="es">
              ML por puerto en {PORTS.length} cruces. {decisionGradeCount} puertos le ganamos
              al baseline gratis de CBP (mediana +{medianLift.toFixed(1)}%, máx +{maxLift.toFixed(1)}% en {bestPort?.name ?? "—"}).
              {selfBaselineCount} puertos donde CBP ni publica baseline — ahí le ganamos a nuestra propia climatología.
              {driftFallbackCount} puertos nos rendimos a CBP, abierto. Te decimos cuál es cuál.
            </p>
          </div>

          {/* Stat strip — honest version. Median is the headline (not max),
              max gets a smaller treatment + the actual port name (was hardcoded
              wrong before). The two right-hand cells now show coverage breakdown
              instead of fluff stats. */}
          <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8 border-y border-white/[0.07] py-8 sm:grid-cols-4 sm:gap-x-10">
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">Median lift vs CBP</dt>
              <dd className="mt-2 font-mono text-[2.2rem] leading-none tracking-tight text-amber-400">
                +{medianLift.toFixed(1)}%
              </dd>
              <dd className="mt-1.5 text-[12px] text-white/45">across {decisionGradeCount} decision-grade ports</dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">Best single port</dt>
              <dd className="mt-2 font-mono text-[2.2rem] leading-none tracking-tight text-white">
                +{maxLift.toFixed(1)}%
              </dd>
              <dd className="mt-1.5 text-[12px] text-white/45">{bestPort?.name ?? "—"} · one outlier, not a typical port</dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">Coverage today</dt>
              <dd className="mt-2 font-mono text-[2.2rem] leading-none tracking-tight text-white">{decisionGradeCount + selfBaselineCount}<span className="text-white/40">/{PORTS.length}</span></dd>
              <dd className="mt-1.5 text-[12px] text-white/45">{decisionGradeCount} beat CBP · {selfBaselineCount} self-baseline · {driftFallbackCount} defer to CBP</dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">Delivery</dt>
              <dd className="mt-2 font-mono text-[2.2rem] leading-none tracking-tight text-white">WhatsApp</dd>
              <dd className="mt-1.5 text-[12px] text-white/45">+ email · driver SMS · API</dd>
            </div>
          </dl>

          {/* Decision-grade ports — explicit list under the hero so buyers
              can immediately check whether their lane is one we win at. */}
          {decisionGradePorts.length > 0 && (
            <div className="mt-7 rounded-2xl border border-amber-300/20 bg-amber-300/[0.03] p-5">
              <div className="text-[10.5px] uppercase tracking-[0.2em] text-amber-200 mb-3">
                Ports we beat CBP at (decision-grade today)
              </div>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 text-[13px]">
                {decisionGradePorts
                  .sort((a, b) => (b.vsCbp ?? 0) - (a.vsCbp ?? 0))
                  .map((p) => (
                    <li key={p.portId} className="flex items-baseline justify-between gap-3 border-b border-white/[0.05] pb-1.5">
                      <span className="text-white">{p.name}</span>
                      <span className="font-mono tabular-nums text-amber-300">+{(p.vsCbp ?? 0).toFixed(1)}%</span>
                    </li>
                  ))}
              </ul>
              <p className="mt-3 text-[11.5px] text-white/45 leading-[1.5]">
                If your lanes cross these ports → real value today. Other lanes → we honestly defer to CBP&apos;s own number rather than fake one.
                Pick your port below for the per-port read.
              </p>
            </div>
          )}

          {/* Primary CTA pair */}
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href="mailto:diegonaguirre@icloud.com?subject=Cruzar%20Insights%20trial%20-%20%5Byour%20fleet%5D&body=Fleet%20size%3A%20%0ALanes%20%2F%20ports%20you%20cross%3A%20%0ACurrent%20TMS%3A%20%0ABest%20number%20to%20WhatsApp%3A%20"
              className="group inline-flex items-center gap-3 rounded-2xl bg-amber-400 px-6 py-3.5 text-[14px] font-semibold text-[#0a1020] transition hover:bg-amber-300"
            >
              <span>Talk to Diego — start a trial</span>
              <span className="font-mono text-[16px] transition group-hover:translate-x-0.5" aria-hidden>→</span>
            </a>
            <a
              href="#evidence"
              className="text-[14px] font-medium text-white/70 underline decoration-white/30 decoration-1 underline-offset-[5px] transition hover:text-amber-300 hover:decoration-amber-300"
            >
              Read the backtest first
            </a>
            <a
              href="/dispatch"
              className="text-[14px] text-white/55 transition hover:text-amber-300"
            >
              ·  open the dispatcher console →
            </a>
            <a
              href="/insights/get-key"
              className="text-[14px] text-white/40 transition hover:text-white/80"
            >
              ·  developer API access
            </a>
          </div>
        </div>
      </header>

      {/* ─── 3-PERSONA TRUST PANEL ───────────────────────────────── */}
      <InsightsExpertPanel
        ports={PORTS.map((p) => ({
          port_id: p.portId,
          label: `${p.name} — ${p.cluster.toUpperCase()}`,
          lift_vs_cbp: p.vsCbp,
          status: p.status,
        }))}
      />

      {/* ─── SECTION 1 / EVIDENCE ─────────────────────────────────── */}
      <section id="evidence" className="border-b border-white/[0.07]">
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 sm:py-24">
          <SectionHead
            num="01"
            kicker="Evidence"
            kickerEs="Evidencia"
            title="Backtest, port by port."
            titleEs="Backtest, puerto por puerto."
            lede="Bars below are sized by lift versus CBP's own historical-average widget — the strongest free baseline. Held-out window: last 7 days of 35,224 scraped 15-min readings."
            ledeEs="Las barras miden la mejora vs. el widget histórico de CBP — el baseline gratis más fuerte. Ventana de prueba: últimos 7 días de 35,224 lecturas."
          />

          {/* Bar table */}
          <div className="mt-12 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.015]">
            {/* Header row */}
            <div className="hidden grid-cols-[2fr_3fr_1fr_1fr_1fr] items-end gap-4 border-b border-white/[0.08] bg-white/[0.02] px-6 py-4 text-[10.5px] uppercase tracking-[0.18em] text-white/45 sm:grid">
              <div>Crossing</div>
              <div>Lift vs CBP climatology</div>
              <div className="text-right font-mono">vs CBP</div>
              <div className="text-right font-mono">vs Persist.</div>
              <div className="text-right font-mono">RMSE</div>
            </div>

            {PORTS.map((p, i) => {
              // drift-fallback used to render rose (= "wrong/dangerous"). New
              // semantic: it means "matching CBP baseline" (we serve their
              // number rather than fake one). Slate is neutral — honest
              // disclosure, not failure. Same data, opposite signal.
              const tone =
                p.status === "decision-grade"
                  ? "text-amber-400"
                  : p.status === "self-baseline"
                  ? "text-sky-300"
                  : p.status === "marginal" || p.status === "marginal-self"
                  ? "text-white/70"
                  : "text-slate-400";
              const barColor =
                p.status === "decision-grade"
                  ? "bg-amber-400"
                  : p.status === "self-baseline"
                  ? "bg-sky-400/40"
                  : p.status === "marginal" || p.status === "marginal-self"
                  ? "bg-white/30"
                  : "bg-slate-500/30";
              // For self-baseline / marginal-self ports, bar reads against the
              // self-climatology baseline (CBP isn't published for those).
              const barLift =
                p.status === "self-baseline" || p.status === "marginal-self"
                  ? p.vsSelfClimatology
                  : p.vsCbp;
              return (
                <div
                  key={p.name + i}
                  className={`grid grid-cols-[1.6fr_2.4fr_auto_auto] items-center gap-3 border-b border-white/[0.05] px-5 py-5 last:border-b-0 sm:grid-cols-[2fr_3fr_1fr_1fr_1fr] sm:gap-4 sm:px-6 sm:py-4 ${
                    p.status === "drift-fallback"
                      ? "bg-slate-800/15"
                      : p.status === "self-baseline" || p.status === "marginal-self"
                        ? "bg-sky-950/10"
                        : ""
                  }`}
                >
                  {/* Name + cluster */}
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium text-white">{p.name}</div>
                    <div className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-white/40">{p.cluster}</div>
                  </div>

                  {/* Bar */}
                  <div className="col-span-3 sm:col-span-1">
                    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                      {barLift !== null && barLift > 0 && (
                        <div
                          className={`absolute inset-y-0 left-0 ${barColor}`}
                          style={{ width: barWidth(barLift) }}
                        />
                      )}
                      {barLift !== null && barLift < 0 && (
                        // drift-fallback = "matching CBP baseline" (we serve
                        // their number). Bar is slate, not rose — honest
                        // neutral disclosure, not visual failure.
                        <div
                          className="absolute inset-y-0 right-1/2 bg-slate-500/40"
                          style={{ width: barWidth(Math.abs(barLift)) }}
                        />
                      )}
                      {/* Reference tick at +20% */}
                      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-white/[0.12]" />
                    </div>
                    {p.note && (
                      <p className="mt-2 text-[12px] leading-snug text-white/45">{p.note}</p>
                    )}
                  </div>

                  {/* vs CBP */}
                  <div className={`text-right font-mono text-[14px] tabular-nums ${tone}`}>
                    {fmtPct(p.vsCbp)}
                  </div>

                  {/* vs Persistence */}
                  <div className="text-right font-mono text-[13px] tabular-nums text-white/55">
                    {fmtPct(p.vsPersistence)}
                  </div>

                  {/* RMSE */}
                  <div className="text-right font-mono text-[12px] tabular-nums text-white/45">
                    {p.rmse !== null ? `${p.rmse.toFixed(1)}m` : "—"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reference note */}
          <div className="mt-6 grid gap-2 text-[12.5px] leading-relaxed text-white/45 sm:grid-cols-[auto_1fr] sm:gap-6">
            <div className="font-mono uppercase tracking-[0.16em] text-white/35">Reading the bars</div>
            <div>
              Tick at the midpoint = +20%. <span className="text-amber-300">Amber</span> = decision-grade
              lift vs CBP climatology (the strongest free baseline a TX broker already uses).{' '}
              <span className="text-sky-300">Sky</span> = self-baseline (CBP doesn&apos;t publish for that
              corridor — typically CA/AZ/NM — so the bar reads against Cruzar&apos;s own DOW × hour
              climatology computed from the training window). Grey = small positive edge.{' '}
              <span className="text-slate-300">Slate</span> = matching CBP baseline; we serve CBP&apos;s
              own number rather than a model output we can&apos;t beat. Honest disclosure, not failure —
              most ML wait-time products don&apos;t tell you when they fall back. We do.
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2 / WHAT YOU CAN DO WITH IT ─────────────────── */}
      <section className="border-b border-white/[0.07]">
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 sm:py-24">
          <SectionHead
            num="02"
            kicker="Decisions"
            kickerEs="Decisiones"
            title="What a dispatcher actually does with this."
            titleEs="Qué hace un dispatcher con esto."
            lede="Three concrete moves. Numbers from a typical Friday afternoon at the I-35 corridor."
            ledeEs="Tres jugadas concretas. Números de un viernes típico en el corredor I-35."
          />

          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] sm:grid-cols-3">
            <UseCase
              num="01"
              en={{
                title: "Reroute the truck",
                pitch: "When the model says Laredo II will hit 92 min in 6h and Colombia Solidarity stays at 18, the call is obvious. The cost: $85/hr × delay × truck count.",
                tag: "cruzar_recommend_route",
              }}
              es={{
                title: "Redirigir el camión",
                pitch: "Si el modelo dice que Laredo II llegará a 92 min y Colombia se queda en 18, la decisión es clara. Costo: $85/hr × demora × camiones.",
              }}
            />
            <UseCase
              num="02"
              en={{
                title: "Pre-stage at the optimal hour",
                pitch: "Best window per port for a given DOW × hour. Brokers shift dispatch by 90 minutes and clear an hour of wait without changing the route.",
                tag: "cruzar_briefing",
              }}
              es={{
                title: "Salir a la hora óptima",
                pitch: "Mejor ventana por puerto y día. Brokers mueven 90 min el dispatch y se ahorran una hora sin cambiar el cruce.",
              }}
            />
            <UseCase
              num="03"
              en={{
                title: "Get paged when it breaks",
                pitch: "Anomaly tool fires when a port is running 1.5× its 90-day baseline. Catch a closure or holiday surge before your driver is stuck in it.",
                tag: "cruzar_anomaly_now",
              }}
              es={{
                title: "Alerta cuando algo se rompe",
                pitch: "Salta cuando un puerto va a 1.5× del baseline de 90 días. Detecta cierres o eventos antes de que tu chofer esté atorado.",
              }}
            />
          </div>
        </div>
      </section>

      {/* ─── SECTION 3 / TOOL CATALOG ─────────────────────────────── */}
      <section className="border-b border-white/[0.07] bg-[#070b18]">
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 sm:py-24">
          <SectionHead
            num="03"
            kicker="Capabilities"
            kickerEs="Capacidades"
            title="Seven decisions Cruzar makes during the run."
            titleEs="Siete decisiones que Cruzar toma durante el viaje."
            lede="While your driver's en route, these are the calls Cruzar makes for the dispatch desk — anomaly catch, route reroute, ETA confirm, morning briefing. Each one is a tool the system runs on its own data feed."
            ledeEs="Mientras tu chofer maneja, estas son las decisiones que Cruzar toma por la mesa de control — detectar anomalías, reruteo, confirmar ETA, briefing matutino. Cada una corre sobre el feed propio del sistema."
          />

          <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] sm:grid-cols-2">
            {TOOLS.map((t, i) => (
              <li key={t.id} className="flex items-start gap-5 bg-[#0a1020] p-6 sm:p-7">
                <div className="font-mono text-[11px] tabular-nums tracking-[0.15em] text-white/35">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <code className="font-mono text-[13.5px] text-amber-300">{t.id}</code>
                    <span className="text-[10.5px] uppercase tracking-[0.18em] text-white/40">{t.one}</span>
                  </div>
                  <p className="mt-2 text-[13.5px] leading-[1.55] text-white/70">{t.desc}</p>
                  <p className="mt-1 text-[12.5px] leading-[1.55] text-white/40" lang="es">{t.descEs}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─── SECTION 4 / DELIVERY ─────────────────────────────────── */}
      <section className="border-b border-white/[0.07]">
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 sm:py-24">
          <SectionHead
            num="04"
            kicker="Delivery"
            kickerEs="Entrega"
            title="Where Cruzar shows up in your day."
            titleEs="Dónde aparece Cruzar en tu día."
            lede="WhatsApp push the moment a port flags anomaly. Morning briefing at 5am to your inbox. Direct SMS to the driver when a reroute saves time. No new dashboard to learn — Cruzar lives where your dispatch desk already does."
            ledeEs="WhatsApp en cuanto un puerto detecta anomalía. Briefing matutino a las 5am al correo. SMS directo al chofer cuando reruteo ahorra tiempo. Sin tableros nuevos — Cruzar vive donde ya trabajas."
          />

          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] sm:grid-cols-2">
            <div className="bg-[#0a1020] p-6 sm:p-7">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] tabular-nums tracking-[0.15em] text-white/35">01</span>
                <span className="font-mono text-[13.5px] text-amber-300">WhatsApp</span>
                <span className="text-[10.5px] uppercase tracking-[0.18em] text-white/40">Push + reply</span>
              </div>
              <p className="mt-2 text-[13.5px] leading-[1.55] text-white/70">
                Anomaly alerts the moment a watched port runs ≥1.5× its baseline. Reply <code className="font-mono text-white/85">wait at pharr</code> from your phone to get the live read. Multi-recipient on fleet tier.
              </p>
              <p className="mt-1 text-[12.5px] leading-[1.55] text-white/40" lang="es">
                Alertas de anomalía cuando un puerto vigilado pasa el 1.5× del baseline. Responde <code className="font-mono text-white/65">espera en pharr</code> para la lectura viva. Multi-destinatario en plan flota.
              </p>
            </div>

            <div className="bg-[#0a1020] p-6 sm:p-7">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] tabular-nums tracking-[0.15em] text-white/35">02</span>
                <span className="font-mono text-[13.5px] text-amber-300">Email briefing</span>
                <span className="text-[10.5px] uppercase tracking-[0.18em] text-white/40">5am daily</span>
              </div>
              <p className="mt-2 text-[13.5px] leading-[1.55] text-white/70">
                Top-3 ports for your tracked lanes, ranked by predicted wait + drift status. Sent before your dispatchers come online — they walk in already calibrated.
              </p>
              <p className="mt-1 text-[12.5px] leading-[1.55] text-white/40" lang="es">
                Top-3 puertos de tus carriles, ordenados por espera predicha + estado de drift. Llega antes de que tus dispatchers entren — ya saben qué cruzar.
              </p>
            </div>

            <div className="bg-[#0a1020] p-6 sm:p-7">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] tabular-nums tracking-[0.15em] text-white/35">03</span>
                <span className="font-mono text-[13.5px] text-amber-300">Driver SMS</span>
                <span className="text-[10.5px] uppercase tracking-[0.18em] text-white/40">Direct reroute</span>
              </div>
              <p className="mt-2 text-[13.5px] leading-[1.55] text-white/70">
                Cruzar texts the driver direct: <em>"Pharr 47min · switch to Donna +12mi · net save 32min"</em>. Drive-time math factored — only fires when the math actually justifies the switch.
              </p>
              <p className="mt-1 text-[12.5px] leading-[1.55] text-white/40" lang="es">
                Cruzar le manda mensaje directo al chofer: <em>"Pharr 47min · cámbiate a Donna +12mi · ahorras 32min neto"</em>. Solo dispara cuando los números lo justifican.
              </p>
            </div>

            <div className="bg-[#0a1020] p-6 sm:p-7">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] tabular-nums tracking-[0.15em] text-white/35">04</span>
                <span className="font-mono text-[13.5px] text-amber-300">CSV / TMS hook</span>
                <span className="text-[10.5px] uppercase tracking-[0.18em] text-white/40">Enterprise</span>
              </div>
              <p className="mt-2 text-[13.5px] leading-[1.55] text-white/70">
                Webhook into McLeod, TMW, Aljex, or your custom dispatch board. Or pull a CSV of forecasts every 15 minutes. Sales-led for now — <a href="mailto:diegonaguirre@icloud.com?subject=Cruzar%20Insights%20-%20TMS%20integration" className="text-amber-300 hover:text-amber-200">email Diego with your stack</a>.
              </p>
              <p className="mt-1 text-[12.5px] leading-[1.55] text-white/40" lang="es">
                Webhook a McLeod, TMW, Aljex, o tu tablero propio. O baja un CSV de pronósticos cada 15 min. Por venta directa — escríbele a Diego con tu stack.
              </p>
            </div>
          </div>

          {/* Dev/MCP hook lives on /mcp + /insights/get-key directly — buyer surface keeps no AI-tooling framing per the operator pivot 2026-04-29. */}
        </div>
      </section>

      {/* ─── SECTION 5 / HOW IT WORKS ─────────────────────────────── */}
      <section className="border-b border-white/[0.07] bg-[#070b18]">
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 sm:py-24">
          <SectionHead
            num="05"
            kicker="Method"
            kickerEs="Método"
            title="How the model is built — and where it breaks."
            titleEs="Cómo está hecho el modelo — y dónde falla."
            lede="No black box. Per-port RandomForest on engineered features, retrained on a schedule, with explicit fallback when drift is detected."
            ledeEs="Sin caja negra. RandomForest por puerto, features ingenierados, reentrenamiento programado, con fallback explícito al detectar drift."
          />

          <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_1fr]">
            {/* Left: structured method facts */}
            <dl className="grid gap-7">
              <MethodRow
                k="Data"
                kEs="Datos"
                v="230,000+ readings scraped from CBP's public BWT API every 15 minutes since March 2026, plus BTS monthly cross-border volumes 1996–present, plus CBP's own historical-climatology widget exposed at /api/historicalwaittimes/."
                vEs="230,000+ lecturas del BWT público de CBP cada 15 min desde marzo 2026, más BTS volúmenes mensuales 1996–presente, más el widget histórico de CBP."
              />
              <MethodRow
                k="Features"
                kEs="Features"
                v="21 per port: cyclical time encoding, lag1, rolling 4 / 16 / 96 step, 24h-ago, 168h-ago, weather, lane counts, BTS volume, CBP climatology, deviation from climatology now."
                vEs="21 por puerto: tiempo cíclico, lag1, rolling 4/16/96, 24h y 168h atrás, clima, número de carriles, volumen BTS, climatología CBP, desviación actual."
              />
              <MethodRow
                k="Backtest"
                kEs="Backtest"
                v="Last 7 days held out. Two baselines reported: persistence (next = last reading) and CBP climatology (DOW × hour × month historical average). Lift = (baseline_RMSE − model_RMSE) / baseline_RMSE."
                vEs="Últimos 7 días reservados. Dos baselines: persistencia y climatología CBP. Lift = (RMSE_baseline − RMSE_modelo) / RMSE_baseline."
              />
              <MethodRow
                k="Drift handling"
                kEs="Drift"
                v="Concept drift detected via rolling RMSE delta. Affected ports return CBP climatology + a deviation flag instead of a degraded prediction. Pharr–Reynosa is in fallback now; we don't pretend it isn't."
                vEs="Drift detectado por delta de RMSE móvil. Los puertos afectados devuelven climatología CBP + bandera. Pharr–Reynosa está en fallback ahora; no lo escondemos."
              />
            </dl>

            {/* Right: citations + license */}
            <div className="space-y-7">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-7">
                <div className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">Citations / Linaje</div>
                <ul className="mt-4 space-y-3.5 text-[13.5px] leading-[1.5] text-white/70">
                  <li className="grid grid-cols-[auto_1fr] gap-x-4">
                    <span className="font-mono text-amber-300/90">2024</span>
                    <span>Sakhare et al. — <em>Purdue, 26 US-MX crossings, 93k+ Wejo trips.</em> Methodology baseline.</span>
                  </li>
                  <li className="grid grid-cols-[auto_1fr] gap-x-4">
                    <span className="font-mono text-amber-300/90">2026</span>
                    <span>Samant et al. — <em>TTI lane-level pilot.</em> Validates per-lane resolution.</span>
                  </li>
                  <li className="grid grid-cols-[auto_1fr] gap-x-4">
                    <span className="font-mono text-amber-300/90">2023</span>
                    <span>Lu — concept drift detection in transportation time-series.</span>
                  </li>
                  <li className="grid grid-cols-[auto_1fr] gap-x-4">
                    <span className="font-mono text-amber-300/90">2024</span>
                    <span>Li — drift-aware model selection. Why we fall back instead of guessing.</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-7">
                <div className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">License / Licencia</div>
                <p className="mt-3 text-[13.5px] leading-[1.55] text-white/70">
                  Built on public-domain CBP and BTS data. Model and pipeline are Cruzar's. <strong className="text-white/90">No DHS or CBP endorsement is implied.</strong>
                </p>
                <p className="mt-2 text-[12.5px] leading-[1.55] text-white/45" lang="es">
                  Sobre datos públicos de CBP y BTS. El modelo y pipeline son de Cruzar. No implica respaldo de DHS o CBP.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 6 / OPERATING NOTES (HONEST LIMITS) ──────────── */}
      <section className="border-b border-white/[0.07]">
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 sm:py-24">
          <SectionHead
            num="06"
            kicker="Limits"
            kickerEs="Límites"
            title="Things this is not."
            titleEs="Lo que esto no es."
            lede="Skeptical buyers should know what they're paying for — and what they aren't."
            ledeEs="Compradores escépticos deben saber qué están pagando — y qué no."
          />

          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] sm:grid-cols-2">
            <Caveat
              en={{
                t: "Not a 1-hour predictor.",
                d: "At 1h horizon, persistence (the last CBP reading) usually wins. Use the live tool for that. Our edge is 6h to 24h ahead.",
              }}
              es={{
                t: "No es un predictor a 1 hora.",
                d: "A 1h, persistencia gana. Para eso usa la lectura viva. Nuestra ventaja está a 6h–24h.",
              }}
            />
            <Caveat
              en={{
                t: "Not a replacement for CBP.",
                d: "We layer on CBP. When their climatology is stronger than our prediction (concept drift, regime shift), we return CBP and tell you.",
              }}
              es={{
                t: "No reemplaza a CBP.",
                d: "Trabajamos sobre CBP. Si su climatología supera nuestro pronóstico, devolvemos CBP y avisamos.",
              }}
            />
            <Caveat
              en={{
                t: "Not lane-aware (yet).",
                d: "Current models forecast vehicle wait. SENTRI and commercial lane separation is on the roadmap — see Samant 2026 for what shape that takes.",
              }}
              es={{
                t: "Aún sin separar por carril.",
                d: "Los modelos pronostican espera vehicular. Separación SENTRI/comercial está en el roadmap.",
              }}
            />
            <Caveat
              en={{
                t: "Not affiliated with CBP or DHS.",
                d: "We use public-domain data. We are not a federal contractor and do not represent the US government.",
              }}
              es={{
                t: "Sin afiliación con CBP ni DHS.",
                d: "Usamos datos públicos. No somos contratistas federales ni representamos al gobierno de EE.UU.",
              }}
            />
          </div>
        </div>
      </section>

      {/* ─── SECTION 7 / COVERAGE MAP ─────────────────────────────── */}
      <section className="border-b border-white/[0.07] bg-[#070b18]">
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 sm:py-24">
          <SectionHead
            num="07"
            kicker="Coverage"
            kickerEs="Cobertura"
            title="Where the model is in production."
            titleEs="Dónde está el modelo en producción."
            lede="Every US-Mexico land crossing CBP publishes wait times for. Decision-grade today on the corridors with full CBP-climatology backfill; coverage-pending on the rest as backfill completes."
            ledeEs="Seis clusters en la frontera US-México. Decision-grade hoy, ampliando cada mes."
          />

          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] sm:grid-cols-2 lg:grid-cols-3">
            {CLUSTERS.map((c, i) => {
              const cPorts = PORTS.filter((p) => p.cluster === c.key);
              // Count ports we'd recommend — beats the relevant baseline (CBP for TX,
              // persistence for CA/AZ/NM where CBP isn't published).
              const decision = cPorts.filter(
                (p) => p.status === "decision-grade" || p.status === "self-baseline",
              ).length;
              return (
                <div key={c.key} className="bg-[#0a1020] p-6 sm:p-7">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="font-mono text-[10.5px] tabular-nums tracking-[0.18em] text-white/35">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="font-mono text-[11px] tabular-nums text-amber-300/80">
                      {decision} / {cPorts.length}
                    </div>
                  </div>
                  <div className="mt-2 text-[15px] font-medium text-white">{c.en}</div>
                  <div className="text-[12.5px] text-white/45" lang="es">{c.es}</div>
                  <ul className="mt-4 space-y-1.5 text-[12.5px] leading-snug text-white/55">
                    {cPorts.map((p) => (
                      <li key={p.name} className="flex items-baseline justify-between gap-3">
                        <span className="truncate">{p.name}</span>
                        <span
                          className={`font-mono text-[11px] tabular-nums ${
                            p.status === "decision-grade"
                              ? "text-amber-400"
                              : p.status === "self-baseline"
                              ? "text-sky-300"
                              : p.status === "marginal" || p.status === "marginal-self"
                              ? "text-white/45"
                              : "text-slate-400"
                          }`}
                        >
                          {p.status === "self-baseline" || p.status === "marginal-self"
                            ? `${fmtPct(p.vsSelfClimatology)}s`
                            : fmtPct(p.vsCbp)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── CTA / GET A KEY ──────────────────────────────────────── */}
      <section className="border-b border-white/[0.07]">
        <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-400">
                Self-serve · 30s
              </div>
              <h2 className="mt-4 font-serif text-[clamp(2rem,4.5vw,3.4rem)] font-medium leading-[1.02] tracking-[-0.015em] text-white">
                Get a key. Make a call.<br />
                <span className="text-white/55">See if the lift is real.</span>
              </h2>
              <p className="mt-5 max-w-xl text-[14.5px] leading-[1.6] text-white/65">
                Submit your email and what you're building. The key arrives in your inbox immediately.
                We hash it server-side and never store the plaintext. Free during v0.1 — usage caps may
                apply later.
              </p>
              <p className="mt-2 max-w-xl text-[13px] leading-[1.55] text-white/40" lang="es">
                Envía tu correo y qué estás construyendo. La key llega al instante, hasheada en el server.
                Gratis durante v0.1.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <a
                  href="/insights/get-key"
                  className="group inline-flex items-center gap-3 rounded-2xl bg-amber-400 px-7 py-4 text-[14.5px] font-semibold text-[#0a1020] transition hover:bg-amber-300"
                >
                  <span>Get my key</span>
                  <span className="font-mono text-[16px] transition group-hover:translate-x-0.5" aria-hidden>→</span>
                </a>
                <a
                  href="mailto:diegonaguirre@icloud.com?subject=Cruzar%20Insights%20question"
                  className="text-[14px] font-medium text-white/55 underline decoration-white/20 decoration-1 underline-offset-[5px] transition hover:text-amber-300 hover:decoration-amber-300"
                >
                  Or email Diego directly
                </a>
              </div>
            </div>

            {/* Marginalia / FAQ-lite */}
            <aside className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7">
              <div className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">Quick answers</div>
              <dl className="mt-5 divide-y divide-white/[0.06] text-[13px] leading-[1.55]">
                <div className="grid gap-1 py-3.5 first:pt-0">
                  <dt className="font-medium text-white">Pricing once v0.1 closes?</dt>
                  <dd className="text-white/55">Tiered by call volume. Email Diego for an early-bird rate before paid launch.</dd>
                </div>
                <div className="grid gap-1 py-3.5">
                  <dt className="font-medium text-white">SLA?</dt>
                  <dd className="text-white/55">Best-effort during v0.1. Inference falls back to CBP climatology on any model error so callers always get an answer.</dd>
                </div>
                <div className="grid gap-1 py-3.5">
                  <dt className="font-medium text-white">Can I run it from a cron?</dt>
                  <dd className="text-white/55">Yes. Stateless HTTP, bearer-auth. Two-line curl call returns the same JSON the MCP client gets.</dd>
                </div>
                <div className="grid gap-1 py-3.5 last:pb-0">
                  <dt className="font-medium text-white">¿Está en español?</dt>
                  <dd className="text-white/55" lang="es">Sí. Todas las herramientas aceptan parámetros y devuelven JSON. Las descripciones markdown están en EN.</dd>
                </div>
              </dl>
            </aside>
          </div>
        </div>
      </section>

      {/* ─── COLOPHON ─────────────────────────────────────────────── */}
      <footer>
        <div className="mx-auto max-w-[1180px] px-5 py-12 sm:px-8">
          <div className="grid gap-6 text-[12px] leading-[1.55] text-white/40 sm:grid-cols-[2fr_1fr_1fr]">
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">Colophon</div>
              <p className="mt-3 max-w-md">
                Cruzar Insights is a B2B layer on top of <a className="text-amber-300 underline decoration-amber-300/30 underline-offset-2 hover:decoration-amber-300" href="/">cruzar.app</a>, the consumer border-crossing app. Same data backbone, different audience. Built in the Rio Grande Valley.
              </p>
            </div>
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">Sources</div>
              <ul className="mt-3 space-y-1.5">
                <li>CBP BWT public API</li>
                <li>BTS Border Crossing/Entry</li>
                <li>Cruzar 15-min scrape</li>
              </ul>
            </div>
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">Direct lines</div>
              <ul className="mt-3 space-y-1.5">
                <li><a className="hover:text-amber-300" href="/live">/live — public forecasts</a></li>
                <li><a className="hover:text-amber-300" href="/insights/get-key">/insights/get-key</a></li>
                <li><a className="hover:text-amber-300" href="mailto:diegonaguirre@icloud.com">diegonaguirre@icloud.com</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5 text-[11px] text-white/30">
            <span className="font-mono">© 2026 Cruzar · Not affiliated with CBP or DHS.</span>
            <span className="font-mono">{(manifest as Manifest).model_version} · {PORTS.length} ports · MCP</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Editorial section header ───────────────────────────────────
function SectionHead(props: {
  num: string;
  kicker: string;
  kickerEs: string;
  title: string;
  titleEs: string;
  lede: string;
  ledeEs: string;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:gap-14">
      <div className="flex items-baseline gap-4 lg:flex-col lg:items-start lg:gap-2">
        <div className="font-mono text-[clamp(2rem,3.5vw,3rem)] tabular-nums leading-none text-amber-400">
          §{props.num}
        </div>
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-white/45">
          {props.kicker}
          <span className="ml-2 text-white/30" lang="es">/ {props.kickerEs}</span>
        </div>
      </div>
      <div className="max-w-3xl">
        <h2 className="font-serif text-[clamp(1.85rem,3.4vw,2.85rem)] font-medium leading-[1.05] tracking-[-0.015em] text-white">
          {props.title}
        </h2>
        <h3 className="mt-1 font-serif text-[clamp(1.6rem,3vw,2.4rem)] font-normal italic leading-[1.05] tracking-[-0.012em] text-white/40" lang="es">
          {props.titleEs}
        </h3>
        <p className="mt-5 text-[15px] leading-[1.6] text-white/65">{props.lede}</p>
        <p className="mt-1.5 text-[13.5px] leading-[1.55] text-white/40" lang="es">{props.ledeEs}</p>
      </div>
    </div>
  );
}

// ─── Use-case card ──────────────────────────────────────────────
function UseCase(props: {
  num: string;
  en: { title: string; pitch: string; tag: string };
  es: { title: string; pitch: string };
}) {
  return (
    <div className="bg-[#0a1020] p-7 sm:p-8">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-mono text-[11px] tabular-nums tracking-[0.18em] text-white/35">
          §02 / {props.num}
        </div>
        <code className="font-mono text-[11px] text-amber-300/85">{props.en.tag}</code>
      </div>
      <h3 className="mt-4 font-serif text-[1.4rem] font-medium leading-[1.15] tracking-[-0.01em] text-white">
        {props.en.title}
      </h3>
      <h4 className="mt-1 font-serif text-[1.1rem] italic font-normal text-white/40" lang="es">
        {props.es.title}
      </h4>
      <p className="mt-4 text-[13.5px] leading-[1.55] text-white/70">{props.en.pitch}</p>
      <p className="mt-2 text-[12.5px] leading-[1.5] text-white/40" lang="es">{props.es.pitch}</p>
    </div>
  );
}

// ─── Method row ─────────────────────────────────────────────────
function MethodRow(props: { k: string; kEs: string; v: string; vEs: string }) {
  return (
    <div className="grid gap-3 border-l-2 border-amber-400/60 pl-5">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-400">{props.k}</span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/30" lang="es">/ {props.kEs}</span>
      </div>
      <p className="text-[13.5px] leading-[1.55] text-white/75">{props.v}</p>
      <p className="text-[12.5px] leading-[1.5] text-white/40" lang="es">{props.vEs}</p>
    </div>
  );
}

// ─── Caveat card ────────────────────────────────────────────────
function Caveat(props: { en: { t: string; d: string }; es: { t: string; d: string } }) {
  return (
    <div className="bg-[#0a1020] p-7">
      <div className="flex items-start gap-3">
        <span className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-rose-400/70" aria-hidden />
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-white">{props.en.t}</div>
          <div className="text-[13px] italic text-white/40" lang="es">{props.es.t}</div>
          <p className="mt-3 text-[13px] leading-[1.55] text-white/65">{props.en.d}</p>
          <p className="mt-1.5 text-[12px] leading-[1.5] text-white/40" lang="es">{props.es.d}</p>
        </div>
      </div>
    </div>
  );
}

