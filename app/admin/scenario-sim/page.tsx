'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PersonaPanelDisplay, type PanelResult } from '@/components/PersonaPanelDisplay'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

type Lang = 'en' | 'es'
type Confidence = 'high' | 'moderate' | 'low'

interface Alt {
  port_id: string
  port_label: string
  delta_vs_baseline_minutes: number
  note: string
}

interface SimResult {
  scenario: string
  generated_at: string
  lang: Lang
  primary_recommendation: {
    port_id: string
    port_label: string
    delta_vs_baseline_minutes: number
    reasoning: string
    confidence: Confidence
  }
  alternatives: Alt[]
  cascade_predictions: string[]
  transcript: {
    panelists: string[]
    excerpts: { speaker: string; line: string }[]
  }
  caveats: string[]
  is_simulation: true
  panel?: PanelResult | null
}

const SAMPLE_SCENARIOS = [
  'Pharr-Reynosa closes 4 hours Friday 6am due to inspection backlog',
  'Holy Week Thursday afternoon — tourism surge expected at all RGV bridges',
  'Laredo World Trade Bridge SENTRI lane down for system maintenance',
  'Heavy rain forecast at Brownsville-Matamoros 2pm-6pm Tuesday',
]

function fmtDelta(min: number): string {
  const sign = min >= 0 ? '+' : ''
  const hours = (min / 60).toFixed(1)
  return `${sign}${min} min (${sign}${hours}h)`
}

function deltaTone(min: number): string {
  if (min >= 60) return 'text-rose-400'
  if (min >= 20) return 'text-amber-400'
  if (min <= -20) return 'text-emerald-400'
  return 'text-white/60'
}

export default function ScenarioSimPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [scenario, setScenario] = useState('')
  const [lang, setLang] = useState<Lang>('en')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SimResult | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!loading && (!user || user.email !== ADMIN_EMAIL)) router.push('/')
  }, [user, loading, router])

  async function run() {
    const trimmed = scenario.trim()
    if (!trimmed || running) return
    setRunning(true)
    setError(null)
    setResult(null)
    setCopied(false)
    try {
      const res = await fetch('/api/insights/scenario-sim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: trimmed, lang }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}: ${data.message ?? ''}`)
        return
      }
      setResult(data as SimResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }

  function copyMarkdown() {
    if (!result) return
    const md = renderMarkdown(result)
    navigator.clipboard.writeText(md).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function reset() {
    setScenario('')
    setResult(null)
    setError(null)
    setCopied(false)
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      run()
    }
  }

  if (loading || !user || user.email !== ADMIN_EMAIL) return null

  return (
    <main className="min-h-screen bg-[#0a1020] text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex items-baseline justify-between">
          <div>
            <h1 className="font-serif text-2xl font-medium text-white">Scenario Sim</h1>
            <p className="mt-1 text-xs text-white/55">
              Dispatcher decision support · always SIMULATION · Haiku-backed · bilingual
            </p>
          </div>
          <Link href="/admin" className="text-xs text-white/45 hover:text-amber-300">
            ← Admin
          </Link>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
          <label className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-white/55">
            Scenario
          </label>
          <textarea
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            onKeyDown={handleKey}
            placeholder="e.g., Pharr-Reynosa closes 4 hours Friday 6am due to inspection backlog"
            rows={4}
            autoFocus
            className="w-full rounded-xl border border-white/[0.08] bg-[#040814] px-3 py-2.5 font-mono text-sm leading-relaxed text-white placeholder:text-white/25 focus:border-amber-400/40 focus:outline-none"
          />

          <div className="mt-2 flex flex-wrap gap-1.5">
            {SAMPLE_SCENARIOS.map((s) => (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[11px] text-white/55 hover:border-amber-400/40 hover:text-amber-300"
              >
                {s.length > 48 ? s.slice(0, 45) + '…' : s}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-white/45">Lang:</span>
              {(['en', 'es'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`rounded-lg px-2 py-1 font-mono ${
                    lang === l
                      ? 'bg-amber-400 text-[#0a1020]'
                      : 'bg-white/[0.04] text-white/55 hover:text-white'
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
              <span className="ml-3 text-white/35">
                <kbd className="rounded bg-white/[0.06] px-1 text-[10px]">Ctrl+Enter</kbd> run
              </span>
            </div>
            <div className="flex gap-2">
              {(scenario || result) && (
                <button
                  onClick={reset}
                  className="rounded-xl px-3 py-1.5 text-xs text-white/55 hover:text-white"
                >
                  Clear
                </button>
              )}
              <button
                onClick={run}
                disabled={!scenario.trim() || running}
                className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-[#0a1020] hover:bg-amber-300 disabled:opacity-40"
              >
                {running ? 'Simulating…' : 'Run sim'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
            ✗ {error}
          </div>
        )}

        {result && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400">
                SIMULATION · is_simulation: true
              </div>
              <button
                onClick={copyMarkdown}
                className={`rounded-lg px-3 py-1 text-xs font-bold ${
                  copied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.1]'
                }`}
              >
                {copied ? '✓ Copied markdown' : 'Copy markdown'}
              </button>
            </div>

            <div className="rounded-2xl border-l-2 border-amber-400 bg-white/[0.02] p-5">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                Primary recommendation
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <div className="text-lg font-medium text-white">{result.primary_recommendation.port_label}</div>
                <div
                  className={`font-mono text-base tabular-nums ${deltaTone(
                    result.primary_recommendation.delta_vs_baseline_minutes,
                  )}`}
                >
                  {fmtDelta(result.primary_recommendation.delta_vs_baseline_minutes)}
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/75">
                {result.primary_recommendation.reasoning}
              </p>
              <div className="mt-2 flex items-center gap-2 text-[11px]">
                <span className="text-white/45">Confidence:</span>
                <span
                  className={`font-mono uppercase ${
                    result.primary_recommendation.confidence === 'high'
                      ? 'text-emerald-400'
                      : result.primary_recommendation.confidence === 'moderate'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                  }`}
                >
                  {result.primary_recommendation.confidence}
                </span>
                <span className="ml-2 font-mono text-white/35">
                  port_id={result.primary_recommendation.port_id}
                </span>
              </div>
            </div>

            {result.alternatives.length > 0 && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                <div className="border-b border-white/[0.06] px-5 py-3 text-[10px] uppercase tracking-[0.2em] text-white/55">
                  Alternatives
                </div>
                <ul className="divide-y divide-white/[0.05]">
                  {result.alternatives.map((a, i) => (
                    <li key={i} className="grid grid-cols-[1fr_auto] items-baseline gap-3 px-5 py-3.5">
                      <div>
                        <div className="text-sm font-medium text-white">{a.port_label}</div>
                        <p className="mt-1 text-xs leading-relaxed text-white/55">{a.note}</p>
                        <div className="mt-1 font-mono text-[10px] text-white/30">port_id={a.port_id}</div>
                      </div>
                      <div
                        className={`font-mono text-sm tabular-nums ${deltaTone(a.delta_vs_baseline_minutes)}`}
                      >
                        {fmtDelta(a.delta_vs_baseline_minutes)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.cascade_predictions.length > 0 && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/55">
                  Cascade predictions
                </div>
                <ul className="mt-3 space-y-2">
                  {result.cascade_predictions.map((c, i) => (
                    <li key={i} className="flex items-baseline gap-3 text-sm leading-relaxed text-white/75">
                      <span className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-amber-400" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
              <div className="flex items-baseline justify-between">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/55">
                  Panel transcript
                </div>
                <div className="font-mono text-[10px] text-white/35">
                  {result.transcript.panelists.join(' · ')}
                </div>
              </div>
              <div className="mt-3 space-y-2.5">
                {result.transcript.excerpts.map((e, i) => (
                  <div key={i} className="grid grid-cols-[110px_1fr] gap-3 text-sm">
                    <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-amber-300/80">
                      {e.speaker}
                    </div>
                    <div className="leading-relaxed text-white/80">{e.line}</div>
                  </div>
                ))}
              </div>
            </div>

            {result.panel && (
              <div className="rounded-2xl border border-amber-400/20 bg-white/[0.02] p-5">
                <div className="mb-3 flex items-baseline justify-between">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400">
                    3-persona pre-execution review · MiroFish
                  </div>
                  <div className="font-mono text-[10px] text-white/35">
                    Driver · Dispatcher · Receiver Ops
                  </div>
                </div>
                <PersonaPanelDisplay result={result.panel} />
              </div>
            )}

            {result.caveats.length > 0 && (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-950/10 p-5">
                <div className="text-[10px] uppercase tracking-[0.2em] text-rose-300/80">
                  Caveats
                </div>
                <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-white/65">
                  {result.caveats.map((c, i) => (
                    <li key={i}>· {c}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-[10px] text-white/30">
              Generated {new Date(result.generated_at).toLocaleString()} · lang={result.lang}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function renderMarkdown(r: SimResult): string {
  const lines: string[] = []
  lines.push(`# Scenario Sim — ${r.scenario}`)
  lines.push('')
  lines.push(`> **SIMULATION** · generated ${r.generated_at} · lang=${r.lang}`)
  lines.push('')
  lines.push('## Primary recommendation')
  lines.push(
    `**${r.primary_recommendation.port_label}** — ${fmtDelta(r.primary_recommendation.delta_vs_baseline_minutes)}  `,
  )
  lines.push(`Confidence: ${r.primary_recommendation.confidence}  `)
  lines.push(r.primary_recommendation.reasoning)
  lines.push('')
  if (r.alternatives.length) {
    lines.push('## Alternatives')
    for (const a of r.alternatives) {
      lines.push(`- **${a.port_label}** ${fmtDelta(a.delta_vs_baseline_minutes)} — ${a.note}`)
    }
    lines.push('')
  }
  if (r.cascade_predictions.length) {
    lines.push('## Cascade predictions')
    for (const c of r.cascade_predictions) lines.push(`- ${c}`)
    lines.push('')
  }
  lines.push('## Panel transcript')
  lines.push(`_${r.transcript.panelists.join(' · ')}_`)
  lines.push('')
  for (const e of r.transcript.excerpts) {
    lines.push(`**${e.speaker}:** ${e.line}`)
    lines.push('')
  }
  lines.push('## Caveats')
  for (const c of r.caveats) lines.push(`- ${c}`)
  return lines.join('\n')
}
