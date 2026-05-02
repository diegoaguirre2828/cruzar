import { INSIGHTS_EN } from '@/lib/copy/insights-en';
import { INSIGHTS_ES } from '@/lib/copy/insights-es';

export function InsightsHero({
  lang = 'en',
  decisionGradeCount,
  medianLift,
}: {
  lang?: 'en' | 'es';
  decisionGradeCount: number;
  medianLift: number;
}) {
  const c = lang === 'es' ? INSIGHTS_ES : INSIGHTS_EN;
  return (
    <header className="bg-gradient-to-b from-[#070b18] via-[#0a1020] to-[#0a1020] border-b border-white/[0.07]">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-12 sm:py-20">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/45 mb-6">
          {c.eyebrow}
        </div>
        <h1 className="font-serif text-[clamp(2.2rem,5.6vw,4.4rem)] font-medium leading-[1.02] tracking-[-0.02em] text-white">
          {c.headline.line1} <span className="text-amber-400">{c.headline.accent}</span>
          <br />
          <span className="text-white/85">{c.headline.sub}</span>
        </h1>
        <p className="mt-7 max-w-2xl text-[16px] leading-[1.55] text-white/70">{c.subhead}</p>
        <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8 border-y border-white/[0.07] py-7 sm:grid-cols-3">
          <div>
            <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">
              {lang === 'es' ? 'Puertos decision-grade' : 'Decision-grade ports'}
            </dt>
            <dd className="mt-2 font-mono text-[2.2rem] leading-none tracking-tight text-amber-400">
              {decisionGradeCount}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">
              {lang === 'es' ? 'Mediana de mejora vs CBP' : 'Median lift vs CBP'}
            </dt>
            <dd className="mt-2 font-mono text-[2.2rem] leading-none tracking-tight text-white">
              +{medianLift.toFixed(1)}%
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">
              {lang === 'es' ? 'Entrega' : 'Delivery'}
            </dt>
            <dd className="mt-2 font-mono text-[2.2rem] leading-none tracking-tight text-white">
              {lang === 'es' ? 'Correo · SMS' : 'Email · SMS'}
            </dd>
            <dd className="mt-1.5 text-[12px] text-white/45">
              {lang === 'es' ? '+ WhatsApp en cuanto Meta libere' : '+ WhatsApp once Meta unblocks'}
            </dd>
          </div>
        </dl>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
          <a
            href="mailto:diegonaguirre@icloud.com?subject=Cruzar%20Insights%20trial"
            className="inline-flex items-center gap-3 rounded-2xl bg-amber-400 px-6 py-3.5 text-[14px] font-semibold text-[#0a1020] transition hover:bg-amber-300"
          >
            <span>{c.cta.primary}</span>
            <span aria-hidden>→</span>
          </a>
          <a
            href="#scoreboard"
            className="text-[14px] font-medium text-white/70 underline decoration-white/30 underline-offset-[5px] hover:text-amber-300"
          >
            {c.cta.secondary}
          </a>
        </div>
      </div>
    </header>
  );
}
