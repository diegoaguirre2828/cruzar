'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/auth'
import { useAuth } from '@/lib/useAuth'
import { getWaitLevel, waitLevelDot } from '@/lib/cbp'
import { WaitBadge } from '@/components/WaitBadge'
import { useLang } from '@/lib/LangContext'
import { Bell, Star, LogOut, ArrowLeft, Plus, Trash2, Route, Settings, Lock, Navigation, Building2, User } from 'lucide-react'
import { PushToggle } from '@/components/PushToggle'
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
  const { t } = useLang()
  const [ports, setPorts] = useState<PortWaitTime[]>([])
  const [saved, setSaved] = useState<SavedCrossing[]>([])
  const [alerts, setAlerts] = useState<AlertPref[]>([])
  const [tab, setTab] = useState<'crossings' | 'alerts' | 'route'>('crossings')
  const [newAlertPortId, setNewAlertPortId] = useState('')
  const [newAlertThreshold, setNewAlertThreshold] = useState(20)
  const [newAlertPhone, setNewAlertPhone] = useState('')
  const [newAlertLane, setNewAlertLane] = useState('vehicle')
  const [origin, setOrigin] = useState('McAllen')
  interface RouteResult {
    best: { portId: string; portName: string; crossingName: string; vehicleWait: number | null; commercialWait: number | null; recommendation: string } | null
    alternatives: { portId: string; portName: string; crossingName: string; vehicleWait: number | null }[]
  }
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [tier, setTier] = useState<string>('free')
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false)

  const loadData = useCallback(async () => {
    const [portsRes, savedRes, alertsRes, profileRes] = await Promise.all([
      fetch('/api/ports'),
      fetch('/api/saved'),
      fetch('/api/alerts'),
      fetch('/api/profile'),
    ])
    if (portsRes.ok) setPorts((await portsRes.json()).ports || [])
    if (savedRes.ok) setSaved((await savedRes.json()).saved || [])
    if (alertsRes.ok) setAlerts((await alertsRes.json()).alerts || [])
    if (profileRes.ok) {
      const { profile } = await profileRes.json()
      setTier(profile?.tier || 'free')
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
    if (user) loadData()
  }, [user, authLoading, router, loadData])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('upgraded') === 'true') {
        setShowUpgradeBanner(true)
        window.history.replaceState({}, '', '/dashboard')
      }
      // Pre-fill alert form when coming from Smart Crossing Planner
      const tabParam = params.get('tab')
      const portIdParam = params.get('portId')
      const thresholdParam = params.get('threshold')
      if (tabParam === 'alerts') {
        setTab('alerts')
        if (portIdParam) setNewAlertPortId(portIdParam)
        if (thresholdParam) setNewAlertThreshold(Number(thresholdParam))
        window.history.replaceState({}, '', '/dashboard')
      }
    }
  }, [])

  async function removeSaved(portId: string) {
    await fetch(`/api/saved?portId=${portId}`, { method: 'DELETE' })
    setSaved(s => s.filter(x => x.port_id !== portId))
  }

  async function addAlert() {
    if (!newAlertPortId) return
    await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portId: newAlertPortId, laneType: newAlertLane, thresholdMinutes: newAlertThreshold, phone: newAlertPhone || null }),
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

  const isBusiness = tier === 'business'
  const isPro = tier === 'pro' || isBusiness

  if (authLoading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
    </div>
  )

  const ORIGINS = ['McAllen', 'Laredo', 'El Paso', 'San Antonio', 'Houston', 'Dallas', 'Brownsville', 'San Diego', 'Phoenix', 'Tucson']

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-10">

        {/* Header */}
        <div className="pt-6 pb-4 flex items-center justify-between">
          <div>
            <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-1 transition-colors">
              <ArrowLeft className="w-3 h-3" /> {t.allCrossings}
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t.dashboardTitle}</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/account"
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" /> {t.settingsTitle}
            </Link>
            <button
              onClick={signOut}
              className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Business portal shortcut — prominent for business users */}
        {isBusiness && (
          <Link
            href="/business"
            className="flex items-center justify-between bg-blue-600 dark:bg-blue-700 rounded-2xl px-4 py-3.5 mb-4 hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-white" />
              <div>
                <p className="text-sm font-bold text-white">Cruza Business Portal</p>
                <p className="text-xs text-blue-200">{t.businessPortalDesc}</p>
              </div>
            </div>
            <span className="text-white text-lg">→</span>
          </Link>
        )}

        {/* Tier badge */}
        <div className="flex items-center gap-2 mb-4">
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
            isBusiness ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
            isPro ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
            'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}>
            <User className="w-3 h-3" />
            {isBusiness ? 'Business' : isPro ? 'Pro' : 'Free'} Plan
          </div>
          {!isPro && (
            <Link href="/pricing" className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
              {t.upgradeLink}
            </Link>
          )}
        </div>

        {/* Upgrade success banner */}
        {showUpgradeBanner && (
          <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4 flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">{t.welcomePro}</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">{t.welcomeProDesc}</p>
            </div>
            <button onClick={() => setShowUpgradeBanner(false)} className="text-green-400 hover:text-green-600 text-lg leading-none">×</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-5">
          {[
            { key: 'crossings', label: t.savedTab },
            { key: 'alerts',    label: t.alertsTab },
            { key: 'route',     label: t.routeTab },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                tab === t.key
                  ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
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
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                <Star className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t.noSavedCrossings}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t.noSavedHint}</p>
                <Link href="/" className="inline-block mt-4 bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors">
                  {t.browseCrossingsBtn}
                </Link>
              </div>
            ) : (
              savedPorts.map(({ saved: s, port }) => (
                <div key={s.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                  <Link href={`/port/${encodeURIComponent(s.port_id)}`} className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{port?.portName ?? s.port_id}</p>
                        {s.label && <p className="text-xs text-gray-400 dark:text-gray-500">{s.label}</p>}
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500">View →</span>
                    </div>
                    {port && (
                      <div className="flex gap-3 justify-around">
                        {port.vehicle !== null && <WaitBadge minutes={port.vehicle} label="Car" />}
                        {port.sentri !== null && <WaitBadge minutes={port.sentri} label="SENTRI" />}
                        {port.pedestrian !== null && <WaitBadge minutes={port.pedestrian} label="Walk" />}
                        {port.commercial !== null && <WaitBadge minutes={port.commercial} label="Truck" />}
                        {port.vehicle === null && port.sentri === null && port.pedestrian === null && port.commercial === null && (
                          <p className="text-xs text-green-600 dark:text-green-400 py-1">No wait · Low traffic</p>
                        )}
                      </div>
                    )}
                  </Link>
                  <div className="flex border-t border-gray-100 dark:border-gray-700">
                    <a
                      href={`https://www.google.com/maps/search/${encodeURIComponent((port?.portName ?? s.port_id) + ' border crossing')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5" /> {t.directionsBtn}
                    </a>
                    <div className="w-px bg-gray-100 dark:bg-gray-700" />
                    <button
                      onClick={() => removeSaved(s.port_id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> {t.removeBtn}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {tab === 'alerts' && tier === 'free' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center shadow-sm">
            <Lock className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.alertsProLocked}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">{t.alertsProDesc}</p>
            <Link href="/pricing" className="inline-block bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
              {t.upgradeProBtn}
            </Link>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">{t.trialNote}</p>
          </div>
        )}

        {tab === 'alerts' && tier !== 'free' && (
          <div className="space-y-4">
            <PushToggle />
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t.addAlertTitle}</h3>
              <div className="space-y-3">
                <select
                  value={newAlertPortId}
                  onChange={e => setNewAlertPortId(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t.selectCrossing}</option>
                  {ports.map(p => (
                    <option key={p.portId} value={p.portId}>{p.portName} – {p.crossingName}</option>
                  ))}
                </select>
                <select
                  value={newAlertLane}
                  onChange={e => setNewAlertLane(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="vehicle">Passenger Vehicle</option>
                  <option value="sentri">SENTRI / Ready Lane</option>
                  <option value="pedestrian">{t.pedestrianLabel}</option>
                  <option value="commercial">{t.commercialTruck}</option>
                </select>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{t.notifyWhenUnder}</span>
                  <input
                    type="number"
                    value={newAlertThreshold}
                    onChange={e => setNewAlertThreshold(Number(e.target.value))}
                    min={5} max={120}
                    className="w-20 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">min</span>
                </div>
                <input
                  type="tel"
                  value={newAlertPhone}
                  onChange={e => setNewAlertPhone(e.target.value)}
                  placeholder={t.smsPhonePlaceholder}
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 placeholder-gray-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={addAlert}
                  disabled={!newAlertPortId}
                  className="w-full flex items-center justify-center gap-2 bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-gray-700 dark:hover:bg-gray-200 disabled:opacity-40 transition-colors"
                >
                  <Plus className="w-4 h-4" /> {t.addAlertBtn}
                </button>
              </div>
            </div>

            {alerts.length === 0 ? (
              <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-4">{t.noAlertsYet}</p>
            ) : (
              alerts.map(alert => {
                const port = ports.find(p => p.portId === alert.port_id)
                const wait = port?.vehicle ?? null
                const level = getWaitLevel(wait)
                const dot = waitLevelDot(level)
                return (
                  <div key={alert.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${dot}`} />
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {port?.portName ?? alert.port_id}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        Alert when {alert.lane_type} &lt; {alert.threshold_minutes} min
                        {wait !== null && ` · Now: ${wait} min`}
                      </p>
                    </div>
                    <button onClick={() => removeAlert(alert.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Route Optimizer Tab */}
        {tab === 'route' && tier === 'free' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center shadow-sm">
            <Lock className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.routeProLocked}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">{t.routeProDesc}</p>
            <Link href="/pricing" className="inline-block bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
              {t.upgradeProBtn}
            </Link>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">{t.trialNote}</p>
          </div>
        )}

        {tab === 'route' && tier !== 'free' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t.routeTab}</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t.originCityLabel}</label>
                  <select
                    value={origin}
                    onChange={e => setOrigin(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <button
                  onClick={optimizeRoute}
                  disabled={routeLoading}
                  className="w-full bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-gray-700 dark:hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  {routeLoading ? t.findingRoute : t.findBestBtn}
                </button>
              </div>
            </div>

            {routeResult && (
              <div className="space-y-3">
                {routeResult.best && (
                  <Link href={`/port/${encodeURIComponent(routeResult.best.portId)}`}>
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4 hover:shadow-md transition-shadow cursor-pointer">
                      <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">{t.bestOption}</p>
                      <p className="font-bold text-gray-900 dark:text-gray-100">{routeResult.best.portName}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{routeResult.best.crossingName}</p>
                      <p className="text-sm text-green-700 dark:text-green-400 font-medium mt-2">
                        Vehicle: {routeResult.best.vehicleWait !== null ? `${routeResult.best.vehicleWait} min` : 'N/A'}
                        {routeResult.best.commercialWait !== null && ` · Truck: ${routeResult.best.commercialWait} min`}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">{routeResult.best.recommendation}</p>
                    </div>
                  </Link>
                )}
                {routeResult.alternatives?.map((alt, i) => (
                  <Link key={i} href={`/port/${encodeURIComponent(alt.portId)}`}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">{t.alternativeN(i + 2)}</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{alt.portName}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{alt.crossingName}</p>
                      <p className="text-sm text-gray-800 dark:text-gray-200 font-medium mt-1">
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
