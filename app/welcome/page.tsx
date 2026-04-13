'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { usePushNotifications } from '@/lib/usePushNotifications'
import { InstallGuide } from '@/components/InstallGuide'
import { getPortMeta } from '@/lib/portMeta'
import { haversineKm } from '@/lib/geo'
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
  // Two-step flow — step 1 is picking a bridge + setting an alert, step 2
  // is forced install. On iOS push notifications literally don't work
  // without home-screen install, so we stage the install as the final
  // act of the welcome flow, right when the user is most committed.
  const [step, setStep] = useState<1 | 2>(1)
  const [alertedPortName, setAlertedPortName] = useState<string>('')

  // Redirect guests to signup
  useEffect(() => {
    if (!authLoading && !user) {
      const next = params?.get('next') || '/welcome'
      router.replace(`/signup?next=${encodeURIComponent(next)}`)
    }
  }, [user, authLoading, router, params])

  // If the user already has an alert AND the app is already running as
  // an installed PWA (standalone display-mode), skip the whole welcome
  // flow. If they have an alert but haven't installed, route to step 2
  // directly — they need to finish the install, or their alert can't
  // actually fire on iOS.
  useEffect(() => {
    if (!user) return
    const isStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true)
    fetch('/api/alerts').then((r) => r.json()).then((data) => {
      const hasAlert = data?.alerts && data.alerts.length > 0
      if (hasAlert && isStandalone) {
        router.replace('/dashboard')
      } else if (hasAlert && !isStandalone) {
        setStep(2)
      }
    }).catch(() => {})
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

  // Fetch ports list
  useEffect(() => {
    fetch('/api/ports', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        setPorts(data.ports || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
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
        setError(data.error || 'Could not save your alert — try again')
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

      // Stash the port name for the step 2 copy
      const chosenPort = ports.find((p) => p.portId === selected)
      if (chosenPort) {
        setAlertedPortName(chosenPort.localNameOverride || chosenPort.portName || '')
      }

      // If the user is ALREADY running as a standalone PWA (unusual on
      // first signup but possible), skip step 2 and go to the dashboard.
      // Otherwise stage the install step.
      const isStandalone =
        typeof window !== 'undefined' &&
        (window.matchMedia('(display-mode: standalone)').matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone === true)

      if (isStandalone) {
        const next = params?.get('next') || '/dashboard?welcomed=1'
        router.push(next)
      } else {
        setStep(2)
        setSubmitting(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  function skipInstall() {
    const next = params?.get('next') || '/dashboard?welcomed=1&needs_install=1'
    router.push(next)
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

  // Step 2: forced install page. iOS push literally requires home-screen
  // install to work, so we catch the user here — right after they set
  // their alert, when they're most committed — and make the install the
  // final act. Skip exists but is de-prioritized as a grey link.
  if (step === 2) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-blue-600 via-indigo-700 to-purple-800 text-white">
        <div className="max-w-lg mx-auto px-5 py-10">
          <div className="text-center mb-6 cruzar-rise">
            <p className="text-3xl mb-2">📲</p>
            <h1 className="text-2xl sm:text-3xl font-black leading-tight">
              {es ? 'Una cosa más — o tu alerta no te llega' : "One more thing — or your alert won't reach you"}
            </h1>
            <p className="text-sm text-blue-100 mt-3 font-medium leading-relaxed">
              {es
                ? alertedPortName
                  ? `Guardamos tu alerta de ${alertedPortName}. Pero Apple no deja que te llegue si Cruzar no está en tu pantalla de inicio — ésta es regla de ellos, no nuestra.`
                  : 'Guardamos tu alerta. Pero Apple no deja que te llegue si Cruzar no está en tu pantalla de inicio — es regla de ellos, no nuestra.'
                : alertedPortName
                  ? `Your ${alertedPortName} alert is saved. But Apple won't deliver it unless Cruzar is on your home screen — that's their rule, not ours.`
                  : "Your alert is saved. But Apple won't deliver it unless Cruzar is on your home screen — that's their rule, not ours."}
            </p>
            <p className="text-[11px] text-blue-200 mt-2 leading-relaxed">
              {es ? '10 segundos. Después te llega todo en automático.' : '10 seconds. Then everything flows automatically.'}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-3xl p-5 shadow-2xl">
            <InstallGuide />
          </div>

          {/* Pro sweetener — mentioned but not the headline */}
          <div className="mt-4 bg-amber-400/20 border border-amber-300/40 rounded-2xl px-4 py-3 text-center">
            <p className="text-xs font-bold text-amber-100">
              {es ? '🎁 Bono: 3 meses de Pro GRATIS cuando instales' : '🎁 Bonus: 3 months Pro FREE when you install'}
            </p>
            <p className="text-[10px] text-amber-200 mt-0.5 leading-snug">
              {es
                ? 'Alertas ilimitadas · Mejor hora pa\' cruzar · Optimizador de ruta'
                : 'Unlimited alerts · Best time to cross · Route optimizer'}
            </p>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={skipInstall}
              className="text-xs text-blue-200/70 hover:text-blue-100 underline underline-offset-2"
            >
              {es ? 'Lo haré después (mi alerta puede no llegar)' : 'I\'ll do it later (my alert may not arrive)'}
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
