'use client';

interface Props {
  watchedCount: number;
  anomalyCount: number;
  accuracyPct: number | null;
  briefingTimeLabel: string | null;
  recipientLabel: string | null;
  lang?: 'en' | 'es';
}

export function DispatchHero({
  watchedCount,
  anomalyCount,
  accuracyPct,
  briefingTimeLabel,
  recipientLabel,
  lang = 'en',
}: Props) {
  const es = lang === 'es';
  return (
    <div className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-amber-300">
            {es ? 'Vigilando' : 'Watching'}
          </div>
          <div className="font-mono text-[24px] tabular-nums text-white mt-1">{watchedCount}</div>
          <div className="text-[11px] text-white/40">{es ? 'puertos' : 'ports'}</div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-amber-300">
            {es ? 'Anomalías ahora' : 'Anomalies firing now'}
          </div>
          <div
            className={`font-mono text-[24px] tabular-nums mt-1 ${
              anomalyCount > 0 ? 'text-rose-300' : 'text-white/85'
            }`}
          >
            {anomalyCount}
          </div>
          <div className="text-[11px] text-white/40">≥ 1.5× baseline</div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-amber-300">
            {es ? 'Precisión 30d' : '30-day accuracy'}
          </div>
          <div className="font-mono text-[24px] tabular-nums text-white mt-1">
            {accuracyPct != null ? `${accuracyPct}%` : '—'}
          </div>
          <div className="text-[11px] text-white/40">{es ? 'tus puertos' : 'on YOUR ports'}</div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-amber-300">
            {es ? 'Próximo briefing' : 'Next briefing'}
          </div>
          <div className="font-mono text-[15px] tabular-nums text-white mt-1">
            {briefingTimeLabel ?? '—'}
          </div>
          <div className="text-[11px] text-white/40 truncate">
            {recipientLabel ?? (es ? 'sin destinatarios' : 'no recipients')}
          </div>
        </div>
      </div>
    </div>
  );
}
