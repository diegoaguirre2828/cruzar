'use client'

import { useState, useEffect } from 'react'
import {
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
import { JustCrossedPrompt } from '@/components/JustCrossedPrompt'
import { useAuth } from '@/lib/useAuth'
import { useTier, canAccess } from '@/lib/useTier'
import Link from 'next/link'
import { Bell } from 'lucide-react'
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
  const { user } = useAuth()
  const { tier } = useTier()
  const { lang } = useLang()
  const es = lang === 'es'
  const [history, setHistory] = useState<WaitTimeReading[]>([])
  const [bestTimes, setBestTimes] = useState<BestTime[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [reportRefresh, setReportRefresh] = useState(0)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAlertNudge, setShowAlertNudge] = useState(false)
  const [alertThreshold, setAlertThreshold] = useState(20)
  const [alertSaved, setAlertSaved] = useState(false)
  const [alertSaving, setAlertSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [histRes, bestRes, predRes] = await Promise.all([
          fetch(`/api/ports/${encodeURIComponent(portId)}/history`),
          fetch(`/api/ports/${encodeURIComponent(portId)}/best-times`),
          fetch(`/api/predictions?portId=${encodeURIComponent(portId)}`),
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
      } finally {
        setLoadingHistory(false)
      }
    }
    load()
  }, [portId])

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

  const predictionChartData = predictions
    .filter(p => p.predictedWait !== null)
    .map(p => ({
      time: new Date(p.datetime).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
      predicted: p.predictedWait,
      confidence: p.confidence,
    }))

  return (
    <div className="space-y-4">
      <JustCrossedPrompt
        portId={portId}
        portName={port.portName}
        onSubmitted={() => setReportRefresh(r => r + 1)}
      />
      {/* Save button */}
      {user && (
        <button
          onClick={toggleSave}
          disabled={saving}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
            saved
              ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {saved ? '⭐ Saved to Dashboard' : '☆ Save to Dashboard'}
        </button>
      )}

      {/* Alert nudge after saving */}
      {showAlertNudge && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-800">🔔 Get notified when it drops</p>
            <p className="text-xs text-blue-600 mt-0.5">Upgrade to Pro to set a wait time alert for this crossing.</p>
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
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">
            {es ? 'Tiempos de espera' : 'Current Wait Times'}
          </h2>
          {avgVehicleWait !== null && !loadingHistory && (
            <span className="text-xs text-gray-400">
              {es ? `promedio hoy: ${avgVehicleWait} min` : `avg today: ${avgVehicleWait} min`}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center p-3 bg-gray-50 rounded-xl">
            <span className="text-xs text-gray-500 mb-1">{es ? 'Vehículo' : 'Passenger Vehicle'}</span>
            <WaitBadge minutes={port.vehicle} label="" />
            {port.vehicleLanesOpen !== null && (
              <span className="text-xs text-gray-400 mt-1">
                {es ? `${port.vehicleLanesOpen} carriles abiertos` : `${port.vehicleLanesOpen} lanes open`}
              </span>
            )}
          </div>
          <div className="flex flex-col items-center p-3 bg-gray-50 rounded-xl">
            <span className="text-xs text-gray-500 mb-1">SENTRI / Ready Lane</span>
            <WaitBadge minutes={port.sentri} label="" />
            {port.sentriLanesOpen !== null && (
              <span className="text-xs text-gray-400 mt-1">
                {es ? `${port.sentriLanesOpen} carriles abiertos` : `${port.sentriLanesOpen} lanes open`}
              </span>
            )}
          </div>
        </div>

        {/* SENTRI enrollment nudge — show when SENTRI is at least 10 min faster than car lane */}
        {port.sentri !== null && port.vehicle !== null && port.vehicle - port.sentri >= 10 && (
          <div className="mt-4 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                {es ? `SENTRI te ahorraría ~${port.vehicle - port.sentri} min aquí` : `SENTRI saves you ~${port.vehicle - port.sentri} min at this crossing`}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
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
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Last 24 Hours</h2>
        {loadingHistory ? (
          <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Not enough data yet. Check back after a few hours.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10 }} unit=" min" width={45} />
              <Tooltip
                formatter={(value) => [`${value} min`, '']}
                contentStyle={{ fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="vehicle"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Vehicle"
              />
              <Line
                type="monotone"
                dataKey="pedestrian"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="Pedestrian"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        <div className="flex gap-4 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> Vehicle</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 inline-block" /> Pedestrian</span>
        </div>
      </div>

      {/* AI Predictions — Pro+ only */}
      {canAccess(tier, 'ai_predictions') ? (
        predictionChartData.length > 0 && (() => {
          const nowLabel = predictionChartData[0]?.time
          const nowWait = predictionChartData[0]?.predicted as number | null
          const waitColor = nowWait == null ? '#6b7280' : nowWait <= 20 ? '#22c55e' : nowWait <= 45 ? '#f59e0b' : '#ef4444'
          return (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">Historical Patterns – Next 24 Hours</h2>
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Beta</span>
              </div>

              {/* Estimated wait now */}
              {nowWait != null && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl" style={{ backgroundColor: `${waitColor}18`, border: `1px solid ${waitColor}40` }}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: waitColor }} />
                  <span className="text-xs font-medium text-gray-700">
                    Estimated wait now: <span className="font-bold" style={{ color: waitColor }}>{nowWait} min</span>
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
          <p className="text-sm font-semibold text-purple-800">🤖 AI Wait Predictions</p>
          <p className="text-xs text-purple-600 mt-1 mb-3">See predicted wait times for the next 24 hours. Pro feature.</p>
          <Link href="/pricing" className="inline-block bg-purple-600 text-white text-xs font-medium px-4 py-2 rounded-full hover:bg-purple-700 transition-colors">
            Upgrade to Pro →
          </Link>
        </div>
      )}

      {/* Best times today — Pro+ only */}
      {canAccess(tier, 'ai_predictions') && bestTimes.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Best Times Today <span className="text-gray-400 font-normal">(based on history)</span>
          </h2>
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

      {/* Driver reports feed */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Driver Reports</h2>
        <ReportsFeed portId={portId} refresh={reportRefresh} />
      </div>

      {/* Submit report */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Submit a Report</h2>
        <ReportForm portId={portId} onSubmitted={() => setReportRefresh(r => r + 1)} />
      </div>

      {/* Guest alert CTA */}
      {!user && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
          <p className="text-sm font-semibold text-blue-800">
            {es ? '🔔 Avísame cuando baje la espera' : '🔔 Get notified when wait drops'}
          </p>
          <p className="text-xs text-blue-600 mt-1">
            {es
              ? 'Crea una cuenta gratis — luego activa alertas con Pro por $2.99/mes.'
              : 'Create a free account — then get Pro alerts for $2.99/mo.'}
          </p>
          <a
            href="/signup"
            className="inline-block mt-3 bg-blue-600 text-white text-sm font-medium px-5 py-2 rounded-full hover:bg-blue-700 transition-colors"
          >
            {es ? 'Crear cuenta gratis →' : 'Create free account →'}
          </a>
        </div>
      )}
    </div>
  )
}
