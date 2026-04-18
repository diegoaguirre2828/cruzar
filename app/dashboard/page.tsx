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
import { PushPermissionPrompt } from '@/components/PushPermissionPrompt'
import { PortSearch } from '@/components/PortSearch'
import { DashboardInstallBanner } from '@/components/DashboardInstallBanner'
import { PostWelcomeTour } from '@/components/PostWelcomeTour'
import { FoundingMemberBadge } from '@/components/FoundingMemberBadge'
import { trackEvent } from '@/lib/trackEvent'
import { PostUpgradeTour } from '@/components/PostUpgradeTour'
import { InstallGateModal, useInstallGate, needsInstallGate } from '@/components/InstallGateModal'
import { isIosSafari, isPwaInstalled } from '@/lib/iosDetect'
import { usePushNotifications } from '@/lib/usePushNotifications'
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
  const { t, lang } = useLang()
  const es = lang === 'es'
  const [ports, setPorts] = useState<PortWaitTime[]>([])
  const [saved, setSaved] = useState<SavedCrossing[]>([])
  const [alerts, setAlerts] = useState<AlertPref[]>([])
  const [tab, setTab] = useState<'crossings' | 'alerts' | 'route' | 'circle'>('crossings')
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
  const [badges, setBadges] = useState<string[]>([])
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false)
  const [pushBannerDismissed, setPushBannerDismissed] = useState(false)
  const [pushJustEnabled, setPushJustEnabled] = useState(false)
  const [alertLimitHit, setAlertLimitHit] = useState(false)
  const installGate = useInstallGate()

  const loadData = useCallback(async () => {
    // First, reconcile the DB tier against Stripe reality. This is the
    // self-healing path that fixes missed webhooks (so a paid user never
    // sees "Free Plan" just because the webhook dropped).
    try {
      await fetch('/api/profile/sync-tier', { method: 'POST', cache: 'no-store' })
    } catch { /* non-fatal */ }

    const [portsRes, savedRes, alertsRes, profileRes] = await Promise.all([
      fetch('/api/ports'),
      fetch('/api/saved'),
      fetch('/api/alerts'),
      fetch('/api/profile', { cache: 'no-store' }),
    ])
    if (portsRes.ok) setPorts((await portsRes.json()).ports || [])
    if (savedRes.ok) setSaved((await savedRes.json()).saved || [])
    if (alertsRes.ok) setAlerts((await alertsRes.json()).alerts || [])
    if (profileRes.ok) {
      const { profile } = await profileRes.json()
      setTier(profile?.tier || 'free')
      setBadges(profile?.badges || [])
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
    if (user) loadData()
  }, [user, authLoading, router, loadData])

  // iOS Safari non-installed redirect — send authenticated iOS Safari
  // users to the dedicated /ios-install walkthrough. Same rationale as
  // /welcome: the generic DashboardInstallBanner under-performs on iOS.
  // Preserves current path via ?next= so they land back on /dashboard
  // once installed. Android keeps the existing banner flow.
  useEffect(() => {
    if (authLoading || !user) return
    if (typeof window === 'undefined') return
    if (window.location.pathname === '/ios-install') return
    if (!isIosSafari()) return
    if (isPwaInstalled()) return
    // Bypass redirect if the user explicitly tapped "Skip for now" on
    // /ios-install this session. Without this check, iOS users are
    // trapped in a dashboard → ios-install → dashboard loop because
    // isIosSafari()+!isPwaInstalled() still evaluates true after skip.
    try {
      if (sessionStorage.getItem('cruzar_ios_install_skipped') === '1') return
    } catch { /* ignore */ }
    router.replace(`/ios-install?next=${encodeURIComponent('/dashboard')}`)
  }, [user, authLoading, router])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('upgraded') === 'true') {
        setShowUpgradeBanner(true)
        window.history.replaceState({}, '', '/dashboard')
        // The Stripe webhook may not have fired yet when we redirect back.
        // Poll /api/profile for up to 15 s until tier flips, then refresh
        // all page state. Without this, the page shows 'Free Plan' badges
        // and upgrade CTAs even though the user just paid.
        ;(async () => {
          for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 500))
            try {
              const res = await fetch('/api/profile', { cache: 'no-store' })
              if (!res.ok) continue
              const data = await res.json()
              const newTier = data?.profile?.tier
              if (newTier && newTier !== 'free') {
                setTier(newTier)
                setBadges(data?.profile?.badges || [])
                // Also refresh alerts / saved in case the upgrade unlocked features
                loadData()
                return
              }
            } catch { /* retry */ }
          }
        })()
      }
      // Push nudge dismiss state
      if (localStorage.getItem('cruzar_push_nudge_dismissed') === '1') {
        setPushBannerDismissed(true)
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
      } else if (tabParam === 'circle' || tabParam === 'route' || tabParam === 'crossings') {
        setTab(tabParam)
        window.history.replaceState({}, '', '/dashboard')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function removeSaved(portId: string) {
    await fetch(`/api/saved?portId=${portId}`, { method: 'DELETE' })
    setSaved(s => s.filter(x => x.port_id !== portId))
  }

  async function addAlert() {
    if (!newAlertPortId) return
    // Push-install gate — alerts only actually deliver on PWA-installed
    // phones (push notifications require standalone mode on iOS and
    // work unreliably in desktop Chrome tabs). Intercept the flow with
    // the install walkthrough BEFORE writing the alert row, so users
    // don't create silent alerts that never fire.
    //
    // iOS Safari users get routed to the dedicated /ios-install page
    // instead of the generic modal — the 3-tap Safari-specific flow
    // converts much better than a cross-platform modal.
    if (needsInstallGate()) {
      if (isIosSafari() && !isPwaInstalled()) {
        const here = typeof window !== 'undefined' ? window.location.pathname : '/dashboard'
        router.push(`/ios-install?next=${encodeURIComponent(here)}`)
        return
      }
      installGate.show('alerts')
      return
    }
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portId: newAlertPortId, laneType: newAlertLane, thresholdMinutes: newAlertThreshold, phone: newAlertPhone || null }),
    })
    if (!res.ok) {
      const data = await res.json()
      if (data.error === 'free_limit') { setAlertLimitHit(true); return }
    }
    setAlertLimitHit(false)
    trackEvent('alert_created', {
      port_id: newAlertPortId,
      source: 'dashboard',
      lane: newAlertLane,
      threshold: newAlertThreshold,
    })
    // Fuse push permission with alert creation: dispatch a window event
    // so the PushPermissionPrompt surfaces immediately, bypassing the
    // 7-day cooldown and any other gate. Without this pairing the alert
    // is a silent promise that delivers to nothing (the #1 retention bug
    // for the 23/30 Pro-without-push cohort).
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cruzar:alert-created', { detail: { portId: newAlertPortId } }))
    }
    // Also kick the native browser push subscribe flow in the same
    // gesture — the warm-up sheet handles users who prefer the custom
    // prompt, but many taps "Allow" directly on the OS prompt.
    if (pushSupported && !pushSubscribed) {
      try { await pushSubscribe() } catch { /* non-blocking */ }
    }
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
  const { supported: pushSupported, subscribed: pushSubscribed, loading: pushLoading, subscribe: pushSubscribe } = usePushNotifications()

  if (authLoading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
    </div>
  )

  const ORIGINS = ['McAllen', 'Laredo', 'El Paso', 'San Antonio', 'Houston', 'Dallas', 'Brownsville', 'San Diego', 'Phoenix', 'Tucson']

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Post-signup walkthrough for free users — fires once when
          arriving from /welcome?welcomed=1. 4-card tour covering
          saved bridge, alerts, circles, guardian loop. */}
      <PostWelcomeTour />
      {/* Post-upgrade walkthrough for Pro users — fires once when
          returning from a successful Stripe checkout (?upgraded=pro).
          Full feature surface: alerts, cameras, best-time, history,
          route optimizer, weekly digest. */}
      <PostUpgradeTour />
      {/* Push-install gate — fires when a user tries to add an alert
          and they're not in a standalone PWA. Walks them through the
          iOS/Android install steps. */}
      <InstallGateModal
        open={installGate.state.open}
        reason={installGate.state.reason}
        onClose={installGate.close}
      />
      <div className="max-w-lg mx-auto px-4 pb-10">

        {/* Header */}
        <div className="pt-6 pb-4 flex items-center justify-between">
          <div>
            <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-1 transition-colors">
              <ArrowLeft className="w-3 h-3" /> {t.allCrossings}
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t.dashboardTitle}</h1>
              <FoundingMemberBadge />
            </div>
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

        {/* Install nag — shown to non-standalone users until they install */}
        <DashboardInstallBanner />

        {/* Push permission warm-up. Targets the 23/30 Pro-without-alerts
            cohort: installed users who never granted push so their
            "Pro alerts" can never actually fire on their phone. Renders
            iff push is supported, NOT subscribed, and not dismissed in
            the last 7 days. */}
        <DashboardPushNudgeBlock />

        {/* Business portal shortcut — prominent for business users */}
        {isBusiness && (
          <Link
            href="/business"
            className="flex items-center justify-between bg-blue-600 dark:bg-blue-700 rounded-2xl px-4 py-3.5 mb-4 hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-white" />
              <div>
                <p className="text-sm font-bold text-white">Cruzar Business Portal</p>
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
          {badges.includes('founder') && (
            <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold px-3 py-1.5 rounded-full" title="One of the first 50 Cruzar members — this badge can never be earned again">
              🏅 Fundador
            </div>
          )}
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

        {/* Push nudge — shown to users who have alerts set up but haven't
            enabled phone push notifications yet. Without this, the cron
            generates alerts that deliver to nothing. Back-fills users who
            signed up before the /welcome flow added the push prompt. */}
        {pushSupported && !pushSubscribed && alerts.length > 0 && !pushBannerDismissed && !pushJustEnabled && (
          <div className="mb-4 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-2xl p-4 shadow-lg cruzar-shimmer">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <span className="text-2xl">🔔</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white leading-tight">
                  {es
                    ? 'Tus alertas no te están llegando al teléfono'
                    : "Your alerts aren't reaching your phone"}
                </p>
                <p className="text-[11px] text-blue-100 mt-1 leading-snug">
                  {es
                    ? `Tienes ${alerts.length} ${alerts.length === 1 ? 'alerta activa' : 'alertas activas'} pero no recibes notificaciones. Activa el buzz ahorita.`
                    : `You have ${alerts.length} active ${alerts.length === 1 ? 'alert' : 'alerts'} but no phone buzz. Turn it on now.`}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={async () => {
                      await pushSubscribe()
                      setPushJustEnabled(true)
                      setTimeout(() => setPushJustEnabled(false), 5000)
                    }}
                    disabled={pushLoading}
                    className="bg-white text-indigo-700 text-xs font-black px-4 py-2 rounded-xl hover:bg-blue-50 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {pushLoading
                      ? (es ? 'Activando…' : 'Enabling…')
                      : (es ? '🔔 Activar buzz' : '🔔 Turn on buzz')}
                  </button>
                  <button
                    onClick={() => {
                      setPushBannerDismissed(true)
                      try { localStorage.setItem('cruzar_push_nudge_dismissed', '1') } catch { /* ignore */ }
                    }}
                    className="text-[11px] text-blue-100 hover:text-white font-medium px-2 py-1"
                  >
                    {es ? 'Luego' : 'Later'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Celebration after user enables push */}
        {pushJustEnabled && (
          <div className="mb-4 bg-green-500 text-white rounded-2xl p-4 flex items-center gap-3 cruzar-stamp">
            <span className="text-2xl">✅</span>
            <div>
              <p className="text-sm font-black">
                {es ? '¡Listo! Tu teléfono ya va a vibrar' : "Done! Your phone will buzz now"}
              </p>
              <p className="text-[11px] text-green-50 mt-0.5">
                {es
                  ? 'Te avisaremos cuando tus puentes bajen de tu límite'
                  : "We'll ping you when your bridges drop below your threshold"}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-5">
          {[
            { key: 'crossings', label: t.savedTab },
            { key: 'alerts',    label: t.alertsTab },
            { key: 'route',     label: t.routeTab },
            { key: 'circle',    label: es ? '👥 Mi Gente' : '👥 My People' },
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
                      <span className="text-xs text-gray-400 dark:text-gray-500">{es ? 'Ver →' : 'View →'}</span>
                    </div>
                    {port && (
                      <div className="flex gap-3 justify-around">
                        {port.vehicle !== null && <WaitBadge minutes={port.vehicle} label={es ? 'Auto' : 'Car'} />}
                        {port.sentri !== null && <WaitBadge minutes={port.sentri} label="SENTRI" />}
                        {port.pedestrian !== null && <WaitBadge minutes={port.pedestrian} label={es ? 'A pie' : 'Walk'} />}
                        {port.commercial !== null && <WaitBadge minutes={port.commercial} label={es ? 'Camión' : 'Truck'} />}
                        {port.vehicle === null && port.sentri === null && port.pedestrian === null && port.commercial === null && (
                          <p className="text-xs text-green-600 dark:text-green-400 py-1">{es ? 'Sin espera · Poco tráfico' : 'No wait · Low traffic'}</p>
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
        {tab === 'alerts' && (
          <div className="space-y-4">
            {/* Empty-state alert nudge — fires for Pro/Business users
                who have zero alerts. Alerts are the #1 retention lever;
                this prominent amber/orange banner above the port picker
                puts the CTA front-and-center. Visual cue only — the
                existing port picker below is the action. Tracks a
                shown-event once per mount. */}
            <EmptyAlertNudge
              show={alerts.length === 0 && (tier === 'pro' || tier === 'business')}
              es={es}
              fromWelcome={typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('fromWelcome') === '1'}
            />
            {tier === 'free' && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl px-4 py-3 flex items-center justify-between">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  🔔 {es ? 'Plan gratis incluye 1 alerta' : 'Free plan includes 1 alert'}
                </p>
                <Link href="/pricing" className="text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap ml-3">
                  {es ? 'Ilimitadas →' : 'Unlimited →'}
                </Link>
              </div>
            )}
            {alertLimitHit && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl px-4 py-3">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {es ? '1 alerta gratis usada' : 'Free alert used'}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 mb-2">
                  {es ? 'Sube a Pro para alertas en todos tus puentes.' : 'Upgrade to Pro to monitor all your crossings.'}
                </p>
                <Link href="/pricing" className="inline-block bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl">
                  {es ? 'Ver Pro →' : 'See Pro →'}
                </Link>
              </div>
            )}

            {/* Step 1 — Enable push */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                {es ? 'Paso 1 — Activar notificaciones' : 'Step 1 — Enable notifications'}
              </p>
              {pushSupported ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${pushSubscribed ? 'bg-green-50 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                      <Bell className={`w-4 h-4 ${pushSubscribed ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {pushSubscribed
                          ? (es ? '✅ Notificaciones activadas' : '✅ Notifications enabled')
                          : (es ? 'Activa notificaciones en este teléfono' : 'Enable on this phone')}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {pushSubscribed
                          ? (es ? 'Te avisaremos en este dispositivo' : "We'll alert you on this device")
                          : (es ? 'Sin esto, no recibirás alertas' : 'Required to receive alerts')}
                      </p>
                    </div>
                  </div>
                  {!pushSubscribed && (
                    <button
                      onClick={pushSubscribe}
                      disabled={pushLoading}
                      className="text-xs font-bold px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {pushLoading ? '...' : (es ? 'Activar' : 'Enable')}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {es ? 'Este navegador no soporta notificaciones push. Usa Chrome o Safari en iOS.' : 'This browser does not support push. Use Chrome or Safari on iOS.'}
                </p>
              )}
            </div>

            {/* Step 2 — Set alert */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                {es ? 'Paso 2 — Cuándo avisarte' : 'Step 2 — When to alert you'}
              </p>
              <div className="space-y-3">
                <PortSearch
                  ports={ports}
                  value={newAlertPortId}
                  onChange={setNewAlertPortId}
                  placeholder={t.selectCrossing}
                />
                <select
                  value={newAlertLane}
                  onChange={e => setNewAlertLane(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="vehicle">{es ? 'Vehículo particular' : 'Passenger vehicle'}</option>
                  <option value="sentri">SENTRI · Ready Lane</option>
                  <option value="pedestrian">{es ? 'Peatonal' : 'Pedestrian'}</option>
                  <option value="commercial">{es ? 'Comercial' : 'Commercial'}</option>
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
                <button
                  onClick={addAlert}
                  disabled={!newAlertPortId}
                  className="w-full flex items-center justify-center gap-2 bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-gray-700 dark:hover:bg-gray-200 disabled:opacity-40 transition-colors"
                >
                  <Plus className="w-4 h-4" /> {t.addAlertBtn}
                </button>
                <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                  {es
                    ? '📱 Te mandamos una notificación en este teléfono + correo'
                    : '📱 We\'ll send a push notification to this phone + email'}
                </p>
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
                        {es ? `Alerta cuando ${alert.lane_type} < ${alert.threshold_minutes} min` : `Alert when ${alert.lane_type} < ${alert.threshold_minutes} min`}
                        {wait !== null && (es ? ` · Ahora: ${wait} min` : ` · Now: ${wait} min`)}
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

        {tab === 'circle' && <CircleTab es={es} userId={user?.id ?? null} />}
      </div>
    </main>
  )
}

// ─── Circle tab ─────────────────────────────────────────────────────
// Life360-style trusted group: create a circle, invite family/coworkers
// via link, see members. When any member taps Just Crossed, the others
// get a push notification. Private — not a social feed.

interface CircleMember {
  user_id: string
  role: string
  email: string
  display_name: string | null
  joined_at: string
}
interface Circle {
  id: string
  name: string
  owner_id: string
  is_owner: boolean
  members: CircleMember[]
}

function EmptyAlertNudge({ show, es, fromWelcome }: { show: boolean; es: boolean; fromWelcome: boolean }) {
  useEffect(() => {
    if (!show) return
    trackEvent('alert_nudge_shown', {
      source: 'dashboard_alerts_empty',
      from_welcome: fromWelcome,
    })
  }, [show, fromWelcome])
  if (!show) return null
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-pink-600 p-4 shadow-lg cruzar-shimmer">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-300/30 rounded-full blur-3xl pointer-events-none" />
      <div className="relative">
        <p className="text-base font-black text-white leading-tight">
          {es ? '🔔 No tienes alertas todavía' : "🔔 You haven't set any alerts yet"}
        </p>
        <p className="text-[13px] text-amber-50 mt-1.5 leading-snug">
          {es
            ? 'Cruzar sirve cuando te avisa — elige tu puente abajo y te pingamos cuando baje la espera.'
            : "Cruzar only becomes useful when you get pinged — pick your bridge below and we'll notify you when the wait drops."}
        </p>
      </div>
    </div>
  )
}

function DashboardPushNudgeBlock() {
  const { supported, subscribed } = usePushNotifications()
  const [show, setShow] = useState(false)
  const [source, setSource] = useState<string>('dashboard_nudge')
  useEffect(() => {
    if (!supported || subscribed) { setShow(false); return }
    try {
      const dismissed = localStorage.getItem('cruzar_dash_push_dismissed_at')
      if (dismissed) {
        const ageDays = (Date.now() - parseInt(dismissed, 10)) / (1000 * 60 * 60 * 24)
        if (ageDays < 7) { setShow(false); return }
      }
    } catch {}
    setShow(true)
  }, [supported, subscribed])
  // Force-open on fresh alert creation. The cooldown shouldn't block the
  // single most important moment: the user just committed to an alert
  // and has intent to be notified. See addAlert() for the dispatch.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onAlertCreated = () => {
      if (!supported || subscribed) return
      setSource('alert_created')
      setShow(true)
    }
    window.addEventListener('cruzar:alert-created', onAlertCreated)
    return () => window.removeEventListener('cruzar:alert-created', onAlertCreated)
  }, [supported, subscribed])
  if (!show) return null
  return (
    <div className="mb-4">
      <PushPermissionPrompt
        source={source}
        onDone={(granted) => { if (granted) setShow(false) }}
        onDismiss={() => {
          try { localStorage.setItem('cruzar_dash_push_dismissed_at', String(Date.now())) } catch {}
          setShow(false)
        }}
      />
    </div>
  )
}

function CircleTab({ es, userId }: { es: boolean; userId: string | null }) {
  const [circles, setCircles] = useState<Circle[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({})
  const [inviting, setInviting] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/circles', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setCircles(d.circles || []))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function createCircle() {
    if (!newName.trim() || creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/circles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (res.ok) {
        setNewName('')
        load()
      }
    } finally {
      setCreating(false)
    }
  }

  async function generateInvite(circleId: string) {
    setInviting(circleId)
    try {
      const res = await fetch(`/api/circles/${circleId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.invite_url) {
        setInviteLinks((prev) => ({ ...prev, [circleId]: data.invite_url }))
      }
    } finally {
      setInviting(null)
    }
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url).catch(() => {})
  }

  async function shareLink(url: string, circleName: string) {
    const text = es
      ? `Te agregué a "${circleName}" en Cruzar. Así nos avisamos entre nosotros cuando alguien cruza un puente. Acepta aquí: ${url}`
      : `I added you to "${circleName}" on Cruzar so we can ping each other when someone crosses. Accept here: ${url}`
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try { await navigator.share({ text, url }) } catch { /* cancelled */ }
    } else {
      copyLink(text)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 text-white">
        <p className="text-sm font-bold">
          {es ? '👥 Tu gente de confianza' : '👥 Your trusted people'}
        </p>
        <p className="text-xs text-blue-100 mt-1 leading-relaxed">
          {es
            ? 'Invita a familia o compañeros de trabajo. Cuando alguien cruce un puente, los demás reciben una notificación. Privado, nada público.'
            : "Invite family or coworkers. When someone crosses a bridge, the others get a push notification. Private — nothing public."}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-6">{es ? 'Cargando…' : 'Loading…'}</p>
      ) : circles.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">
            {es ? 'Agrega tu primera gente' : 'Add your first people'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
            {es
              ? 'Dale un nombre — ej: "Familia", "Compañeros", "Mi ruta"'
              : 'Give it a name — e.g. "Family", "Coworkers", "My route"'}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={es ? 'Nombre del grupo' : 'Group name'}
              maxLength={50}
              className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && createCircle()}
            />
            <button
              onClick={createCircle}
              disabled={!newName.trim() || creating}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl disabled:opacity-50"
            >
              {es ? 'Crear' : 'Create'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {circles.map((c) => (
            <div key={c.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="min-w-0">
                  <p className="text-base font-black text-gray-900 dark:text-gray-100 truncate">{c.name}</p>
                  <p className="text-[11px] text-gray-500">
                    {c.members.length} {es ? (c.members.length === 1 ? 'miembro' : 'miembros') : (c.members.length === 1 ? 'member' : 'members')}
                    {c.is_owner && <span className="ml-2 text-blue-600 font-bold">· {es ? 'Dueño' : 'Owner'}</span>}
                  </p>
                </div>
              </div>

              {/* Members list */}
              <div className="space-y-1 mb-3">
                {c.members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-2 text-xs">
                    <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-500">
                      {(m.display_name || m.email || '?').slice(0, 1).toUpperCase()}
                    </div>
                    <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                      {m.display_name || m.email}
                      {m.user_id === userId && <span className="ml-1 text-gray-400">({es ? 'tú' : 'you'})</span>}
                    </span>
                    {m.role === 'owner' && <span className="text-[10px] text-blue-600 font-bold">★</span>}
                  </div>
                ))}
              </div>

              {/* Invite */}
              {inviteLinks[c.id] ? (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    <input
                      type="text"
                      readOnly
                      value={inviteLinks[c.id]}
                      className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-2 text-[11px] font-mono text-gray-600 dark:text-gray-400"
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      onClick={() => copyLink(inviteLinks[c.id])}
                      className="px-3 py-2 bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-xs font-bold rounded-xl"
                    >
                      {es ? 'Copiar' : 'Copy'}
                    </button>
                  </div>
                  <button
                    onClick={() => shareLink(inviteLinks[c.id], c.name)}
                    className="w-full py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl"
                  >
                    {es ? '📲 Compartir por WhatsApp' : '📲 Share via WhatsApp'}
                  </button>
                  <p className="text-[10px] text-gray-400 text-center">
                    {es ? 'El link se puede usar una sola vez' : 'Single-use link'}
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => generateInvite(c.id)}
                  disabled={inviting === c.id}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
                >
                  {inviting === c.id
                    ? (es ? 'Generando…' : 'Generating…')
                    : (es ? '+ Agregar a alguien' : '+ Add someone')}
                </button>
              )}
            </div>
          ))}

          {/* Create additional circle */}
          {circles.length < 3 && (
            <details className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
              <summary className="text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
                {es ? '+ Agregar otro grupo' : '+ Add another group'}
              </summary>
              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={es ? 'Nombre del grupo' : 'Circle name'}
                  maxLength={50}
                  className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2 text-xs"
                />
                <button
                  onClick={createCircle}
                  disabled={!newName.trim() || creating}
                  className="px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl disabled:opacity-50"
                >
                  {es ? 'Crear' : 'Create'}
                </button>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
