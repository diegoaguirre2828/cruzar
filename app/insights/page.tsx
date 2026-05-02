// Cruzar Insights B2B — sales page only.
//
// Editorial single-page sales surface targeted at RGV cross-border freight
// brokers / dispatchers / fleets. Verbatim hero language sourced from the
// 2026-05-01 RGV broker pain dossier (Uber Freight MX, Cargado CEO, ATRI 2024).
// Calibration scoreboard inline = the moat (nobody else publishes accuracy).
//
// NO "AI" / "model" / "MCP" / "Claude" anywhere on this surface.
// Per feedback_ai_as_infrastructure_not_product_20260430.md.
//
// Companion: /dispatch (the operator panel — config + watchlist + the actual
// product). /insights itself is marketing.

import { B2BNav } from '@/components/B2BNav';
import { InsightsHero } from '@/components/InsightsHero';
import { DetentionMathCard } from '@/components/DetentionMathCard';
import { CalibrationScoreboard } from '@/components/CalibrationScoreboard';
import { INSIGHTS_EN } from '@/lib/copy/insights-en';
import { INSIGHTS_ES } from '@/lib/copy/insights-es';
import { getPortMeta } from '@/lib/portMeta';
import manifest from '@/data/insights-manifest.json';

export const runtime = 'nodejs';
export const revalidate = 3600;

export const metadata = {
  title: 'Cruzar Insights — the 5am border read',
  description:
    "Per-port wait-time forecasts + calibration receipts. Morning email + anomaly push for RGV cross-border freight brokers. The border is the black hole — we pull your trucks out before it closes.",
  alternates: { canonical: 'https://www.cruzar.app/insights' },
};

interface ManifestModel {
  port_id: string;
  port_name: string;
  horizon_min: number;
  rmse_min: number | null;
  lift_vs_cbp_climatology_pct: number | null;
  lift_vs_self_climatology_pct?: number | null;
}

interface Manifest {
  model_version: string;
  saved_at: string;
  models: ManifestModel[];
}

function decisionGrade(m: Manifest): ManifestModel[] {
  return m.models
    .filter((r) => r.horizon_min === 360 && (r.lift_vs_cbp_climatology_pct ?? -999) >= 5)
    .sort(
      (a, b) =>
        (b.lift_vs_cbp_climatology_pct ?? 0) - (a.lift_vs_cbp_climatology_pct ?? 0),
    );
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang: 'en' | 'es' = params?.lang === 'es' ? 'es' : 'en';
  const c = lang === 'es' ? INSIGHTS_ES : INSIGHTS_EN;

  const m = manifest as Manifest;
  const dg = decisionGrade(m);
  const lifts = dg.map((p) => p.lift_vs_cbp_climatology_pct ?? 0).sort((a, b) => a - b);
  const medianLift = lifts.length > 0 ? lifts[Math.floor(lifts.length / 2)] : 0;
  const dgPortIds = dg.map((p) => p.port_id);

  const ldjson = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Cruzar Insights',
    description:
      'Border wait-time forecasting service for US-Mexico freight operations. Morning email + anomaly push + calibration receipts.',
    provider: { '@type': 'Organization', name: 'Cruzar' },
    areaServed: { '@type': 'Place', name: 'US-Mexico land border' },
    url: 'https://www.cruzar.app/insights',
  };

  return (
    <div className="min-h-screen bg-[#0a1020] text-slate-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldjson) }}
      />
      <B2BNav current="sales" lang={lang} />
      <InsightsHero lang={lang} decisionGradeCount={dg.length} medianLift={medianLift} />

      {/* Detention math anchor */}
      <section className="border-b border-white/[0.07] bg-[#0a1020]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <DetentionMathCard lang={lang} />
        </div>
      </section>

      {/* Calibration scoreboard — the moat */}
      <section id="scoreboard" className="border-b border-white/[0.07] bg-[#070b18]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <div className="mb-8">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300">
              {c.scoreboard.kicker}
            </div>
            <h2 className="font-serif text-[clamp(1.85rem,3.4vw,2.85rem)] font-medium text-white mt-2">
              {c.scoreboard.title}
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] text-white/65">{c.scoreboard.sub}</p>
          </div>
          <CalibrationScoreboard portIds={dgPortIds.length > 0 ? dgPortIds : undefined} lang={lang} />
          <div className="mt-4 text-[13px]">
            <a
              href="/insights/accuracy"
              className="text-amber-300 hover:text-amber-200 underline decoration-amber-300/40"
            >
              {lang === 'es'
                ? 'Ver el remojo en vivo + backtest completo →'
                : 'See the full live soak + backtest →'}
            </a>
          </div>
        </div>
      </section>

      {/* Delivery — how it shows up */}
      <section className="border-b border-white/[0.07]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <div className="mb-8">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300">
              {c.delivery.kicker}
            </div>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] sm:grid-cols-3">
            {[c.delivery.morning, c.delivery.anomaly, c.delivery.whatsapp].map((d, i) => (
              <div key={i} className="bg-[#0a1020] p-7">
                <h3 className="font-serif text-[1.4rem] font-medium leading-[1.15] text-white">
                  {d.title}
                </h3>
                <p className="mt-3 text-[13.5px] leading-[1.55] text-white/70">{d.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Decision-grade port list */}
      <section className="border-b border-white/[0.07] bg-[#070b18]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <div className="mb-8">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300">
              {lang === 'es' ? 'Puertos donde le ganamos a CBP' : 'Ports we beat CBP at'}
            </div>
          </div>
          {dg.length === 0 ? (
            <p className="text-[13px] text-white/40">
              {lang === 'es' ? 'Sin datos publicables todavía.' : 'No publishable data yet.'}
            </p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-[13px]">
              {dg.map((p) => {
                const meta = getPortMeta(p.port_id);
                return (
                  <li
                    key={p.port_id}
                    className="flex items-baseline justify-between border-b border-white/[0.05] pb-1.5"
                  >
                    <span className="text-white">{meta?.localName ?? p.port_name}</span>
                    <span className="font-mono tabular-nums text-amber-300">
                      +{(p.lift_vs_cbp_climatology_pct ?? 0).toFixed(1)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Pricing tiers */}
      <section className="border-b border-white/[0.07]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <div className="grid gap-3 sm:grid-cols-3">
            {[c.pricing.starter, c.pricing.pro, c.pricing.fleet].map((p) => (
              <div
                key={p.tier}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6"
              >
                <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300">
                  {p.tier}
                </div>
                <div className="font-serif text-[28px] text-white mt-2">{p.price}</div>
                <p className="mt-2 text-[13px] text-white/65">{p.summary}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href="mailto:diegonaguirre@icloud.com?subject=Cruzar%20Insights%20trial"
              className="inline-flex items-center gap-3 rounded-2xl bg-amber-400 px-6 py-3.5 text-[14px] font-semibold text-[#0a1020] transition hover:bg-amber-300"
            >
              <span>{c.cta.primary}</span>
              <span aria-hidden>→</span>
            </a>
            <a
              href="/dispatch"
              className="text-[14px] text-white/55 transition hover:text-amber-300"
            >
              {lang === 'es' ? 'Abre la consola →' : 'Open the console →'}
            </a>
          </div>
        </div>
      </section>

      <footer className="bg-[#070b18]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-10 text-[12px] text-white/40">
          {c.notAffiliated} ·{' '}
          <a href="?lang=en" className="hover:text-amber-300">
            EN
          </a>{' '}
          ·{' '}
          <a href="?lang=es" className="hover:text-amber-300">
            ES
          </a>{' '}
          · {(manifest as Manifest).model_version}
        </div>
      </footer>
    </div>
  );
}
