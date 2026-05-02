import { INSIGHTS_EN } from '@/lib/copy/insights-en';
import { INSIGHTS_ES } from '@/lib/copy/insights-es';

export function DetentionMathCard({ lang = 'en' }: { lang?: 'en' | 'es' }) {
  const c = lang === 'es' ? INSIGHTS_ES.detentionMath : INSIGHTS_EN.detentionMath;
  return (
    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-6 sm:p-7">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300 mb-3">
        {c.title}
      </div>
      <p className="text-[15px] leading-[1.55] text-white/85">{c.body}</p>
      <p className="mt-3 text-[12px] leading-[1.55] text-white/45">{c.footnote}</p>
    </div>
  );
}
