'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Copy, Check, ExternalLink, TrendingUp, Users, MessageSquare, Share2, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/lib/useAuth'
import {
  PROMOTER_TEMPLATES,
  CATEGORY_META,
  renderTemplate,
  type TemplateCategory,
} from '@/lib/promoterContent'
import { FACEBOOK_GROUPS, REGION_LABELS, type FbGroupRegion } from '@/lib/facebookGroups'

// Promoter dashboard — the Raul panel.
//
// Gated behind profile.is_promoter (checked server-side by the stats
// endpoint). Non-promoters see a "not authorized" placeholder rather
// than a redirect so a wrong-URL visit doesn't feel hostile.
//
// Layout:
//   1. Top: hero with the promoter's unique ref link + big copy button
//   2. Stats row: shares, signups, reports, weekly signups
//   3. Content library: tabs per category, tap any template to copy
//      it to clipboard with the ref link already baked in. Each copy
//      fires a log-share event so the stats reflect it.
//   4. FB group bank: region-tabbed list of groups with one-tap open
//      in new window. Lets the promoter copy a template then jump
//      straight to the group to paste it.
//
// Everything happens on one screen, no navigation required. That's
// the point — it's a "scroll and post" tool.

interface Stats {
  signups: number
  reports: number
  shares: number
  weeklySignups: number
}

const ALL_CATEGORIES: TemplateCategory[] = [
  'morning', 'midday', 'afternoon', 'evening', 'heads_up', 'tip', 'ask', 'evergreen',
]

export function PromoterDashboard() {
  const { user, loading: authLoading } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'all'>('all')
  const [regionFilter, setRegionFilter] = useState<FbGroupRegion | 'all'>('all')

  const refLink = user ? `https://cruzar.app/?ref=${user.id}` : 'https://cruzar.app'

  // Load stats on mount
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setAccessError('not_signed_in')
      setLoading(false)
      return
    }

    fetch('/api/promoter/stats')
      .then(async (r) => {
        if (r.status === 403) {
          setAccessError('not_promoter')
          return null
        }
        if (!r.ok) {
          setAccessError('error')
          return null
        }
        return r.json()
      })
      .then((data) => {
        if (data) {
          setDisplayName(data.displayName || '')
          setStats(data.stats)
        }
      })
      .catch(() => setAccessError('error'))
      .finally(() => setLoading(false))
  }, [user, authLoading])

  async function logShare(templateId: string, category: string, channel: string, targetGroup?: string) {
    try {
      await fetch('/api/promoter/log-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, category, channel, targetGroup }),
      })
      // Optimistic bump
      setStats((prev) => prev ? { ...prev, shares: prev.shares + 1 } : prev)
    } catch { /* ignore */ }
  }

  async function copyTemplate(templateId: string, category: string, text: string) {
    const rendered = text.replace(/\{\{refLink\}\}/g, refLink)
    try {
      await navigator.clipboard.writeText(rendered)
      setCopiedId(templateId)
      setTimeout(() => setCopiedId(null), 2000)
      logShare(templateId, category, 'copy')
    } catch {
      // clipboard blocked — fall back silently
    }
  }

  async function copyRefLink() {
    try {
      await navigator.clipboard.writeText(refLink)
      setCopiedId('ref-link')
      setTimeout(() => setCopiedId(null), 2000)
    } catch { /* ignore */ }
  }

  const visibleTemplates = useMemo(() => {
    return categoryFilter === 'all'
      ? PROMOTER_TEMPLATES
      : PROMOTER_TEMPLATES.filter((t) => t.category === categoryFilter)
  }, [categoryFilter])

  const visibleGroups = useMemo(() => {
    return regionFilter === 'all'
      ? FACEBOOK_GROUPS
      : FACEBOOK_GROUPS.filter((g) => g.region === regionFilter)
  }, [regionFilter])

  // ─── Gating states ─────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="animate-pulse text-sm text-gray-400">Cargando…</div>
      </main>
    )
  }

  if (accessError === 'not_signed_in') {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 text-center">
          <p className="text-3xl mb-3">🔒</p>
          <h1 className="text-lg font-black text-gray-900 dark:text-gray-100">Panel del promotor</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">
            Necesitas iniciar sesión con la cuenta de promotor.
          </p>
          <Link href="/login?next=/promoter" className="mt-4 block w-full bg-blue-600 text-white text-sm font-bold rounded-2xl py-3">
            Iniciar sesión
          </Link>
        </div>
      </main>
    )
  }

  if (accessError === 'not_promoter') {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 text-center">
          <p className="text-3xl mb-3">🚫</p>
          <h1 className="text-lg font-black text-gray-900 dark:text-gray-100">Sin acceso</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">
            Esta cuenta no es una cuenta de promotor. Contacta a Diego si crees que deberías tener acceso.
          </p>
          <Link href="/" className="mt-4 block w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-2xl py-3">
            ← Regresar
          </Link>
        </div>
      </main>
    )
  }

  // ─── Main dashboard ────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-12">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              <ArrowLeft className="w-3 h-3" /> Cruzar
            </Link>
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1">
              Panel del promotor
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {displayName && `${displayName} · `}Tu link, tu contenido, tus números.
            </p>
          </div>
        </div>

        {/* ─── Referral link card ──────────────────────────── */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 rounded-2xl p-5 shadow-xl text-white mb-4 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-widest font-bold text-blue-100">Tu link único</p>
            <div className="mt-2 flex items-stretch gap-2">
              <div className="flex-1 min-w-0 bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-white/20">
                <p className="text-xs font-mono text-white truncate">{refLink}</p>
              </div>
              <button
                onClick={copyRefLink}
                className="flex-shrink-0 bg-white text-indigo-700 font-black text-xs px-4 rounded-xl active:scale-95 transition-transform"
              >
                {copiedId === 'ref-link' ? (
                  <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Copiado</span>
                ) : (
                  <span className="flex items-center gap-1"><Copy className="w-3 h-3" /> Copiar</span>
                )}
              </button>
            </div>
            <p className="text-[10px] text-blue-100 mt-2 leading-snug">
              Cada usuario que se registre por este link queda atribuido a ti. No cambies el link, no lo acortes — se rompe el tracking.
            </p>
          </div>
        </div>

        {/* ─── Stats row ───────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-4 gap-2 mb-6">
            <StatTile icon={<Share2 className="w-4 h-4" />} label="Posts" value={stats.shares} color="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" />
            <StatTile icon={<Users className="w-4 h-4" />} label="Signups" value={stats.signups} color="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" />
            <StatTile icon={<MessageSquare className="w-4 h-4" />} label="Reportes" value={stats.reports} color="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300" />
            <StatTile icon={<TrendingUp className="w-4 h-4" />} label="7 días" value={stats.weeklySignups} color="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300" />
          </div>
        )}

        {/* ─── Content library ─────────────────────────────── */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-black text-gray-900 dark:text-gray-100">
              📝 Textos listos pa\' copiar
            </h2>
            <span className="text-[10px] text-gray-400">{visibleTemplates.length} plantillas</span>
          </div>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
              }`}
            >
              Todos
            </button>
            {ALL_CATEGORIES.map((cat) => {
              const meta = CATEGORY_META[cat]
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                    categoryFilter === cat
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {meta.emoji} {meta.es}
                </button>
              )
            })}
          </div>

          {/* Templates */}
          <div className="space-y-2">
            {visibleTemplates.map((template) => {
              const rendered = renderTemplate(template, refLink)
              const isCopied = copiedId === template.id
              return (
                <div
                  key={template.id}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm leading-none">{CATEGORY_META[template.category].emoji}</span>
                      <span className="text-[11px] font-bold text-gray-900 dark:text-gray-100 truncate">
                        {template.label}
                      </span>
                    </div>
                    <button
                      onClick={() => copyTemplate(template.id, template.category, template.text)}
                      className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full transition-colors ${
                        isCopied
                          ? 'bg-green-500 text-white'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isCopied ? <><Check className="w-3 h-3" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-snug">
                    {rendered}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        {/* ─── FB group bank ──────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-black text-gray-900 dark:text-gray-100">
              📘 Grupos para postear
            </h2>
            <span className="text-[10px] text-gray-400">{visibleGroups.length} grupos</span>
          </div>

          {/* Region tabs */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button
              onClick={() => setRegionFilter('all')}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                regionFilter === 'all'
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
              }`}
            >
              🌎 Todos
            </button>
            {(Object.keys(REGION_LABELS) as FbGroupRegion[]).map((r) => {
              const meta = REGION_LABELS[r]
              const count = FACEBOOK_GROUPS.filter((g) => g.region === r).length
              if (count === 0) return null
              return (
                <button
                  key={r}
                  onClick={() => setRegionFilter(r)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                    regionFilter === r
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {meta.emoji} {meta.label.split(' / ')[0]} ({count})
                </button>
              )
            })}
          </div>

          <div className="space-y-1.5">
            {visibleGroups.map((group) => (
              <a
                key={group.url}
                href={group.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => logShare('group-open', 'evergreen', 'group_open', group.name)}
                className="flex items-center justify-between gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                    {group.name}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">
                    {REGION_LABELS[group.region].label}
                  </p>
                </div>
                <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

function StatTile({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  return (
    <div className={`${color} rounded-xl px-2 py-2.5 text-center`}>
      <div className="flex items-center justify-center mb-0.5 opacity-70">{icon}</div>
      <p className="text-lg font-black tabular-nums leading-none">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-wider opacity-75 mt-0.5">{label}</p>
    </div>
  )
}
