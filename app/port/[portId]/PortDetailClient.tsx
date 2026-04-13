'use client'

import { useState, useEffect } from 'react'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { WaitBadge } from '@/components/WaitBadge'
import { PushToggle } from '@/components/PushToggle'
import { ReportForm } from '@/components/ReportForm'
import { ReportsFeed } from '@/components/ReportsFeed'
import { BridgeCameras } from '@/components/BridgeCameras'
import { PortDetailSoftWall } from '@/components/PortDetailSoftWall'
import { PingCircleButton } from '@/components/PingCircleButton'
import { JustCrossedPrompt } from '@/components/JustCrossedPrompt'
import { HourlyWaitChart } from '@/components/HourlyWaitChart'
import { useAuth } from '@/lib/useAuth'
import { useTier, canAccess } from '@/lib/useTier'
import Link from 'next/link'
import { Bell, Share2, Check } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import type { PortWaitTime, WaitTimeReading } from '@/types'

interface Prediction {
  datetime: string
  hour: number
  predictedWait: number | null
  confidence: string
}

interface Props {
  port: PortWaitTime
  portId: string
}

interface BestTime {
  hour: number
  avgWait: number
  samples: number
}

function formatHour(hour: number): string {
  if (hour === 0) return '12am'
  if (hour < 12) return `${hour}am`
  if (hour === 12) return '12pm'
  return `${hour - 12}pm`
}

export function PortDetailClient({ port, portId }: Props) {
  const { user, loading: authLoading } = useAuth()
  const { tier } = useTier()
  const { lang } = useLang()
  const es = lang === 'es'
  const [history, setHistory] = useState<WaitTimeReading[]>([])
  const [bestTimes, setBestTimes] = useState<BestTime[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [reportRefresh, setReportRefresh] = useState(0)
  const [reportPulse, setReportPulse] = useState(false)

  // When the user lands from the no-data 'Be the first to report' CTA
  // (?report=1 or #report), jump straight to the report form and
  // highlight it briefly so they don't have to hunt.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const wants = params.get('report') === '1' || window.location.hash === '#report'
    if (!wants) return
    // Wait a tick for the form to be mounted, then scroll into view
    const id = setTimeout(() => {
      const el = document.getElementById('report')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setReportPulse(true)
        setTimeout(() => setReportPulse(false), 2400)
      }
    }, 120)
    return () => clearTimeout(id)
  }, [])
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAlertNudge, setShowAlertNudge] = useState(false)
  const [alertThreshold, setAlertThreshold] = useState(20)
  const [alertSaved, setAlertSaved] = useState(false)
  const [alertSaving, setAlertSaving] = useState(false)
  type CommunitySignal = { type: 'accident' | 'inspection' | 'worse' | 'better'; count: number }
  const [communitySignal, setCommunitySignal] = useState<CommunitySignal | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const [showJustCrossed, setShowJustCrossed] = useState(false)
  const [lastCrossed, setLastCrossed] = useState<{ minutesAgo: number; waited: number | null } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [histRes, bestRes, predRes, reportsRes] = await Promise.all([
          fetch(`/api/ports/${encodeURIComponent(portId)}/history`),
          fetch(`/api/ports/${encodeURIComponent(portId)}/best-times`),
          fetch(`/api/predictions?portId=${encodeURIComponent(portId)}`),
          fetch(`/api/reports?portId=${encodeURIComponent(portId)}&limit=20`),
        ])
        if (histRes.ok) {
          const { history } = await histRes.json()
          setHistory(history || [])
        }
        if (bestRes.ok) {
          const { bestTimes } = await bestRes.json()
          setBestTimes(bestTimes || [])
        }
        if (predRes.ok) {
          const { predictions } = await predRes.json()
          setPredictions(predictions || [])
        }
        if (reportsRes.ok) {
          const { reports } = await reportsRes.json()
          const cutoff = Date.now() - 30 * 60 * 1000
          const recent: { report_type: string; created_at: string; wait_minutes?: number }[] = (reports || [])
            .filter((r: { created_at: string }) => new Date(r.created_at).getTime() > cutoff)

          const accidents   = recent.filter(r => r.report_type === 'accident').length
          const inspections = recent.filter(r => r.report_type === 'inspection').length
          const delays      = recent.filter(r => r.report_type === 'delay').length
          const clears      = recent.filter(r => r.report_type === 'clear').length

          // Priority order: accident > inspection > delay surge > clearing
          if (accidents >= 1) {
            setCommunitySignal({ type: 'accident', count: accidents })
          } else if (inspections >= 1) {
            setCommunitySignal({ type: 'inspection', count: inspections })
          } else if (delays >= 3 && delays > clears * 2) {
            setCommunitySignal({ type: 'worse', count: delays })
          } else if (clears >= 3 && clears > delays * 2) {
            setCommunitySignal({ type: 'better', count: clears })
          }

          // Last crossed — most recent report with wait_minutes
          const crossed = (reports || []).find((r: { wait_minutes?: number; created_at: string }) => r.wait_minutes != null)
          if (crossed) {
            const minutesAgo = Math.round((Date.now() - new Date(crossed.created_at).getTime()) / 60000)
            if (minutesAgo <= 60) setLastCrossed({ minutesAgo, waited: crossed.wait_minutes })
          }
        }
      } finally {
        setLoadingHistory(false)
      }
    }
    load()
  }, [portId])

  // Capture ?ref= from URL and store for use on signup/report
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref && ref.length > 10) {
      localStorage.setItem('cruzar_ref', ref)
      localStorage.setItem('cruzar_ref_port', portId)
      localStorage.setItem('cruzar_ref_ts', String(Date.now()))
    }
  }, [portId])

  async function handleShare() {
    const url = user
      ? `https://cruzar.app/port/${portId}?ref=${user.id}`
      : `https://cruzar.app/port/${portId}`
    const text = es
      ? `Tiempos de espera en vivo en ${port.portName} — cruzar.app`
      : `Live wait times at ${port.portName} — cruzar.app`

    if (navigator.share) {
      try {
        await navigator.share({ title: port.portName, text, url })
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2500)
    }
  }

  const chartData = history.map((r) => ({
    time: new Date(r.recorded_at).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    vehicle: r.vehicle_wait,
    pedestrian: r.pedestrian_wait,
  }))

  async function saveAlert() {
    setAlertSaving(true)
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portId, laneType: 'vehicle', thresholdMinutes: alertThreshold }),
    })
    if (res.ok) setAlertSaved(true)
    setAlertSaving(false)
  }

  async function toggleSave() {
    if (!user) return
    setSaving(true)
    if (saved) {
      await fetch(`/api/saved?portId=${encodeURIComponent(portId)}`, { method: 'DELETE' })
      setSaved(false)
      setShowAlertNudge(false)
    } else {
      await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portId }),
      })
      setSaved(true)
      if (!canAccess(tier, 'alerts')) setShowAlertNudge(true)
    }
    setSaving(false)
  }

  const avgVehicleWait = (() => {
    const readings = history.filter(r => r.vehicle_wait !== null)
    if (!readings.length) return null
    return Math.round(readings.reduce((sum, r) => sum + (r.vehicle_wait ?? 0), 0) / readings.length)
  })()

  const vehicleTrend = (() => {
    if (history.length < 2) return { dir: 'stable' as const, delta: 0 }
    const latest = history[history.length - 1]
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)
    const older = [...history].reverse().find(r => new Date(r.recorded_at) <= thirtyMinAgo)
    if (!older) return { dir: 'stable' as const, delta: 0 }
    const diff = (latest.vehicle_wait ?? 0) - (older.vehicle_wait ?? 0)
    if (diff >= 3) return { dir: 'up' as const, delta: diff }
    if (diff <= -3) return { dir: 'down' as const, delta: diff }
    return { dir: 'stable' as const, delta: diff }
  })()

  const leaveRecommendation = (() => {
    if (!bestTimes.length) return null
    const currentHour = new Date().getHours()
    return bestTimes
      .filter(bt => bt.avgWait <= 25 && bt.hour > currentHour && bt.hour <= currentHour + 10)
      .sort((a, b) => a.avgWait - b.avgWait)[0] ?? null
  })()

  const contextualDelay = (() => {
    if (!bestTimes.length || port.vehicle === null || loadingHistory) return null
    const currentHour = new Date().getHours()
    const typicalNow = bestTimes.find(bt => bt.hour === currentHour)
    if (!typicalNow || typicalNow.samples < 3) return null
    const diff = port.vehicle - typicalNow.avgWait
    if (diff >= 10) return { type: 'above' as const, diff: Math.round(diff), typical: typicalNow.avgWait }
    if (diff <= -10) return { type: 'below' as const, diff: Math.round(Math.abs(diff)), typical: typicalNow.avgWait }
    return null
  })()

  const predictionChartData = predictions
    .filter(p => p.predictedWait !== null)
    .map(p => ({
      time: new Date(p.datetime).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
      predicted: p.predictedWait,
      confidence: p.confidence,
    }))

  const clearingTime = (() => {
    if (!canAccess(tier, 'ai_predictions') || !predictionChartData.length) return null
    const next = predictionChartData.slice(1).find(p => (p.predicted as number) <= 20)
    return next?.time ?? null
  })()

  if (authLoading) {
    return <div className="min-h-[300px]" />
  }

  if (!user) {
    const returnTo = encodeURIComponent(`/port/${portId}`)
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 sm:p-8 text-center space-y-5">
        <div className="text-4xl">🌉</div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {es ? 'Crea una cuenta gratis' : 'Create a free account'}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {es
              ? `Para ver los detalles de ${port.portName} — historial, reportes de la comunidad, alertas y más — crea tu cuenta gratis.`
              : `To see details for ${port.portName} — history, community reports, alerts and more — create your free account.`}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {es
              ? 'Gratis para siempre. Toma 10 segundos.'
              : 'Free forever. Takes 10 seconds.'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
          <Link
            href={`/signup?next=${returnTo}`}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-5 rounded-xl text-sm transition-colors"
          >
            {es ? 'Crear cuenta gratis' : 'Create free account'}
          </Link>
          <Link
            href={`/login?next=${returnTo}`}
            className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 text-gray-900 dark:text-gray-100 font-semibold py-3 px-5 rounded-xl text-sm transition-colors"
          >
            {es ? 'Ya tengo cuenta' : 'I have an account'}
          </Link>
        </div>
        <Link
          href="/"
          className="block text-xs text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 pt-2"
        >
          {es ? '← Ver tiempos de todos los puentes' : '← See all bridge wait times'}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <JustCrossedPrompt
        portId={portId}
        portName={port.portName}
        onSubmitted={() => { setReportRefresh(r => r + 1); setShowJustCrossed(false) }}
        forceShow={showJustCrossed}
        onDismiss={() => setShowJustCrossed(false)}
      />

      {/* Last crossed banner */}
      {lastCrossed && !showJustCrossed && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-green-800 dark:text-green-300">
            ✅ {es
              ? `Alguien cruzó hace ${lastCrossed.minutesAgo} min${lastCrossed.waited ? ` · esperó ${lastCrossed.waited} min` : ''}`
              : `Someone crossed ${lastCrossed.minutesAgo} min ago${lastCrossed.waited ? ` · waited ${lastCrossed.waited} min` : ''}`}
          </p>
        </div>
      )}

      {/* Just crossed button */}
      <button
        onClick={() => setShowJustCrossed(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-green-500 text-green-600 dark:text-green-400 text-sm font-bold hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors active:scale-95"
      >
        ✅ {es ? 'Acabo de cruzar — reportar' : 'Just crossed — report it'}
      </button>
      {/* Save button */}
      {user && (
        <button
          onClick={toggleSave}
          disabled={saving}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
            saved
              ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          {saved ? '⭐ Saved to Dashboard' : '☆ Save to Dashboard'}
        </button>
      )}

      {/* Share button — always visible, ref link if logged in */}
      <button
        onClick={handleShare}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
          shareCopied
            ? 'bg-green-50 border-green-300 text-green-700'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        {shareCopied
          ? <><Check className="w-4 h-4" /> {es ? '¡Enlace copiado!' : 'Link copied!'}</>
          : <><Share2 className="w-4 h-4" /> {es ? 'Compartir este puente' : 'Share this crossing'}{user ? ` · ${es ? '+10 pts si reportan' : '+10 pts if they report'}` : ''}</>
        }
      </button>

      {/* Alert nudge after saving */}
      {showAlertNudge && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-800">{es ? '🔔 Avísame cuando baje' : '🔔 Get notified when it drops'}</p>
            <p className="text-xs text-blue-600 mt-0.5">{es ? 'Activa Pro para recibir alertas cuando baje la espera.' : 'Upgrade to Pro to set a wait time alert for this crossing.'}</p>
          </div>
          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
            <Link href="/pricing" className="text-xs font-semibold text-white bg-blue-600 px-3 py-1.5 rounded-xl hover:bg-blue-700 transition-colors">
              Pro →
            </Link>
            <button onClick={() => setShowAlertNudge(false)} className="text-blue-400 hover:text-blue-600 text-lg leading-none">×</button>
          </div>
        </div>
      )}

      {/* Current wait times */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {es ? 'Tiempos de espera' : 'Current Wait Times'}
          </h2>
          {avgVehicleWait !== null && !loadingHistory && (
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
              {es ? `promedio: ${avgVehicleWait} min` : `avg today: ${avgVehicleWait} min`}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center p-3 bg-gray-50 rounded-xl">
            <span className="text-xs text-gray-500 mb-1">{es ? 'Vehículo' : 'Passenger Vehicle'}</span>
            <WaitBadge minutes={port.vehicle} label="" />
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap justify-center">
              {!loadingHistory && history.length > 1 && (
                <>
                  {vehicleTrend.dir === 'up' && (
                    <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">
                      ↑ +{vehicleTrend.delta} min
                    </span>
                  )}
                  {vehicleTrend.dir === 'down' && (
                    <span className="text-xs font-bold text-white bg-green-500 px-2 py-0.5 rounded-full">
                      ↓ {vehicleTrend.delta} min
                    </span>
                  )}
                  {vehicleTrend.dir === 'stable' && (
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                      → {es ? 'estable' : 'stable'}
                    </span>
                  )}
                </>
              )}
              {port.vehicleLanesOpen !== null && (
                <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                  {port.vehicleLanesOpen} {es ? 'carriles' : 'lanes'}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center p-3 bg-gray-50 rounded-xl">
            <span className="text-xs text-gray-500 mb-1">SENTRI / Ready Lane</span>
            {port.sentri !== null ? (
              <>
                <WaitBadge minutes={port.sentri} label="" />
                {port.sentriLanesOpen !== null && (
                  <span className="text-xs text-gray-400 mt-1">
                    {port.sentriLanesOpen} {es ? 'carriles' : 'lanes open'}
                  </span>
                )}
              </>
            ) : port.isClosed ? (
              <span className="text-xs font-medium text-gray-400 mt-2">{es ? 'Cerrado' : 'Closed'}</span>
            ) : port.vehicle !== null && port.vehicle > 0 ? (
              // CBP doesn't always report SENTRI — estimate at ~40% of standard lane
              <>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-lg font-bold text-blue-600">~{Math.round(port.vehicle * 0.4)}</span>
                  <span className="text-xs text-gray-400">min</span>
                </div>
                <span className="text-xs text-blue-400 mt-0.5">{es ? 'estimado' : 'estimated'}</span>
                <span className="text-xs text-gray-400 mt-0.5 text-center leading-tight">
                  {es ? 'CBP no reportó' : 'CBP not reporting'}
                </span>
              </>
            ) : (
              <span className="text-xs text-gray-400 mt-3">—</span>
            )}
          </div>
        </div>

        {/* SENTRI enrollment nudge — show when SENTRI is (or is estimated to be) at least 10 min faster */}
        {port.vehicle !== null && port.vehicle > 0 && (() => {
          const sentriWait = port.sentri ?? Math.round(port.vehicle * 0.4)
          return port.vehicle - sentriWait >= 10
        })() && (
          <div className="mt-4 flex items-center justify-between bg-blue-600 dark:bg-blue-900/20 border border-blue-700 dark:border-blue-800 rounded-xl px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-white">
                {es
                  ? `SENTRI te ahorraría ~${port.vehicle! - (port.sentri ?? Math.round(port.vehicle! * 0.4))} min aquí`
                  : `SENTRI saves you ~${port.vehicle! - (port.sentri ?? Math.round(port.vehicle! * 0.4))} min at this crossing`}
              </p>
              <p className="text-xs text-blue-100 mt-0.5">
                {es ? 'Aprobación gratis — válido 5 años' : 'Free to apply — valid 5 years'}
              </p>
            </div>
            <a
              href="https://ttp.cbp.dhs.gov/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 ml-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-xl transition-colors"
            >
              {es ? 'Solicitar →' : 'Apply →'}
            </a>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="flex flex-col items-center p-3 bg-gray-50 rounded-xl">
            <span className="text-xs text-gray-500 mb-1">{es ? 'Peatón' : 'Pedestrian'}</span>
            <WaitBadge minutes={port.pedestrian} label="" />
            {port.pedestrianLanesOpen !== null && (
              <span className="text-xs text-gray-400 mt-1">
                {es ? `${port.pedestrianLanesOpen} carriles abiertos` : `${port.pedestrianLanesOpen} lanes open`}
              </span>
            )}
          </div>
          <div className="flex flex-col items-center p-3 bg-gray-50 rounded-xl">
            <span className="text-xs text-gray-500 mb-1">{es ? 'Comercial / Camión' : 'Commercial / Truck'}</span>
            <WaitBadge minutes={port.commercial} label="" />
            {port.commercialLanesOpen !== null && (
              <span className="text-xs text-gray-400 mt-1">
                {es ? `${port.commercialLanesOpen} carriles abiertos` : `${port.commercialLanesOpen} lanes open`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Soft signup wall — dismissible sheet + persistent sticky bar
          for guests. Renders nothing for authed users. Lives high in
          the tree so it's mounted alongside the data, not after. */}
      <PortDetailSoftWall portId={portId} portName={port.portName} />

      {/* Live bridge camera — Pro-gated when a feed is registered for this
          port. Sits below the wait number so it's the first thing after
          the data, matching how Fronter uses cameras as the hero upsell. */}
      <BridgeCameras portId={portId} portName={port.portName} />

      {/* Community vs CBP signal */}
      {communitySignal && (() => {
        const cfg = {
          accident: {
            bg: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700',
            text: 'text-red-800 dark:text-red-300',
            icon: '🚨',
            en: `Accident reported at this crossing in the last 30 min — expect longer delays.`,
            es: `Se reportó un accidente en este cruce en los últimos 30 min — espera más retraso.`,
          },
          inspection: {
            bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
            text: 'text-blue-800 dark:text-blue-300',
            icon: '🔍',
            en: `Enhanced inspections reported — all lanes may be slower than usual.`,
            es: `Se reportaron inspecciones reforzadas — todos los carriles pueden estar más lentos.`,
          },
          worse: {
            bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
            text: 'text-amber-800 dark:text-amber-300',
            icon: '⚠️',
            en: `${communitySignal.count} drivers reporting longer waits than CBP currently shows.`,
            es: `${communitySignal.count} cruzantes reportan más espera de lo que indica CBP ahora.`,
          },
          better: {
            bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
            text: 'text-green-800 dark:text-green-300',
            icon: '✅',
            en: `${communitySignal.count} drivers reporting it's moving faster than CBP shows.`,
            es: `${communitySignal.count} cruzantes dicen que va más rápido de lo que indica CBP.`,
          },
        }[communitySignal.type]
        return (
          <div className={`rounded-2xl px-4 py-3 border flex items-start gap-2 ${cfg.bg}`}>
            <span className="text-base flex-shrink-0">{cfg.icon}</span>
            <div>
              <p className={`text-xs font-semibold leading-snug ${cfg.text}`}>
                {es ? cfg.es : cfg.en}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {es ? 'Reportado por la comunidad · últimos 30 min' : 'Community reported · last 30 min'}
              </p>
            </div>
          </div>
        )
      })()}

      {/* Contextual delay banner */}
      {(contextualDelay || clearingTime) && (
        <div className={`rounded-2xl px-4 py-3 border ${
          contextualDelay?.type === 'above'
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            : contextualDelay?.type === 'below'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        }`}>
          {contextualDelay?.type === 'above' && (
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              ⚠️ {es
                ? `~${contextualDelay.diff} min más de lo usual a esta hora`
                : `~${contextualDelay.diff} min above usual for this time`}
            </p>
          )}
          {contextualDelay?.type === 'below' && (
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">
              ✅ {es
                ? `~${contextualDelay.diff} min menos de lo usual — buen momento para cruzar`
                : `~${contextualDelay.diff} min below usual — great time to cross`}
            </p>
          )}
          {!contextualDelay && clearingTime && (
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
              🕐 {es
                ? `Se espera que despeje alrededor de las ${clearingTime}`
                : `Expected to clear around ${clearingTime}`}
            </p>
          )}
          {contextualDelay && clearingTime && (
            <p className={`text-xs mt-1 ${
              contextualDelay.type === 'above'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-green-600 dark:text-green-400'
            }`}>
              {es
                ? `Se espera que despeje alrededor de las ${clearingTime}`
                : `Expected to clear around ${clearingTime}`}
            </p>
          )}
        </div>
      )}

      {/* Quick Alert card */}
      {user && canAccess(tier, 'alerts') ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {es ? 'Avísame cuando baje la espera' : 'Notify me when wait drops'}
            </p>
          </div>
          {alertSaved ? (
            <p className="text-sm text-green-600 font-medium">
              {es ? `✓ Alerta activada — te avisamos cuando baje de ${alertThreshold} min` : `✓ Alert set — we'll notify you when it drops below ${alertThreshold} min`}
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {es ? 'Notificarme cuando la espera de vehículos baje de:' : 'Notify me when vehicle wait drops below:'}
              </p>
              <div className="flex gap-2 mb-3">
                {[10, 20, 30].map(t => (
                  <button
                    key={t}
                    onClick={() => setAlertThreshold(t)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      alertThreshold === t
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {t} min
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <PushToggle />
                <button
                  onClick={saveAlert}
                  disabled={alertSaving}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
                >
                  {alertSaving ? '...' : es ? 'Activar alerta →' : 'Enable alert →'}
                </button>
              </div>
            </>
          )}
        </div>
      ) : user ? (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
              {es ? '🔔 Avísame cuando baje la espera' : '🔔 Get notified when wait drops'}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              {es ? 'Actualiza a Pro por $2.99/mes' : 'Upgrade to Pro for $2.99/mo'}
            </p>
          </div>
          <Link href="/pricing" className="flex-shrink-0 ml-3 text-xs font-semibold text-white bg-blue-600 px-3 py-1.5 rounded-xl hover:bg-blue-700 transition-colors">
            Pro →
          </Link>
        </div>
      ) : null}

      {/* Mexican auto insurance nudge */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛡️</span>
          <div>
            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
              {es ? 'Cruzando a México?' : 'Heading into Mexico?'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {es ? 'El seguro mexicano es obligatorio por ley.' : 'Mexican auto insurance is required by law.'}
            </p>
          </div>
        </div>
        <Link
          href="/insurance"
          className="flex-shrink-0 ml-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-xl transition-colors"
        >
          {es ? 'Ver opciones →' : 'Get covered →'}
        </Link>
      </div>

      {/* 24-hour history chart */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {es ? 'Últimas 24 horas' : 'Last 24 Hours'}
          </h2>
          {!loadingHistory && chartData.length > 0 && avgVehicleWait !== null && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {es ? `promedio: ${avgVehicleWait} min` : `avg: ${avgVehicleWait} min`}
            </span>
          )}
        </div>
        {loadingHistory ? (
          <div className="h-44 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            {es ? 'No hay datos aún. Vuelve en unas horas.' : 'Not enough data yet. Check back after a few hours.'}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradVehicle" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPedestrian" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                interval="preserveStartEnd"
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                unit=" min"
                width={48}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value, name) => [`${value} min`, name === 'vehicle' ? (es ? 'Vehículo' : 'Vehicle') : (es ? 'Peatón' : 'Pedestrian')]}
                contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="vehicle"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#gradVehicle)"
                dot={false}
                name="vehicle"
              />
              <Area
                type="monotone"
                dataKey="pedestrian"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#gradPedestrian)"
                dot={false}
                name="pedestrian"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
        <div className="flex gap-4 mt-1 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-blue-500 rounded-full inline-block" />
            {es ? 'Vehículo' : 'Vehicle'}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-emerald-500 rounded-full inline-block" />
            {es ? 'Peatón' : 'Pedestrian'}
          </span>
        </div>
      </div>

      {/* Typical day pattern — free for everyone, builds trust */}
      <HourlyWaitChart portId={portId} />

      {/* AI Predictions — Pro+ only */}
      {canAccess(tier, 'ai_predictions') ? (
        predictionChartData.length > 0 && (() => {
          const nowLabel = predictionChartData[0]?.time
          const nowWait = predictionChartData[0]?.predicted as number | null
          const waitColor = nowWait == null ? '#6b7280' : nowWait <= 20 ? '#22c55e' : nowWait <= 45 ? '#f59e0b' : '#ef4444'
          return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{es ? 'Patrones históricos — próximas 24 horas' : 'Historical Patterns – Next 24 Hours'}</h2>
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Beta</span>
              </div>

              {/* Estimated wait now */}
              {nowWait != null && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl" style={{ backgroundColor: `${waitColor}18`, border: `1px solid ${waitColor}40` }}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: waitColor }} />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {es ? 'Espera estimada ahora: ' : 'Estimated wait now: '}<span className="font-bold" style={{ color: waitColor }}>{nowWait} min</span>
                  </span>
                </div>
              )}

              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={predictionChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={3} />
                  <YAxis tick={{ fontSize: 10 }} unit=" min" width={50} domain={[0, 'auto']} />
                  <Tooltip
                    formatter={(value) => [`${value} min`, 'Est. wait']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  {nowLabel && (
                    <ReferenceLine x={nowLabel} stroke="#94a3b8" strokeDasharray="4 2" label={{ value: 'Now', fontSize: 9, fill: '#94a3b8', position: 'insideTopRight' }} />
                  )}
                  <Line type="monotone" dataKey="predicted" stroke="#8b5cf6" strokeWidth={2.5} dot={false} name="Est. wait" />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-400 mt-2">Based on historical patterns for this crossing</p>
            </div>
          )
        })()
      ) : (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-center">
          <p className="text-sm font-semibold text-purple-800">{es ? '📊 Patrones históricos de espera' : '📊 Historical Wait Patterns'}</p>
          <p className="text-xs text-purple-600 mt-1 mb-3">{es ? 'Ve los tiempos estimados para las próximas 24 horas. Función Pro.' : 'See estimated wait times for the next 24 hours. Pro feature.'}</p>
          <Link href="/pricing" className="inline-block bg-purple-600 text-white text-xs font-medium px-4 py-2 rounded-full hover:bg-purple-700 transition-colors">
            {es ? 'Actualizar a Pro →' : 'Upgrade to Pro →'}
          </Link>
        </div>
      )}

      {/* Best times today — Pro+ only */}
      {canAccess(tier, 'ai_predictions') && bestTimes.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {es ? 'Mejores horarios hoy' : 'Best Times Today'} <span className="text-gray-400 font-normal">{es ? '(basado en historial)' : '(based on history)'}</span>
          </h2>

          {leaveRecommendation && (
            <div className="mb-4 flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <span className="text-lg mt-0.5">🚀</span>
              <div>
                <p className="text-sm font-semibold text-green-800">
                  {es
                    ? `Sale a las ${formatHour(leaveRecommendation.hour - 1) || formatHour(leaveRecommendation.hour)} — espera ~${leaveRecommendation.avgWait} min`
                    : `Leave around ${formatHour(leaveRecommendation.hour)} — expect ~${leaveRecommendation.avgWait} min wait`}
                </p>
                <p className="text-xs text-green-600 mt-0.5">
                  {es ? 'Mejor ventana de cruce próximas horas' : 'Best crossing window in the next few hours'}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {bestTimes.map((bt, i) => (
              <div key={bt.hour} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                  <span className="text-sm font-medium text-gray-800">{formatHour(bt.hour)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-600 font-semibold">~{bt.avgWait} min avg</span>
                  <span className="text-xs text-gray-400">({bt.samples} readings)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charla del puente — the reports feed reframed as a live
          community chat. Same data as before, conversational framing.
          Non-gated on purpose — community features benefit from scale. */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">💬</span>
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {es ? 'Charla del puente' : 'Bridge chat'}
            </h2>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-green-600 dark:text-green-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            {es ? 'EN VIVO' : 'LIVE'}
          </span>
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3 -mt-1 leading-snug">
          {es
            ? 'Lo que la gente está reportando ahorita · de más reciente a más antiguo'
            : 'What people are reporting right now · newest first'}
        </p>
        <ReportsFeed portId={portId} refresh={reportRefresh} />
      </div>

      {/* Proactive circle ping — only visible to logged-in users with circles */}
      <PingCircleButton portId={portId} waitMinutes={port?.vehicle ?? null} />

      {/* Submit report */}
      <div
        id="report"
        className={`bg-white dark:bg-gray-800 rounded-2xl border-2 p-5 shadow-sm scroll-mt-20 transition-all ${
          reportPulse
            ? 'border-blue-500 ring-4 ring-blue-500/30 shadow-xl'
            : 'border-blue-500 dark:border-blue-600'
        }`}
      >
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">
          📣 {es ? '¿Cruzaste? Reporta aquí' : 'Did you cross? Report here'}
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {es ? 'Ayuda a otros viajeros con tu reporte · Gana puntos' : 'Help fellow travelers with your report · Earn points'}
        </p>
        <ReportForm portId={portId} onSubmitted={() => setReportRefresh(r => r + 1)} port={port} />
      </div>

      {/* Guest alert CTA — make this crossing the hook */}
      {!user && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-center shadow-sm">
          <p className="text-base font-bold text-white">
            {es
              ? `🔔 Avísame cuando ${port?.portName || 'este puente'} baje de 30 min`
              : `🔔 Ping me when ${port?.portName || 'this crossing'} drops below 30 min`}
          </p>
          <p className="text-xs text-blue-100 mt-1">
            {es
              ? 'Tu primera alerta es gratis · sin spam · cancela cuando quieras'
              : 'Your first alert is free · no spam · cancel anytime'}
          </p>
          <a
            href="/signup"
            className="inline-block mt-3 bg-white text-blue-700 text-sm font-bold px-6 py-2.5 rounded-full hover:bg-blue-50 transition-colors"
          >
            {es ? 'Activar mi alerta gratis →' : 'Turn on my free alert →'}
          </a>
        </div>
      )}
    </div>
  )
}
