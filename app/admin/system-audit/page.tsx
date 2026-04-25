'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { LangToggle } from '@/components/LangToggle'

interface Subsystem {
  key: string
  name: string
  status: 'ok' | 'warn' | 'err'
  lastActivity: string
  detail: string
}

interface Health {
  overall: 'ok' | 'warn' | 'err'
  subsystems: Subsystem[]
  sources: { freshness: Record<string, { lastIngested: string | null; status: 'ok' | 'warn' | 'err' }> }
  stripe: { priceIds: Record<string, boolean> }
  infra: { env: Record<string, boolean> }
  aggregate: {
    profilesTotal: number
    operatorMRR: number
    businessMRR: number
    intelMRR: number
    expressLifetime: number
  }
  generatedAt: string
}

const STATUS_STYLES: Record<string, { icon: React.ReactNode; bg: string; ring: string; text: string; label: string }> = {
  ok:   { icon: <CheckCircle2 className="w-4 h-4" />, bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/30', text: 'text-emerald-400', label: 'OK' },
  warn: { icon: <AlertTriangle className="w-4 h-4" />, bg: 'bg-amber-500/10',   ring: 'ring-amber-500/30',   text: 'text-amber-400',   label: 'WARN' },
  err:  { icon: <XCircle className="w-4 h-4" />,        bg: 'bg-red-500/10',     ring: 'ring-red-500/30',     text: 'text-red-400',     label: 'ERR' },
}

export default function SystemAuditPage() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/system-health', { cache: 'no-store' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || `${res.status}`)
      } else {
        setHealth(await res.json())
      }
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 60_000) // auto-refresh every minute
    return () => clearInterval(id)
  }, [refresh])

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-sm text-red-400">{error}</div>
      </main>
    )
  }
  if (!health) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-slate-300 rounded-full animate-spin" />
      </main>
    )
  }

  const overall = STATUS_STYLES[health.overall]

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <div className="pt-6 pb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700">
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </Link>
            <h1 className="text-xl font-bold text-slate-100">System Audit</h1>
          </div>
          <div className="flex items-center gap-2">
            <LangToggle />
            <button
              onClick={refresh}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Overall status banner */}
        <div className={`rounded-2xl p-5 mb-4 ring-1 ${overall.bg} ${overall.ring}`}>
          <div className="flex items-center gap-3">
            <div className={overall.text}>{overall.icon}</div>
            <div>
              <p className={`text-xs uppercase tracking-wider font-bold ${overall.text}`}>{overall.label}</p>
              <p className="text-lg font-bold text-slate-100">
                {health.overall === 'ok' ? 'All subsystems operating normally' :
                 health.overall === 'warn' ? 'One or more subsystems need attention' :
                 'A subsystem has failed — fix before pitching'}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                Auto-refreshes every 60s · last check {new Date(health.generatedAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>

        {/* Aggregate revenue / size */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Profiles', value: health.aggregate.profilesTotal.toLocaleString() },
            { label: 'Operator MRR', value: `$${health.aggregate.operatorMRR.toLocaleString()}` },
            { label: 'Business MRR', value: `$${health.aggregate.businessMRR.toLocaleString()}` },
            { label: 'Intel MRR', value: `$${health.aggregate.intelMRR.toLocaleString()}` },
          ].map((c, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <p className="text-[10px] uppercase font-semibold text-slate-500 mb-1">{c.label}</p>
              <p className="text-lg font-bold text-slate-100 tabular-nums">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Subsystems */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800 mb-4">
          {health.subsystems.map((s) => {
            const st = STATUS_STYLES[s.status]
            return (
              <div key={s.key} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className={`${st.text} mt-0.5 flex-shrink-0`}>{st.icon}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-100">{s.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{s.detail}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${st.bg} ${st.text}`}>{st.label}</span>
                    <p className="text-[10px] text-slate-500 mt-1">{s.lastActivity}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Intel sources freshness */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
          <p className="text-xs font-bold text-slate-100 mb-2">Intelligence sources</p>
          <div className="space-y-1.5">
            {Object.entries(health.sources.freshness).map(([id, src]) => {
              const st = STATUS_STYLES[src.status]
              return (
                <div key={id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`${st.text}`}><span className="text-[10px]">●</span></div>
                    <span className="font-mono text-slate-300 truncate">{id}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 flex-shrink-0">
                    {src.lastIngested ? new Date(src.lastIngested).toISOString().slice(5, 16).replace('T', ' ') : 'never'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Stripe price IDs */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
          <p className="text-xs font-bold text-slate-100 mb-2">Stripe price IDs (env)</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(health.stripe.priceIds).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-xs">
                <span className="font-mono text-slate-400">{k}</span>
                <span className={v ? 'text-emerald-400' : 'text-red-400'}>{v ? '✓' : '✗ MISSING'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Infra env */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-xs font-bold text-slate-100 mb-2">Critical infra env vars</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(health.infra.env).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-xs">
                <span className="font-mono text-slate-400">{k}</span>
                <span className={v ? 'text-emerald-400' : 'text-red-400'}>{v ? '✓' : '✗ MISSING'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href="/admin/operator" className="text-center text-xs font-semibold text-slate-400 hover:text-slate-200 px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
            → Operator details
          </Link>
          <Link href="/intelligence/dashboard" className="text-center text-xs font-semibold text-slate-400 hover:text-slate-200 px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
            → Intelligence dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
