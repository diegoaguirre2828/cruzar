'use client';

import { useEffect, useState } from 'react';
import { TIER_LIMITS, type InsightsTier } from '@/lib/insights/stripe-tiers';

interface Subscriber {
  id: number;
  tier: InsightsTier;
  status: string;
  watched_port_ids: string[];
  briefing_enabled: boolean;
  briefing_local_hour: number;
  briefing_tz: string;
  language: 'en' | 'es';
  channel_email: boolean;
  channel_sms: boolean;
  channel_whatsapp: boolean;
  recipient_emails: string[];
  recipient_phones: string[];
}

export default function AccountPage() {
  const [sub, setSub] = useState<Subscriber | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/insights/preferences')
      .then((r) => r.json())
      .then((d) => {
        setSub(d.subscriber);
        setLoading(false);
      });
  }, []);

  async function save(patch: Partial<Subscriber>) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/insights/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? 'save_failed');
        return;
      }
      setSub(data.subscriber);
      setMsg('Saved.');
    } finally {
      setSaving(false);
    }
  }

  async function openPortal() {
    const res = await fetch('/api/insights/portal', { method: 'POST' });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  if (loading) return <main className="p-8 text-white/60">Loading…</main>;
  if (!sub)
    return (
      <main className="mx-auto max-w-[860px] px-5 sm:px-8 py-12">
        <h1 className="font-serif text-[28px] text-white mb-3">No active Insights subscription</h1>
        <p className="text-white/60 mb-6">
          Pick a plan on /insights or talk to Diego/Raul to start a trial.
        </p>
        <a
          href="/insights"
          className="inline-block rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-[#0a1020]"
        >
          See plans →
        </a>
      </main>
    );

  const limits = TIER_LIMITS[sub.tier];

  return (
      <main className="mx-auto max-w-[860px] px-5 sm:px-8 py-10">
        <h1 className="font-serif text-[28px] text-white mb-1">Insights account</h1>
        <p className="text-white/55 mb-8">
          {sub.tier.toUpperCase()} · {sub.status} · ${limits.monthlyUsd}/mo
        </p>

        <Section title="Briefing">
          <Toggle
            label="Enabled"
            checked={sub.briefing_enabled}
            onChange={(v) => save({ briefing_enabled: v })}
            disabled={saving}
          />
          <NumberField
            label="Local hour (0–23)"
            value={sub.briefing_local_hour}
            onChange={(v) => save({ briefing_local_hour: v })}
          />
          <TextField
            label="Timezone (IANA)"
            value={sub.briefing_tz}
            onChange={(v) => save({ briefing_tz: v })}
          />
          <SelectField
            label="Language"
            value={sub.language}
            options={[
              { v: 'en', l: 'English' },
              { v: 'es', l: 'Español' },
            ]}
            onChange={(v) => save({ language: v as 'en' | 'es' })}
          />
        </Section>

        <Section title="Channels">
          <Toggle
            label="Email"
            checked={sub.channel_email}
            onChange={(v) => save({ channel_email: v })}
            disabled={saving}
          />
          <Toggle
            label="SMS"
            checked={sub.channel_sms}
            onChange={(v) => save({ channel_sms: v })}
            disabled={saving || !limits.channels.sms}
          />
          <Toggle
            label="WhatsApp"
            checked={sub.channel_whatsapp}
            onChange={(v) => save({ channel_whatsapp: v })}
            disabled={saving || !limits.channels.whatsapp}
          />
        </Section>

        <Section title="Recipients">
          <ListField
            label={`Emails (max ${limits.maxRecipientEmails})`}
            values={sub.recipient_emails}
            onChange={(v) => save({ recipient_emails: v })}
            max={limits.maxRecipientEmails}
          />
          <ListField
            label={`Phones E.164 (max ${limits.maxRecipientPhones})`}
            values={sub.recipient_phones}
            onChange={(v) => save({ recipient_phones: v })}
            max={limits.maxRecipientPhones}
          />
        </Section>

        <Section title="Watched ports">
          <ListField
            label={`Port IDs (max ${limits.maxWatchedPorts})`}
            values={sub.watched_port_ids}
            onChange={(v) => save({ watched_port_ids: v })}
            max={limits.maxWatchedPorts}
          />
        </Section>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          {sub.tier !== 'free' && (
            <button
              onClick={openPortal}
              className="rounded-xl bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.12] px-4 py-2 text-[13px] text-white"
            >
              Manage billing →
            </button>
          )}
          {msg && <span className="text-[12px] text-white/55">{msg}</span>}
        </div>
      </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <h2 className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300 mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-4 text-[13px]">
      <span className={disabled ? 'text-white/30' : 'text-white/80'}>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <label className="flex items-center justify-between gap-4 text-[13px]">
      <span className="text-white/80">{label}</span>
      <input
        type="number"
        min={0}
        max={23}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onChange(Number(v))}
        className="w-20 rounded border border-white/[0.10] bg-[#040814] px-2 py-1 text-white text-right"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="flex items-center justify-between gap-4 text-[13px]">
      <span className="text-white/80">{label}</span>
      <input
        type="text"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onChange(v)}
        className="w-56 rounded border border-white/[0.10] bg-[#040814] px-2 py-1 text-white"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { v: string; l: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 text-[13px]">
      <span className="text-white/80">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-white/[0.10] bg-[#040814] px-2 py-1 text-white"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}

function ListField({
  label,
  values,
  onChange,
  max,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  max: number;
}) {
  const [draft, setDraft] = useState('');
  return (
    <div className="text-[13px]">
      <div className="text-white/80 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full border border-white/[0.10] bg-white/[0.04] px-2.5 py-0.5 text-[12px] text-white/85"
          >
            {v}
            <button
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-white/40 hover:text-rose-300"
              aria-label="Remove"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add…"
          className="flex-1 rounded border border-white/[0.10] bg-[#040814] px-2 py-1 text-white"
        />
        <button
          onClick={() => {
            if (!draft) return;
            if (values.includes(draft)) return;
            if (values.length >= max) return;
            onChange([...values, draft]);
            setDraft('');
          }}
          className="rounded bg-amber-400 text-[#0a1020] font-semibold px-3 py-1 text-[12px]"
        >
          Add
        </button>
      </div>
    </div>
  );
}
