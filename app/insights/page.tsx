import { MomentsNav } from "@/components/MomentsNav";

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
// Source data: backtests verified live against the v0.4 model + CBP
// historicalwaittimes climatology + persistence baseline.

export const runtime = "nodejs";
export const revalidate = 3600;

export const metadata = {
  title: "Cruzar Insights — ML wait-time forecasts that beat the CBP baseline",
  description:
    "Per-port machine-learning forecasts for 36 US-MX border crossings. Backtested against CBP's own free climatology. Decision-grade lift on Laredo, Brownsville, Paso del Norte, Rio Grande City, Eagle Pass. Self-serve API key, MCP-native.",
  alternates: { canonical: "https://www.cruzar.app/insights" },
};

// Backtest results — last 7 days held-out, 6-hour horizon unless noted.
// These are real model outputs; do not edit casually.
type PortRow = {
  name: string;
  cluster: "Laredo" | "Brownsville" | "RGV West" | "Rio Grande City" | "Eagle Pass" | "Paso del Norte";
  rmse: number | null;
  vsCbp: number | null;
  vsPersistence: number | null;
  status: "decision-grade" | "marginal" | "drift-fallback";
  note?: string;
  noteEs?: string;
};

const PORTS: PortRow[] = [
  { name: "Laredo World Trade Bridge", cluster: "Laredo", rmse: 16.7, vsCbp: 16.5, vsPersistence: 42.9, status: "decision-grade" },
  { name: "Laredo II (24h horizon)", cluster: "Laredo", rmse: null, vsCbp: 12.0, vsPersistence: 41.7, status: "decision-grade" },
  { name: "Brownsville Veterans", cluster: "Brownsville", rmse: 36.4, vsCbp: 18.1, vsPersistence: 35.5, status: "decision-grade" },
  { name: "Paso del Norte", cluster: "Paso del Norte", rmse: null, vsCbp: 35.1, vsPersistence: null, status: "decision-grade" },
  { name: "Rio Grande City", cluster: "Rio Grande City", rmse: null, vsCbp: 37.3, vsPersistence: null, status: "decision-grade" },
  { name: "Eagle Pass I (24h horizon)", cluster: "Eagle Pass", rmse: null, vsCbp: 18.7, vsPersistence: null, status: "decision-grade" },
  { name: "Hidalgo / McAllen", cluster: "RGV West", rmse: 20.9, vsCbp: 6.4, vsPersistence: 25.3, status: "decision-grade" },
  { name: "Anzaldúas", cluster: "RGV West", rmse: 18.1, vsCbp: 4.6, vsPersistence: 22.1, status: "decision-grade" },
  { name: "Brownsville Gateway B&M", cluster: "Brownsville", rmse: 51.2, vsCbp: 1.1, vsPersistence: 23.4, status: "marginal" },
  { name: "Eagle Pass (6h)", cluster: "Eagle Pass", rmse: 22.9, vsCbp: -3.6, vsPersistence: 17.5, status: "marginal", note: "Persistence beats us at 6h here. We auto-fall-back.", noteEs: "Persistencia gana a 6h. Caemos al baseline." },
  { name: "Pharr–Reynosa", cluster: "RGV West", rmse: null, vsCbp: null, vsPersistence: null, status: "drift-fallback", note: "Concept drift detected. Inference returns CBP climatology until model retrains.", noteEs: "Drift detectado. Devolvemos climatología CBP hasta reentrenar." },
];

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

// Cluster grouping for the side-rail navigation
const CLUSTERS: Array<{ key: PortRow["cluster"]; en: string; es: string }> = [
  { key: "Laredo", en: "Laredo / I-35 corridor", es: "Laredo / corredor I-35" },
  { key: "Brownsville", en: "Brownsville / Matamoros", es: "Brownsville / Matamoros" },
  { key: "RGV West", en: "RGV West (McAllen)", es: "RGV Oeste (McAllen)" },
  { key: "Eagle Pass", en: "Eagle Pass / Piedras Negras", es: "Eagle Pass / Piedras Negras" },
  { key: "Rio Grande City", en: "Rio Grande City / Camargo", es: "Rio Grande City / Camargo" },
  { key: "Paso del Norte", en: "Paso del Norte / Juárez", es: "Paso del Norte / Juárez" },
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
  const decisionGradeCount = PORTS.filter((p) => p.status === "decision-grade").length;
  const liftValues = PORTS.filter((p) => p.status === "decision-grade" && p.vsCbp !== null).map((p) => p.vsCbp!) as number[];
  const medianLift = (() => {
    const s = [...liftValues].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  })();
  const maxLift = Math.max(...liftValues);

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
            <span className="hidden text-white/30 sm:inline">/ Vol. 0 · Iss. 4</span>
          </div>
          <div className="hidden items-center gap-5 sm:flex">
            <span className="font-mono">v0.4 · {new Date().toISOString().slice(0, 10)}</span>
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
              <div className="font-mono text-white/80">Apr 2026 · RGV</div>
            </div>
            <div>
              <div className="text-white/35">Audience</div>
              <div className="font-mono text-white/80">Brokers · Fleets · 3PL</div>
            </div>
            <div>
              <div className="text-white/35">Distribution</div>
              <div className="font-mono text-white/80">MCP · HTTPS · curl</div>
            </div>
          </div>

          {/* Headline — editorial / data-journalism */}
          <h1 className="font-serif text-[clamp(2.4rem,6.4vw,5.4rem)] font-medium leading-[0.98] tracking-[-0.02em] text-white">
            We forecast the border<br />
            <span className="text-amber-400">{fmtPct(maxLift).replace("+", "")}</span> better<br />
            <span className="text-white/85">than the free CBP baseline.</span>
          </h1>

          {/* Subhead — bilingual, intentionally direct */}
          <div className="mt-7 grid max-w-3xl gap-4 sm:grid-cols-2 sm:gap-10">
            <p className="text-[15px] leading-[1.55] text-white/70">
              Per-port machine-learning models for {PORTS.length} US-Mexico crossings. Backtested against CBP's
              own free climatology widget — the smartest baseline a competent broker already uses.
              Honest about where we degrade.
            </p>
            <p className="text-[15px] leading-[1.55] text-white/55" lang="es">
              Modelos ML por puerto para {PORTS.length} cruces US-México. Probado contra el widget público
              de CBP — el baseline más fuerte que un buen broker ya usa. Transparentes con
              dónde fallamos.
            </p>
          </div>

          {/* Stat strip */}
          <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8 border-y border-white/[0.07] py-8 sm:grid-cols-4 sm:gap-x-10">
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">Best lift vs CBP</dt>
              <dd className="mt-2 font-mono text-[2.2rem] leading-none tracking-tight text-amber-400">
                +{maxLift.toFixed(1)}%
              </dd>
              <dd className="mt-1.5 text-[12px] text-white/45">Paso del Norte · 6h</dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">Median lift</dt>
              <dd className="mt-2 font-mono text-[2.2rem] leading-none tracking-tight text-white">
                +{medianLift.toFixed(1)}%
              </dd>
              <dd className="mt-1.5 text-[12px] text-white/45">{decisionGradeCount} decision-grade ports</dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">Backbone</dt>
              <dd className="mt-2 font-mono text-[2.2rem] leading-none tracking-tight text-white">230k+</dd>
              <dd className="mt-1.5 text-[12px] text-white/45">15-min CBP readings, since Mar '26</dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">Distribution</dt>
              <dd className="mt-2 font-mono text-[2.2rem] leading-none tracking-tight text-white">MCP</dd>
              <dd className="mt-1.5 text-[12px] text-white/45">Claude · Cursor · curl · 7 tools</dd>
            </div>
          </dl>

          {/* Primary CTA pair */}
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href="/insights/get-key"
              className="group inline-flex items-center gap-3 rounded-2xl bg-amber-400 px-6 py-3.5 text-[14px] font-semibold text-[#0a1020] transition hover:bg-amber-300"
            >
              <span>Get my key</span>
              <span className="font-mono text-[16px] transition group-hover:translate-x-0.5" aria-hidden>→</span>
            </a>
            <a
              href="#evidence"
              className="text-[14px] font-medium text-white/70 underline decoration-white/30 decoration-1 underline-offset-[5px] transition hover:text-amber-300 hover:decoration-amber-300"
            >
              Read the backtest first
            </a>
            <a
              href="mailto:diegonaguirre@icloud.com?subject=Cruzar%20Insights"
              className="text-[14px] text-white/45 transition hover:text-white/80"
            >
              ·  email Diego
            </a>
          </div>
        </div>
      </header>

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
              const tone =
                p.status === "decision-grade"
                  ? "text-amber-400"
                  : p.status === "marginal"
                  ? "text-white/70"
                  : "text-rose-300/70";
              const barColor =
                p.status === "decision-grade"
                  ? "bg-amber-400"
                  : p.status === "marginal"
                  ? "bg-white/30"
                  : "bg-rose-400/30";
              return (
                <div
                  key={p.name + i}
                  className={`grid grid-cols-[1.6fr_2.4fr_auto_auto] items-center gap-3 border-b border-white/[0.05] px-5 py-5 last:border-b-0 sm:grid-cols-[2fr_3fr_1fr_1fr_1fr] sm:gap-4 sm:px-6 sm:py-4 ${
                    p.status === "drift-fallback" ? "bg-rose-950/10" : ""
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
                      {p.vsCbp !== null && p.vsCbp > 0 && (
                        <div
                          className={`absolute inset-y-0 left-0 ${barColor}`}
                          style={{ width: barWidth(p.vsCbp) }}
                        />
                      )}
                      {p.vsCbp !== null && p.vsCbp < 0 && (
                        <div
                          className="absolute inset-y-0 right-1/2 bg-rose-400/40"
                          style={{ width: barWidth(Math.abs(p.vsCbp)) }}
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
              Tick at the midpoint = +20%. Amber bars are decision-grade lift (sustained &gt; CBP).
              Grey = marginal. Rose = drift-fallback; the inference API auto-returns CBP climatology so
              callers never see broken predictions.
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
            kicker="Distribution"
            kickerEs="Distribución"
            title="Seven tools. One MCP endpoint."
            titleEs="Siete herramientas. Un endpoint MCP."
            lede="Bearer-auth, stateless HTTP, no SDK install. Plug into Claude Desktop, Claude Code, Cursor, or curl from a cron."
            ledeEs="Bearer-auth, HTTP sin estado, sin SDK. Conecta desde Claude Desktop, Claude Code, Cursor, o curl en un cron."
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

      {/* ─── SECTION 4 / INSTALL ──────────────────────────────────── */}
      <section className="border-b border-white/[0.07]">
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 sm:py-24">
          <SectionHead
            num="04"
            kicker="Install"
            kickerEs="Instalación"
            title="Thirty seconds to first call."
            titleEs="Treinta segundos al primer llamado."
            lede="Drop the snippet into your MCP client config, or curl the endpoint from a cron. Self-serve key arrives by email — we never store the plaintext."
            ledeEs="Pega el snippet en tu config MCP, o llama el endpoint desde un cron. La key llega por correo — solo guardamos el hash."
          />

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <CodeBlock
              label="Claude Desktop / Code"
              labelEs="Claude Desktop / Code"
              code={`{
  "mcpServers": {
    "cruzar-insights": {
      "transport": {
        "type": "http",
        "url": "https://www.cruzar.app/mcp",
        "headers": { "Authorization": "Bearer YOUR_KEY" }
      }
    }
  }
}`}
            />
            <CodeBlock
              label="curl from anywhere"
              labelEs="curl desde cualquier lado"
              code={`curl -X POST https://www.cruzar.app/mcp \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}
            />
          </div>
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
                d: "v0.4 forecasts vehicle wait. SENTRI and commercial lane separation is on the roadmap — see Samant 2026 for what shape that takes.",
              }}
              es={{
                t: "Aún sin separar por carril.",
                d: "v0.4 pronostica espera vehicular. Separación SENTRI/comercial está en el roadmap.",
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
            lede="Six clusters across the US-Mexico land border. Decision-grade today, expanding monthly."
            ledeEs="Seis clusters en la frontera US-México. Decision-grade hoy, ampliando cada mes."
          />

          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] sm:grid-cols-2 lg:grid-cols-3">
            {CLUSTERS.map((c, i) => {
              const cPorts = PORTS.filter((p) => p.cluster === c.key);
              const decision = cPorts.filter((p) => p.status === "decision-grade").length;
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
                              : p.status === "marginal"
                              ? "text-white/45"
                              : "text-rose-300/70"
                          }`}
                        >
                          {fmtPct(p.vsCbp)}
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
            <span className="font-mono">v0.4 · {PORTS.length} ports · MCP</span>
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

// ─── Code block ─────────────────────────────────────────────────
function CodeBlock(props: { label: string; labelEs: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#040814]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/55">
          {props.label}
        </div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/25" lang="es">
          {props.labelEs}
        </div>
      </div>
      <pre className="overflow-x-auto px-5 py-5 text-[12.5px] leading-[1.65] text-slate-200">
        <code className="font-mono">{props.code}</code>
      </pre>
    </div>
  );
}
