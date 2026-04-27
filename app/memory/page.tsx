'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { getPortMeta } from '@/lib/portMeta'
import { ArrowLeft, Trophy, MapPin, Clock, Zap, Calendar, Star, Share2 } from 'lucide-react'

interface MemoryData {
  totals: {
    reports: number
    saved: number
    points: number
    days_active: number
    member_since: string | null
  }
  favorite_port: { port_id: string; count: number } | null
  longest_wait: { port_id: string; wait_minutes: number; recorded_at: string } | null
  fastest_wait: { port_id: string; wait_minutes: number; recorded_at: string } | null
  by_port: { port_id: string; count: number }[]
  by_month: { ym: string; count: number }[]
  recent: { id: string; port_id: string; wait_minutes: number | null; recorded_at: string | null; created_at: string; report_type: string | null }[]
}

function portName(portId: string): string {
  const meta = getPortMeta(portId)
  return meta?.localName || meta?.city || portId
}

function fmtDate(iso: string | null, lang: 'es' | 'en'): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function fmtMonthLabel(ym: string, lang: 'es' | 'en'): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, (m ?? 1) - 1, 1))
  return d.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { year: '2-digit', month: 'short' })
}

export default function MemoryPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { lang } = useLang()
  const es = lang === 'es'
  const [data, setData] = useState<MemoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [shareCopied, setShareCopied] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login?next=/memory')
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return
    fetch('/api/memory', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }, [user])

  async function shareWrapped() {
    if (!data) return
    const text = es
      ? `Mi año en Cruzar — ${data.totals.reports} reportes, ${data.totals.days_active} días en el puente, ${data.totals.points} puntos. Vamos por más en cruzar.app 🚗`
      : `My year on Cruzar — ${data.totals.reports} reports, ${data.totals.days_active} bridge days, ${data.totals.points} points. Cruzar.app sees you 🚗`
    const url = 'https://cruzar.app/memory'
    if (typeof navigator === 'undefined') return
    const nav = navigator as Navigator
    if ('share' in nav && typeof nav.share === 'function') {
      try { await nav.share({ text, url }); return } catch { /* fall through */ }
    }
    try {
      await nav.clipboard.writeText(`${text}\n${url}`)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 3000)
    } catch { /* ignore */ }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-8">
        <div className="max-w-lg mx-auto">
          <Link href="/dashboard" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-4">
            <ArrowLeft className="w-3 h-3" /> {es ? 'Volver' : 'Back'}
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{es ? 'Memoria' : 'Memory'}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{es ? 'No pudimos cargar tu memoria.' : 'Could not load your memory.'}</p>
        </div>
      </main>
    )
  }

  const monthMax = Math.max(1, ...data.by_month.map((m) => m.count))
  const isEmpty = data.totals.reports === 0

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 pt-6 pb-12">
      <div className="max-w-lg mx-auto">
        <Link href="/dashboard" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-3">
          <ArrowLeft className="w-3 h-3" /> {es ? 'Volver al panel' : 'Back to dashboard'}
        </Link>
        <div className="flex items-baseline justify-between mb-1">
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">
            {es ? 'Tu memoria de cruces' : 'Your crossing memory'}
          </h1>
          {data.totals.member_since && (
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              {es ? 'Desde' : 'Since'} {fmtDate(data.totals.member_since, lang)}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {es
            ? 'Tu actividad en Cruzar — reportes, puentes favoritos, puntos y récords personales.'
            : 'Your Cruzar activity — reports, favorite bridges, points, and personal records.'}
        </p>

        {isEmpty ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center shadow-sm">
            <Calendar className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {es ? 'Aún no hay reportes' : 'No reports yet'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">
              {es
                ? 'Cuando reportes una espera en un puente, va a aparecer aquí.'
                : 'Once you report a wait at a bridge it will show up here.'}
            </p>
            <Link href="/" className="inline-block bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors">
              {es ? 'Ver puentes' : 'See bridges'}
            </Link>
          </div>
        ) : (
          <>
            {/* Top stat tiles */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <StatTile
                icon={<Calendar className="w-4 h-4" />}
                label={es ? 'Reportes' : 'Reports'}
                value={String(data.totals.reports)}
              />
              <StatTile
                icon={<Trophy className="w-4 h-4" />}
                label={es ? 'Puntos' : 'Points'}
                value={String(data.totals.points)}
              />
              <StatTile
                icon={<MapPin className="w-4 h-4" />}
                label={es ? 'Días activo' : 'Active days'}
                value={String(data.totals.days_active)}
              />
              <StatTile
                icon={<Star className="w-4 h-4" />}
                label={es ? 'Guardados' : 'Saved'}
                value={String(data.totals.saved)}
              />
            </div>

            {/* Favorite + records */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-5 shadow-sm">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                {es ? 'Tus récords' : 'Your records'}
              </p>
              <div className="space-y-3">
                {data.favorite_port && (
                  <RecordRow
                    label={es ? 'Puente favorito' : 'Favorite bridge'}
                    value={portName(data.favorite_port.port_id)}
                    subtle={`${data.favorite_port.count} ${es ? 'reportes' : 'reports'}`}
                  />
                )}
                {data.longest_wait && (
                  <RecordRow
                    label={es ? 'Espera más larga reportada' : 'Longest reported wait'}
                    value={`${data.longest_wait.wait_minutes} min`}
                    subtle={`${portName(data.longest_wait.port_id)} · ${fmtDate(data.longest_wait.recorded_at, lang)}`}
                  />
                )}
                {data.fastest_wait && (
                  <RecordRow
                    label={es ? 'Cruce más rápido' : 'Fastest crossing'}
                    value={`${data.fastest_wait.wait_minutes} min`}
                    subtle={`${portName(data.fastest_wait.port_id)} · ${fmtDate(data.fastest_wait.recorded_at, lang)}`}
                  />
                )}
              </div>
            </div>

            {/* Monthly bar chart */}
            {data.by_month.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-5 shadow-sm">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                  {es ? 'Reportes por mes' : 'Reports by month'}
                </p>
                <div className="space-y-1.5">
                  {data.by_month.map((m) => (
                    <div key={m.ym} className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 w-14 text-right tabular-nums">{fmtMonthLabel(m.ym, lang)}</span>
                      <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 rounded-full"
                          style={{ width: `${(m.count / monthMax) * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-gray-700 dark:text-gray-300 w-8 tabular-nums">{m.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-port breakdown */}
            {data.by_port.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-5 shadow-sm">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                  {es ? 'Tus puentes' : 'Your bridges'}
                </p>
                <div className="space-y-1.5">
                  {data.by_port.map((p) => (
                    <div key={p.port_id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300 truncate">{portName(p.port_id)}</span>
                      <span className="text-gray-500 dark:text-gray-400 tabular-nums text-xs">
                        {p.count} {es ? 'reportes' : 'reports'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent timeline */}
            {data.recent.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-5 shadow-sm">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                  {es ? 'Recientes' : 'Recent'}
                </p>
                <div className="space-y-2">
                  {data.recent.slice(0, 12).map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 text-xs border-b border-gray-100 dark:border-gray-700 last:border-0 pb-2 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-100 truncate">{portName(r.port_id)}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">{fmtDate(r.recorded_at ?? r.created_at, lang)}{r.report_type ? ` · ${r.report_type}` : ''}</p>
                      </div>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">
                        {typeof r.wait_minutes === 'number' ? `${r.wait_minutes} min` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Share Wrapped */}
            <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-2xl p-5 text-white shadow-lg mb-5">
              <p className="text-base font-black mb-1 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                {es ? 'Cruzar Wrapped' : 'Cruzar Wrapped'}
              </p>
              <p className="text-[12px] text-blue-100 mb-4 leading-snug">
                {es
                  ? 'Comparte tu año en Cruzar — reportes, días en el puente y puntos.'
                  : 'Share your year on Cruzar — reports, bridge days, and points.'}
              </p>
              <button
                onClick={shareWrapped}
                className="w-full bg-white text-indigo-700 text-sm font-black py-2.5 rounded-xl hover:bg-blue-50 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                {shareCopied ? (es ? '¡Copiado!' : 'Copied!') : (es ? 'Compartir' : 'Share')}
              </button>
            </div>

            <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center mt-2">
              {es
                ? 'Esto solo lo ves tú. Cruzar nunca publica tu actividad.'
                : 'Only you see this. Cruzar never publishes your activity.'}
            </p>
          </>
        )}
      </div>
    </main>
  )
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 mb-1">{icon}<span className="text-[11px] uppercase tracking-wider font-semibold">{label}</span></div>
      <p className="text-2xl font-black text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
    </div>
  )
}

function RecordRow({ label, value, subtle }: { label: string; value: string; subtle?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        {subtle && <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{subtle}</p>}
      </div>
      <span className="text-sm font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap text-right">{value}</span>
    </div>
  )
}
