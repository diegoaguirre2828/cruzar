'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileCheck, AlertTriangle, ShieldCheck, DollarSign, Activity, Clock } from 'lucide-react'

interface Stats {
  subscriptions: {
    operatorActive: number
    businessActive: number
    operatorMRR: number
    businessMRR: number
  }
  validations: {
    total: number
    last24h: number
    last7d: number
    avgMsPerRun: number | null
  }
  breakdown7d: {
    byKind: Record<string, number>
    bySeverity: Record<string, number>
  }
  expressCert: {
    draft: number
    paid: number
    generated: number
    lifetimeRevenue: number
  }
  generatedAt: string
}

const KIND_LABELS: Record<string, string> = {
  pedimento: 'Pedimento',
  commercial_invoice: 'Commercial invoice',
  usmca_cert: 'USMCA cert',
  packing_list: 'Packing list',
  bill_of_lading: 'BOL',
  other: 'Other',
}

const SEV_COLORS: Record<string, string> = {
  clean: 'text-emerald-600',
  minor: 'text-amber-600',
  blocker: 'text-red-600',
  unknown: 'text-gray-400',
}

export default function OperatorAdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/operator-stats').then(async (r) => {
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.error || `${r.status}`)
        return
      }
      setStats(await r.json())
    })
  }, [])

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-sm text-red-500">Error: {error}</div>
      </main>
    )
  }

  if (!stats) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </main>
    )
  }

  const totalSeverity = Object.values(stats.breakdown7d.bySeverity).reduce((a, b) => a + b, 0) || 1
  const totalKind = Object.values(stats.breakdown7d.byKind).reduce((a, b) => a + b, 0) || 1

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 pb-16">
        <div className="pt-6 pb-4 flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Operator + Express Cert</h1>
        </div>

        {/* Headline numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Card icon={<DollarSign className="w-4 h-4" />} label="Operator MRR" value={`$${stats.subscriptions.operatorMRR.toLocaleString()}`} sub={`${stats.subscriptions.operatorActive} active`} />
          <Card icon={<DollarSign className="w-4 h-4" />} label="Business MRR" value={`$${stats.subscriptions.businessMRR.toLocaleString()}`} sub={`${stats.subscriptions.businessActive} active`} />
          <Card icon={<ShieldCheck className="w-4 h-4" />} label="Express lifetime" value={`$${stats.expressCert.lifetimeRevenue.toLocaleString()}`} sub={`${stats.expressCert.paid + stats.expressCert.generated} paid`} />
          <Card icon={<Activity className="w-4 h-4" />} label="Validations 24h" value={String(stats.validations.last24h)} sub={`${stats.validations.last7d} this week`} />
        </div>

        {/* Validation severity breakdown */}
        <Section title="Severity breakdown · last 7 days">
          {Object.keys(stats.breakdown7d.bySeverity).length === 0
            ? <Empty />
            : Object.entries(stats.breakdown7d.bySeverity).map(([sev, count]) => (
              <Bar key={sev} label={sev} count={count} total={totalSeverity} colorClass={SEV_COLORS[sev] || 'text-gray-400'} />
            ))}
        </Section>

        {/* Doc-kind breakdown */}
        <Section title="Document kind · last 7 days">
          {Object.keys(stats.breakdown7d.byKind).length === 0
            ? <Empty />
            : Object.entries(stats.breakdown7d.byKind).map(([kind, count]) => (
              <Bar key={kind} label={KIND_LABELS[kind] || kind} count={count} total={totalKind} colorClass="text-blue-600" />
            ))}
        </Section>

        {/* Express Cert pipeline */}
        <Section title="Express Cert pipeline">
          <div className="grid grid-cols-3 gap-3">
            <Mini label="Draft" value={stats.expressCert.draft} />
            <Mini label="Paid (waiting)" value={stats.expressCert.paid} />
            <Mini label="Generated" value={stats.expressCert.generated} />
          </div>
        </Section>

        {/* Performance */}
        <Section title="Performance">
          <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
            <p>Avg validation time: <span className="font-bold text-gray-900 dark:text-gray-100">{stats.validations.avgMsPerRun ? `${(stats.validations.avgMsPerRun / 1000).toFixed(1)}s` : '—'}</span></p>
            <p>Total validations all-time: <span className="font-bold text-gray-900 dark:text-gray-100">{stats.validations.total.toLocaleString()}</span></p>
            <p className="text-[10px] text-gray-500 mt-2">Generated {new Date(stats.generatedAt).toLocaleString()}</p>
          </div>
        </Section>
      </div>
    </main>
  )
}

function Card({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-[10px] uppercase font-semibold text-gray-500 mb-1">
        {icon} {label}
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-3">
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">{title}</p>
      {children}
    </div>
  )
}

function Bar({ label, count, total, colorClass }: { label: string; count: number; total: number; colorClass: string }) {
  const pct = Math.round((count / total) * 100)
  return (
    <div className="mb-1.5">
      <div className="flex items-center justify-between text-xs mb-0.5">
        <span className={`capitalize font-semibold ${colorClass}`}>{label}</span>
        <span className="tabular-nums text-gray-700 dark:text-gray-300">{count} · {pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
        <div className={`h-full bg-current opacity-30 ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
      <p className="text-[10px] uppercase text-gray-500 font-semibold mt-0.5">{label}</p>
    </div>
  )
}

function Empty() {
  return <p className="text-xs text-gray-400 italic">No data yet — first paying customer hasn&apos;t landed.</p>
}
