'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { usePushNotifications } from '@/lib/usePushNotifications'
import { InstallGuide } from '@/components/InstallGuide'
import { PushPermissionPrompt } from '@/components/PushPermissionPrompt'
import { getPortMeta } from '@/lib/portMeta'
import { haversineKm } from '@/lib/geo'
import { createClient } from '@/lib/auth'
import { isIosSafari, isPwaInstalled } from '@/lib/iosDetect'
import type { PortWaitTime } from '@/types'

// Forced activation flow. Every new signup lands here before the dashboard.
// Single mandatory step: pick ONE bridge to get alerts for. No skip button,
// no "later". This is the Cialdini consistency hook that 2x's retention.
//
// The user is:
//   1. Shown their nearest 6 bridges (via geolocation if granted,
//      else a regional list based on megaRegion)
//   2. Forced to tap one to continue
//   3. That tap creates:
//        - A saved crossing for that bridge
//        - An alert preference with threshold 30 min
//   4. Then redirected to /dashboard with a one-time celebration toast

function WelcomeInner() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useSearchParams()
  const { lang } = useLang()
  const es = lang === 'es'
  const { supported: pushSupported, subscribe: subscribePush } = usePushNotifications()

  const [ports, setPorts] = useState<PortWaitTime[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [geoTried, setGeoTried] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Two-step flow — REVERSED 2026-04-14 per PWA funnel audit.
  //   Step 1: INSTALL + claim Pro (carrot: "3 months Pro FREE")
  //   Step 2: Pick a bridge + set an alert (soft mandatory)
  //
  // Previously the order was alert-first, install-second — which meant
  // any user who bailed on the alert step never saw the install offer,
  // and the Pro carrot only appeared on step 2 so step-1 abandoners
  // never heard about it. Now the user gets the biggest carrot first,
  // commits to the install, and step 2 (alert setup) becomes the easy
  // followup because they've already "won" something.
  const [step, setStep] = useState<1 | 2>(1)
  const [alertedPortName, setAlertedPortName] = useState<string>('')

  // iOS Safari non-installed redirect — send authenticated iOS Safari
  // users to /ios-install, the dedicated 3-tap Safari-only walkthrough.
  // Funnel data 2026-04-17: iOS is 2× Android in registered users but
  // iOS users mostly fail the generic install carrot on step 1. A
  // Safari-specific page converts far better.
  //
  // Change 2026-04-18: only redirect once the user advances past step 1.
  // Showing step 1 first lets iOS users see the 3-month Pro carrot — our
  // biggest hook — before we punt them to the install flow. Also honors
  // the `cruzar_ios_install_skipped` flag so users who tapped "Skip for
  // now" on /ios-install aren't looped back.
  //
  // Preserves ?next= so after install the user still lands where they
  // were headed. Android/desktop continue through the normal flow.
  useEffect(() => {
    if (authLoading || !user) return
    if (typeof window === 'undefined') return
    if (window.location.pathname === '/ios-install') return
    if (!isIosSafari()) return
    if (isPwaInstalled()) return
    if (step !== 2) return
    try {
      if (sessionStorage.getItem('cruzar_ios_install_skipped') === '1') return
    } catch { /* ignore */ }
    const next = params?.get('next')
    const dest = next
      ? `/ios-install?next=${encodeURIComponent(next)}`
      : '/ios-install'
    router.replace(dest)
  }, [user, authLoading, router, params, step])

  // Redirect guests to signup
  useEffect(() => {
    if (!authLoading && !user) {
      const next = params?.get('next') || '/welcome'
      router.replace(`/signup?next=${encodeURIComponent(next)}`)
    }
  }, [user, authLoading, router, params])

  // Reversed-step routing logic — matches the new order.
  //
  //   - Already running standalone → they installed already. Check if
  //     they also already have an alert; if yes skip welcome and jump
  //     to /dashboard. Otherwise jump to step 2 (pick a bridge).
  //   - Not standalone → stay on step 1 (install + claim Pro).
  //
  // On /api/alerts failure we retry once, then default to step 2 for
  // already-standalone users rather than misrouting back to step 1.
  useEffect(() => {
    if (!user) return
    const isStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true)

    if (!isStandalone) return

    const check = async (attempt = 0): Promise<void> => {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 4000)
        const res = await fetch('/api/alerts', { signal: controller.signal })
        clearTimeout(timer)
        if (!res.ok) throw new Error(`status ${res.status}`)
        const data = await res.json()
        const hasAlert = data?.alerts && data.alerts.length > 0
        if (hasAlert) {
          router.replace('/dashboard')
        } else {
          setStep(2)
        }
      } catch {
        if (attempt < 1) {
          setTimeout(() => check(attempt + 1), 1200)
          return
        }
        // Retry failed — they're standalone, go to step 2 anyway so
        // they land on the bridge picker instead of the install flow.
        setStep(2)
      }
    }
    check()
  }, [user, router])

  // Request geolocation — non-blocking, 4s timeout
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoTried(true)
      return
    }
    const timer = setTimeout(() => setGeoTried(true), 4500)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer)
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoTried(true)
      },
      () => {
        clearTimeout(timer)
        setGeoTried(true)
      },
      { maximumAge: 5 * 60 * 1000, timeout: 4000, enableHighAccuracy: false }
    )
    return () => clearTimeout(timer)
  }, [])

  // Fetch ports list. Hardened with a 6s abort signal so the welcome
  // step never hangs on "Buscando puentes…" forever if /api/ports is
  // slow — another common cause of the post-signup "stuck loading"
  // symptom Diego reported on 2026-04-14.
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    fetch('/api/ports', { cache: 'no-store', signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setPorts(data.ports || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
      .finally(() => clearTimeout(timer))
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [])

  async function confirm() {
    if (!selected || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      // Save as favorite crossing
      await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portId: selected }),
      }).catch(() => {})

      // Create alert with default threshold
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portId: selected,
          laneType: 'vehicle',
          thresholdMinutes: 30,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || (es ? 'No pudimos guardar tu alerta — intenta otra vez' : 'Could not save your alert — try again'))
        setSubmitting(false)
        return
      }

      // Trigger push permission prompt RIGHT HERE — this is the only
      // moment a browser will accept the request, because it must be
      // tied to a user gesture. Without this step, the alert we just
      // created can only deliver via email (no vibration on phone).
      // If the user denies, we still proceed — email still works.
      if (pushSupported) {
        try { await subscribePush() } catch { /* non-blocking */ }
      }

      // Stash port name for downstream UI
      const chosenPort = ports.find((p) => p.portId === selected)
      if (chosenPort) {
        setAlertedPortName(chosenPort.localNameOverride || chosenPort.portName || '')
      }

      // Derive home_region from the bridge they committed to — this
      // fixes the 88% "home_region unset" leak I found in the admin
      // dashboard 2026-04-15. If they pick Hidalgo, they're RGV. If
      // they pick Laredo II, they're Laredo. Silent, automatic, no
      // extra UI friction. On return visits the home page PortList
      // scopes to this region by default.
      try {
        const meta = getPortMeta(selected)
        if (meta?.megaRegion && user) {
          const supabase = createClient()
          await supabase
            .from('profiles')
            .update({ home_region: meta.megaRegion })
            .eq('id', user.id)
        }
      } catch {
        /* non-blocking — home region is a nice-to-have, not critical */
      }

      // First-1000 launch promo: claim 3 months of Pro access as part
      // of the welcome flow. No-op if the user already has it, or if
      // the 1000 cap is reached. Non-blocking — we still navigate to
      // dashboard even if the claim fails.
      fetch('/api/promo/claim-first-1000', { method: 'POST' }).catch(() => { /* silent */ })

      // The reversal means bridge-pick is now the FINAL welcome step.
      // Navigate straight to /dashboard after successful alert setup.
      //
      // Alert-count-aware fallback: if the alert POST succeeded the user
      // now has >= 1 alert, so the plain /dashboard?welcomed=1 fallback
      // is correct. But for defensive routing (alert creation can fail
      // silently at the DB layer on a retry, and for first-1000 users
      // who were auto-graduated to Pro without the PwaGrantCelebration
      // re-route firing), we sanity-check alert count and drop users
      // straight onto the alerts tab with fromWelcome=1 when empty so
      // the dashboard EmptyAlertNudge fires.
      const defaultNext = '/dashboard?welcomed=1'
      let next = params?.get('next') || defaultNext
      try {
        const alertsRes = await fetch('/api/alerts', { cache: 'no-store' })
        if (alertsRes.ok) {
          const data = await alertsRes.json()
          const count = Array.isArray(data?.alerts) ? data.alerts.length : 0
          if (count === 0 && !params?.get('next')) {
            next = '/dashboard?tab=alerts&fromWelcome=1'
          }
        }
      } catch { /* ignore — fall back to defaultNext */ }
      router.push(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  // Compute the 6 bridges to show:
  //   1. If geolocation available, nearest 6 by haversine distance
  //      against the port's metadata coordinates. Works anywhere on
  //      the border — a user in El Paso sees El Paso bridges, a user
  //      in Tijuana sees Tijuana bridges, not RGV fallback.
  //   2. Otherwise, a representative cross-border set spanning RGV,
  //      Brownsville, Laredo, El Paso, Tijuana, and Mexicali so
  //      unknown-location users still see their region if they pick.
  const displayPorts = (() => {
    const open = ports.filter((p) => !p.isClosed && p.vehicle != null)
    if (open.length === 0) return []
    if (userLoc) {
      const withDist = open
        .map((p) => {
          const meta = getPortMeta(p.portId)
          if (!meta.lat || !meta.lng) return null
          return {
            port: p,
            dist: haversineKm(userLoc.lat, userLoc.lng, meta.lat, meta.lng),
          }
        })
        .filter((x): x is { port: PortWaitTime; dist: number } => x !== null)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 6)
        .map((x) => x.port)
      if (withDist.length >= 3) return withDist
      // If portMeta coverage was sparse, fall through to the default set
    }
    // Cross-border default set — one representative bridge per major
    // crossing region so a user anywhere can recognize theirs.
    const priority = [
      '230501', // Hidalgo (RGV)
      '535504', // Brownsville Gateway
      '230401', // Laredo I
      '240201', // El Paso
      '250401', // San Ysidro (Tijuana)
      '250301', // Calexico East (Mexicali)
    ]
    const priorityPorts = priority
      .map((id) => open.find((p) => p.portId === id))
      .filter(Boolean) as PortWaitTime[]
    if (priorityPorts.length >= 6) return priorityPorts
    return [...priorityPorts, ...open.filter((p) => !priority.includes(p.portId))].slice(0, 6)
  })()

  if (authLoading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">{es ? 'Cargando…' : 'Loading…'}</p>
      </main>
    )
  }

  // Step 1 — INSTALL + claim Pro (the reversal).
  // This is the biggest carrot Cruzar offers, so it's the first thing
  // a new signed-up user sees. Pro is framed as the hero reward, not
  // a sweetener. Once they install, step 2 asks for their bridge —
  // much easier to get there because they've already "won" something.
  if (step === 1) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-500 via-orange-600 to-pink-700 text-white">
        <div className="max-w-lg mx-auto px-5 py-10">
          <div className="text-center mb-6 cruzar-rise">
            <p className="text-4xl mb-2">🎁</p>
            <h1 className="text-2xl sm:text-3xl font-black leading-tight">
              {es ? '3 meses de Pro, gratis' : '3 months of Pro, free'}
            </h1>
            <p className="text-sm text-amber-100 mt-3 font-semibold leading-relaxed">
              {es
                ? 'Agrega Cruzar a tu pantalla de inicio y te damos Pro automático por 3 meses — sin tarjeta, sin trucos.'
                : 'Add Cruzar to your home screen and you get Pro automatically for 3 months — no card, no tricks.'}
            </p>
          </div>

          <div className="bg-white/15 backdrop-blur-sm border border-white/25 rounded-2xl px-4 py-3 mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-100 mb-1.5">
              {es ? 'Lo que desbloqueas' : 'What you unlock'}
            </p>
            <ul className="space-y-1">
              {[
                { es: 'Alertas push cuando tu puente baja de 30 min', en: 'Push alerts when your bridge drops below 30 min' },
                { es: 'Cámaras en vivo de los puentes', en: 'Live bridge cameras' },
                { es: 'Mejor hora pa\' cruzar basado en tus datos', en: 'Best hour to cross based on your data' },
                { es: 'Optimizador de ruta + predicciones por hora', en: 'Route optimizer + hourly predictions' },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-white leading-snug">
                  <span className="text-amber-200 mt-0.5">✓</span>
                  <span>{es ? item.es : item.en}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-3xl p-5 shadow-2xl">
            <InstallGuide />
          </div>

          <p className="mt-4 text-[11px] text-amber-100/90 text-center leading-relaxed">
            {es
              ? '10 segundos pa\' agregarlo. Después escoges tu puente y listo.'
              : '10 seconds to add it. Then pick your bridge and you are in.'}
          </p>

          <div className="mt-5 text-center">
            <button
              onClick={() => {
                const msg = es
                  ? '¿Seguro? Pierdes los 3 meses de Pro gratis. Esta oferta no regresa.'
                  : "Sure? You'll lose the 3 months of free Pro. This offer doesn't come back."
                if (typeof window !== 'undefined' && window.confirm(msg)) {
                  setStep(2)
                }
              }}
              className="text-xs text-amber-200/80 hover:text-amber-100 underline underline-offset-2"
            >
              {es ? 'Lo haré después (saltarme los 3 meses)' : "I'll do it later (skip the 3 months)"}
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-600 via-indigo-700 to-purple-800 text-white">
      <div className="max-w-lg mx-auto px-5 py-10">
        <div className="text-center mb-8 cruzar-rise">
          <p className="text-3xl mb-2">🙌</p>
          <h1 className="text-3xl font-black leading-tight">
            {es ? 'Entraste' : "You're in"}
          </h1>
          <p className="text-base text-blue-100 mt-2 font-medium">
            {es
              ? 'Una pregunta pa\' arrancar: ¿cuál es tu puente?'
              : 'One quick question: which bridge is yours?'}
          </p>
          <p className="text-xs text-blue-200 mt-1.5 leading-relaxed">
            {es
              ? 'Te avisamos cuando la espera baje de 30 min pa\' que sepas cuándo salir.'
              : "We'll ping you when the wait drops below 30 min so you know when to leave."}
          </p>
        </div>

        {loading && (
          <p className="text-center text-sm text-blue-100">{es ? 'Buscando puentes…' : 'Finding bridges…'}</p>
        )}

        {!loading && displayPorts.length === 0 && (
          <p className="text-center text-sm text-blue-100">
            {es ? 'No pudimos cargar los puentes ahorita. Intenta de nuevo.' : "Couldn't load bridges right now. Try again."}
          </p>
        )}

        <div className="space-y-2">
          {displayPorts.map((p, i) => {
            const isSelected = selected === p.portId
            const waitLabel = p.vehicle == null ? '—' : p.vehicle === 0 ? '<1 min' : `${p.vehicle} min`
            const waitColor =
              p.vehicle == null ? 'text-gray-300'
                : p.vehicle <= 20 ? 'text-green-300'
                : p.vehicle <= 45 ? 'text-yellow-300'
                : 'text-red-300'
            return (
              <button
                key={p.portId}
                onClick={() => setSelected(p.portId)}
                className={`cruzar-rise w-full flex items-center justify-between gap-3 px-4 py-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                  isSelected
                    ? 'bg-white text-gray-900 border-white shadow-2xl'
                    : 'bg-white/10 backdrop-blur-sm text-white border-white/30 hover:bg-white/20'
                }`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-base font-bold leading-tight truncate">
                    {p.crossingName || p.portName}
                    {p.localNameOverride && (
                      <span className={`ml-1.5 font-normal ${isSelected ? 'text-gray-500' : 'text-blue-200'}`}>
                        · {p.localNameOverride}
                      </span>
                    )}
                  </p>
                  <p className={`text-[11px] truncate ${isSelected ? 'text-gray-500' : 'text-blue-200'}`}>
                    {p.portName}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-xl font-black tabular-nums ${isSelected ? 'text-gray-900' : waitColor}`}>
                    {waitLabel}
                  </p>
                  {isSelected && (
                    <p className="text-[10px] text-green-600 font-bold uppercase">{es ? '✓ Elegido' : '✓ Picked'}</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-200 text-center">{error}</p>
        )}

        <div className="mt-6 sticky bottom-4">
          <button
            onClick={confirm}
            disabled={!selected || submitting}
            className="w-full py-4 bg-white text-indigo-700 text-base font-black rounded-2xl shadow-2xl disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
          >
            {submitting
              ? (es ? 'Activando…' : 'Activating…')
              : selected
                ? (es ? 'Activar mi alerta →' : 'Activate my alert →')
                : (es ? 'Escoge un puente arriba' : 'Pick a bridge above')}
          </button>
          <p className="mt-2 text-[11px] text-center text-blue-200 leading-relaxed">
            {es
              ? 'Te mandaremos una notificación al teléfono cuando la espera baje. Puedes cambiarlo o cancelarlo cuando quieras.'
              : "We'll send a push to this phone when the wait drops. You can change or cancel anytime."}
          </p>
        </div>
      </div>
    </main>
  )
}

export default function WelcomePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-blue-600" />}>
      <WelcomeInner />
    </Suspense>
  )
}
