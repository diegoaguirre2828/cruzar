'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/auth'
import { useAuth } from '@/lib/useAuth'
import { fetchRgvWaitTimes } from '@/lib/cbp' // We'll use the API instead
import { getPortMeta } from '@/lib/portMeta'
import { getWaitLevel, waitLevelDot } from '@/lib/cbp'
import { WaitBadge } from '@/components/WaitBadge'
import { Bell, Star, LogOut, Map, Plus, Trash2, Route } from 'lucide-react'
import type { PortWaitTime } from '@/types'

interface SavedCrossing {
  id: string
  port_id: string
  label: string | null
}

interface AlertPref {
  id: string
  port_id: string
  lane_type: string
  threshold_minutes: number
  active: boolean
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [ports, setPorts] = useState<PortWaitTime[]>([])
  const [saved, setSaved] = useState<SavedCrossing[]>([])
  const [alerts, setAlerts] = useState<AlertPref[]>([])
  const [tab, setTab] = useState<'crossings' | 'alerts' | 'route'>('crossings')
  const [newAlertPortId, setNewAlertPortId] = useState('')
  const [newAlertThreshold, setNewAlertThreshold] = useState(20)
  const [origin, setOrigin] = useState('McAllen')
  interface RouteResult {
    best: { portId: string; portName: string; crossingName: string; vehicleWait: number | null; commercialWait: number | null; recommendation: string } | null
    alternatives: { portId: string; portName: string; crossingName: string; vehicleWait: number | null }[]
  }
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)

  const loadData = useCallback(async () => {
    const [portsRes, savedRes, alertsRes] = await Promise.all([
      fetch('/api/ports'),
      fetch('/api/saved'),
      fetch('/api/alerts'),
    ])
    if (portsRes.ok) setPorts((await portsRes.json()).ports || [])
    if (savedRes.ok) setSaved((await savedRes.json()).saved || [])
    if (alertsRes.ok) setAlerts((await alertsRes.json()).alerts || [])
  }, [])

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
    if (user) loadData()
  }, [user, authLoading, router, loadData])

  async function removeSaved(portId: string) {
    await fetch(`/api/saved?portId=${portId}`, { method: 'DELETE' })
    setSaved(s => s.filter(x => x.port_id !== portId))
  }

  async function addAlert() {
    if (!newAlertPortId) return
    await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portId: newAlertPortId, laneType: 'vehicle', thresholdMinutes: newAlertThreshold }),
    })
    loadData()
  }

  async function removeAlert(id: string) {
    await fetch(`/api/alerts?id=${id}`, { method: 'DELETE' })
    setAlerts(a => a.filter(x => x.id !== id))
  }

  async function optimizeRoute() {
    setRouteLoading(true)
    const res = await fetch(`/api/route-optimize?origin=${encodeURIComponent(origin)}`)
    setRouteResult(await res.json())
    setRouteLoading(false)
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/')
  }

  const savedPorts = saved.map(s => ({
    saved: s,
    port: ports.find(p => p.portId === s.port_id),
  }))

  if (authLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
    </div>
  )

  const ORIGINS = ['McAllen', 'Laredo', 'El Paso', 'San Antonio', 'Houston', 'Dallas', 'Brownsville', 'San Diego', 'Phoenix', 'Tucson']

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-10">
        {/* Header */}
        <div className="pt-6 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">My Dashboard</h1>
            <p className="text-xs text-gray-400">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">
              <Map className="w-4 h-4" />
            </Link>
            <button onClick={signOut} className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
          {[
            { key: 'crossings', label: '⭐ Saved', icon: Star },
            { key: 'alerts',    label: '🔔 Alerts', icon: Bell },
            { key: 'route',     label: '🗺️ Route',  icon: Route },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Saved Crossings Tab */}
        {tab === 'crossings' && (
          <div className="space-y-3">
            {savedPorts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                <Star className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium">No saved crossings yet</p>
                <p className="text-xs text-gray-400 mt-1">Tap ⭐ on any crossing to save it here</p>
                <Link href="/" className="inline-block mt-4 bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-gray-700 transition-colors">
                  Browse Crossings
                </Link>
              </div>
            ) : (
              savedPorts.map(({ saved: s, port }) => (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <Link href={`/port/${encodeURIComponent(s.port_id)}`} className="font-semibold text-gray-900 text-sm hover:underline">
                        {port?.portName ?? s.port_id}
                      </Link>
                      {s.label && <p className="text-xs text-gray-400">{s.label}</p>}
                    </div>
                    <button onClick={() => removeSaved(s.port_id)} className="text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {port && (
                    <div className="flex gap-3 justify-around">
                      <WaitBadge minutes={port.vehicle} label="Car" />
                      <WaitBadge minutes={port.sentri} label="SENTRI" />
                      <WaitBadge minutes={port.pedestrian} label="Walk" />
                      <WaitBadge minutes={port.commercial} label="Truck" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {tab === 'alerts' && (
          <div className="space-y-4">
            {/* Add alert */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Add Alert</h3>
              <div className="space-y-3">
                <select
                  value={newAlertPortId}
                  onChange={e => setNewAlertPortId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a crossing...</option>
                  {ports.map(p => (
                    <option key={p.portId} value={p.portId}>
                      {p.portName} – {p.crossingName}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 whitespace-nowrap">Notify when under</span>
                  <input
                    type="number"
                    value={newAlertThreshold}
                    onChange={e => setNewAlertThreshold(Number(e.target.value))}
                    min={5} max={120}
                    className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">min</span>
                </div>
                <button
                  onClick={addAlert}
                  disabled={!newAlertPortId}
                  className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Alert
                </button>
              </div>
            </div>

            {/* Active alerts */}
            {alerts.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-4">No alerts set up yet.</p>
            ) : (
              alerts.map(alert => {
                const port = ports.find(p => p.portId === alert.port_id)
                const wait = port?.vehicle ?? null
                const level = getWaitLevel(wait)
                const dot = waitLevelDot(level)
                return (
                  <div key={alert.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${dot}`} />
                        <span className="text-sm font-medium text-gray-900">
                          {port?.portName ?? alert.port_id}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Alert when {alert.lane_type} &lt; {alert.threshold_minutes} min
                        {wait !== null && ` · Now: ${wait} min`}
                      </p>
                    </div>
                    <button onClick={() => removeAlert(alert.id)} className="text-gray-300 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Route Optimizer Tab */}
        {tab === 'route' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Find Best Crossing</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Your origin city (US side)</label>
                  <select
                    value={origin}
                    onChange={e => setOrigin(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <button
                  onClick={optimizeRoute}
                  disabled={routeLoading}
                  className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  {routeLoading ? 'Finding best route...' : '🗺️ Find Best Crossing Now'}
                </button>
              </div>
            </div>

            {routeResult && (
              <div className="space-y-3">
                {routeResult.best && (
                  <Link href={`/port/${encodeURIComponent(routeResult.best.portId)}`}>
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 hover:shadow-md transition-shadow cursor-pointer">
                      <p className="text-xs font-semibold text-green-600 mb-1">✅ BEST OPTION — tap to view</p>
                      <p className="font-bold text-gray-900">{routeResult.best.portName}</p>
                      <p className="text-xs text-gray-600">{routeResult.best.crossingName}</p>
                      <p className="text-sm text-green-700 font-medium mt-2">
                        Vehicle: {routeResult.best.vehicleWait !== null ? `${routeResult.best.vehicleWait} min` : 'N/A'}
                        {routeResult.best.commercialWait !== null && ` · Truck: ${routeResult.best.commercialWait} min`}
                      </p>
                      <p className="text-xs text-green-600 mt-1">{routeResult.best.recommendation}</p>
                    </div>
                  </Link>
                )}

                {routeResult.alternatives?.map((alt, i) => (
                  <Link key={i} href={`/port/${encodeURIComponent(alt.portId)}`}>
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer">
                      <p className="text-xs text-gray-500 mb-1 font-medium">Alternative #{i + 2} — tap to view</p>
                      <p className="font-semibold text-gray-900 text-sm">{alt.portName}</p>
                      <p className="text-xs text-gray-600">{alt.crossingName}</p>
                      <p className="text-sm text-gray-800 font-medium mt-1">
                        Vehicle: {alt.vehicleWait !== null ? `${alt.vehicleWait} min` : 'N/A'}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
