'use client';

interface Props {
  channels: { email: boolean; sms: boolean; whatsapp: boolean };
  lastFiredAt: string | null;
  lang?: 'en' | 'es';
}

export function AlertsRail({ channels, lastFiredAt, lang = 'en' }: Props) {
  const es = lang === 'es';
  const last = lastFiredAt
    ? new Date(lastFiredAt).toLocaleString(es ? 'es-MX' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;
  const Pill = ({ on, label }: { on: boolean; label: string }) => (
    <span
      className={`text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full ${
        on
          ? 'bg-amber-300/15 text-amber-200 border border-amber-300/30'
          : 'bg-white/[0.04] text-white/30 border border-white/[0.08]'
      }`}
    >
      {label}
    </span>
  );
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <Pill on={channels.email} label="Email" />
      <Pill on={channels.sms} label="SMS" />
      <Pill on={channels.whatsapp} label="WA" />
      {last && (
        <span className="text-white/35 ml-1">
          {es ? 'último' : 'last'} {last}
        </span>
      )}
    </div>
  );
}
