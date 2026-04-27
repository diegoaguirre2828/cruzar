'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Rule {
  id: string
  load_id: string | null
  trigger_kind: string
  threshold_value: number
  channel: string
  cooldown_minutes: number
  active: boolean
  last_fired_at: string | null
  created_at: string
}

interface Dispatch {
  id: string
  rule_id: string
  load_id: string | null
  fired_at: string
  channel: string
  delivered: boolean
  delivery_error: string | null
  payload: { load_ref?: string; trigger_kind?: string; observed?: number; text_es?: string }
}

interface Load {
  id: string
  load_ref: string
  recommended_port_id: string | null
  appointment_at: string
  status: string
}

const TRIGGER_OPTIONS: { value: string; label: string; defaultThreshold: number; unit: string }[] = [
  { value: 'wait_threshold', label: 'Wait at recommended bridge >', defaultThreshold: 90, unit: 'min' },
  { value: 'p_make_appt_below', label: 'P(make appointment) <', defaultThreshold: 0.7, unit: '0–1' },
  { value: 'detention_dollars_above', label: 'Detention exposure >', defaultThreshold: 100, unit: 'USD' },
  { value: 'anomaly_at_recommended', label: 'Anomaly at recommended port', defaultThreshold: 1, unit: '(no value)' },
  { value: 'eta_slip_minutes', label: 'ETA slip >', defaultThreshold: 30, unit: 'min vs prior' },
]

const CHANNELS: { value: string; label: string; note?: string }[] = [
  { value: 'push', label: 'Web push' },
  { value: 'email', label: 'Email' },
  { value: 'mcp_log', label: 'MCP log only', note: 'For AI workflows' },
  { value: 'sms', label: 'SMS', note: 'Pending Twilio 10DLC' },
]

export default function AlertsPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [dispatches, setDispatches] = useState<Dispatch[]>([])
  const [loads, setLoads] = useState<Load[]>([])
  const [trigger, setTrigger] = useState('wait_threshold')
  const [threshold, setThreshold] = useState(90)
  const [channel, setChannel] = useState('push')
  const [loadId, setLoadId] = useState<string>('')
  const [cooldown, setCooldown] = useState(30)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadAll() {
    const [r, d, l] = await Promise.all([
      fetch('/api/insights/alerts').then((res) => res.json()),
      fetch('/api/insights/alerts/dispatches').then((res) => res.json()).catch(() => ({ dispatches: [] })),
      fetch('/api/insights/loads').then((res) => res.json()).catch(() => ({ loads: [] })),
    ])
    setRules(r.rules ?? [])
    setDispatches(d.dispatches ?? [])
    setLoads(l.loads ?? [])
  }

  useEffect(() => { loadAll() }, [])

  async function createRule() {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/insights/alerts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          load_id: loadId || null,
          trigger_kind: trigger,
          threshold_value: threshold,
          channel,
          cooldown_minutes: cooldown,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'failed')
      await loadAll()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(r: Rule) {
    await fetch(`/api/insights/alerts/${r.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: !r.active }),
    })
    await loadAll()
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this alert rule?')) return
    await fetch(`/api/insights/alerts/${id}`, { method: 'DELETE' })
    await loadAll()
  }

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Operator alerts</h1>
            <p className="text-sm text-zinc-500 mt-1">Threshold + anomaly triggers across your tracked loads.</p>
          </div>
          <Link href="/insights/loads" className="text-sm font-medium text-blue-600 hover:underline">← Loads</Link>
        </div>

        {/* Create form */}
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 mb-8 shadow-sm">
          <h2 className="text-sm font-semibold mb-3">New alert rule</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Trigger</label>
              <select
                value={trigger}
                onChange={(e) => {
                  setTrigger(e.target.value)
                  const t = TRIGGER_OPTIONS.find((x) => x.value === e.target.value)
                  if (t) setThreshold(t.defaultThreshold)
                }}
                className="w-full text-sm rounded-lg bg-stone-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2"
              >
                {TRIGGER_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Threshold ({TRIGGER_OPTIONS.find((t) => t.value === trigger)?.unit})
              </label>
              <input
                type="number"
                step="any"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value || '0'))}
                disabled={trigger === 'anomaly_at_recommended'}
                className="w-full text-sm rounded-lg bg-stone-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Channel</label>
              <select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-full text-sm rounded-lg bg-stone-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2">
                {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}{c.note ? ` (${c.note})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Apply to</label>
              <select value={loadId} onChange={(e) => setLoadId(e.target.value)} className="w-full text-sm rounded-lg bg-stone-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2">
                <option value="">All my tracked loads</option>
                {loads.map((l) => <option key={l.id} value={l.id}>{l.load_ref} → {l.recommended_port_id ?? '?'}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Cooldown (min)</label>
              <input
                type="number"
                value={cooldown}
                onChange={(e) => setCooldown(parseInt(e.target.value || '30', 10))}
                className="w-full text-sm rounded-lg bg-stone-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={createRule}
                disabled={busy}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
              >
                {busy ? 'Adding…' : 'Add rule'}
              </button>
            </div>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </section>

        {/* Active rules */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-3">Active rules</h2>
          {rules.length === 0 ? (
            <p className="text-sm text-zinc-500">No rules yet — add your first above.</p>
          ) : (
            <ul className="space-y-2">
              {rules.map((r) => (
                <li key={r.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex items-center justify-between text-sm">
                  <div className="flex-1">
                    <div className="font-medium">
                      {TRIGGER_OPTIONS.find((t) => t.value === r.trigger_kind)?.label || r.trigger_kind}
                      {r.trigger_kind !== 'anomaly_at_recommended' && <span className="text-zinc-500"> {r.threshold_value}</span>}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {r.channel} · cooldown {r.cooldown_minutes}min · {r.load_id ? `load ${r.load_id.slice(0, 8)}` : 'all loads'}
                      {r.last_fired_at && ` · last fired ${new Date(r.last_fired_at).toLocaleString()}`}
                    </div>
                  </div>
                  <button onClick={() => toggleActive(r)} className={`text-xs px-2 py-1 rounded font-medium ${r.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                    {r.active ? 'Active' : 'Paused'}
                  </button>
                  <button onClick={() => deleteRule(r.id)} className="ml-2 text-xs text-red-500 hover:underline">Delete</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent dispatches */}
        <section>
          <h2 className="text-sm font-semibold mb-3">Recent dispatches</h2>
          {dispatches.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing fired yet.</p>
          ) : (
            <ul className="space-y-2">
              {dispatches.slice(0, 25).map((d) => (
                <li key={d.id} className={`border rounded-xl p-3 text-sm ${d.delivered ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{d.payload.text_es || `${d.payload.trigger_kind} on ${d.payload.load_ref}`}</span>
                    <span className="text-xs text-zinc-500">{new Date(d.fired_at).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {d.channel} · {d.delivered ? 'delivered' : `failed: ${d.delivery_error || 'unknown'}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
