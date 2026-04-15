'use client'

import { useEffect, useState } from 'react'
import { X, Smartphone, Bell } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { detectOs, detectInstallState } from '@/lib/detectClient'

// Push-install gate — modal that fires when a user tries to enable
// an alert / push notification / any feature that genuinely requires
// the PWA installed. Walks them through the platform-specific install
// steps, then dismisses so the caller can retry the action.
//
// Why this exists: Diego 2026-04-15 — PWA installs were flat because
// casual users had no reason to install. Push notifications technically
// require the app to be added to home screen on iOS (Apple doesn't
// deliver web push to non-standalone Safari tabs). This modal turns
// "install the app" into the user's choice, not a generic banner.
//
// Usage pattern:
//   const [gate, showGate] = useInstallGate()
//   async function enableAlerts() {
//     if (!isInstalled()) { showGate('alerts'); return }
//     // ...actually enable alerts
//   }
//   return <>{gate}<Button onClick={enableAlerts}>...</Button></>

export type InstallGateReason = 'alerts' | 'push' | 'favorites' | 'circle'

interface Props {
  open: boolean
  reason: InstallGateReason
  onClose: () => void
}

export function InstallGateModal({ open, reason, onClose }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [os, setOs] = useState<ReturnType<typeof detectOs>>('other')

  useEffect(() => {
    if (open) setOs(detectOs())
  }, [open])

  if (!open) return null

  const reasonCopy = {
    alerts: {
      es: 'Pa\' recibir alertas de espera en tu teléfono',
      en: 'To receive wait-time alerts on your phone',
    },
    push: {
      es: 'Pa\' recibir notificaciones push',
      en: 'To receive push notifications',
    },
    favorites: {
      es: 'Pa\' guardar tus favoritos y acceder rápido',
      en: 'To save your favorites for quick access',
    },
    circle: {
      es: 'Pa\' que tu círculo te avise cuando cruces',
      en: 'To let your circle know when you cross',
    },
  }[reason]

  const steps: { title: string; detail: string }[] =
    os === 'ios'
      ? [
          {
            title: es ? '1. Toca el botón de compartir' : '1. Tap the share button',
            detail: es
              ? 'En Safari, está en la barra de abajo — un cuadro con una flecha hacia arriba.'
              : 'In Safari, it\'s in the bottom bar — a square with an up arrow.',
          },
          {
            title: es ? '2. Desliza hacia abajo' : '2. Scroll down',
            detail: es
              ? 'En el menú que aparece, baja hasta encontrar "Agregar a pantalla de inicio".'
              : 'In the menu, scroll down until you see "Add to Home Screen".',
          },
          {
            title: es ? '3. Toca "Agregar"' : '3. Tap "Add"',
            detail: es
              ? 'Cruzar va a aparecer en tu pantalla de inicio como una app normal.'
              : 'Cruzar will appear on your home screen like any other app.',
          },
        ]
      : os === 'android'
        ? [
            {
              title: es ? '1. Toca el menú (⋮) del navegador' : '1. Tap the browser menu (⋮)',
              detail: es
                ? 'En Chrome, el menú está arriba a la derecha.'
                : 'In Chrome, the menu is at the top right.',
            },
            {
              title: es ? '2. Selecciona "Instalar app"' : '2. Select "Install app"',
              detail: es
                ? 'O "Agregar a pantalla de inicio" si no ves "Instalar app".'
                : 'Or "Add to Home screen" if "Install app" isn\'t shown.',
            },
            {
              title: es ? '3. Confirma "Instalar"' : '3. Confirm "Install"',
              detail: es
                ? 'Cruzar va a aparecer en tu home y en tu cajón de apps.'
                : 'Cruzar will show up on your home screen and in your app drawer.',
            },
          ]
        : [
            {
              title: es ? '1. Abre Cruzar en tu teléfono' : '1. Open Cruzar on your phone',
              detail: es
                ? 'Las alertas push no funcionan en escritorio. Usa tu iPhone o Android.'
                : 'Push alerts don\'t work on desktop. Use your iPhone or Android phone.',
            },
          ]

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white px-6 pt-6 pb-5 relative">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            aria-label={es ? 'Cerrar' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
          <div className="relative flex items-start gap-3">
            <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
              {reason === 'alerts' || reason === 'push'
                ? <Bell className="w-6 h-6 text-white" />
                : <Smartphone className="w-6 h-6 text-white" />}
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">
                {es ? 'Instala Cruzar primero' : 'Install Cruzar first'}
              </p>
              <h2 className="text-lg font-black leading-tight mt-0.5">
                {es ? reasonCopy.es : reasonCopy.en}
              </h2>
            </div>
          </div>
          <p className="text-xs text-blue-100/90 mt-3 leading-snug relative">
            {es
              ? 'Las alertas solo funcionan cuando Cruzar está en tu pantalla de inicio — así tu teléfono nos deja mandarte avisos en segundo plano.'
              : "Alerts only work when Cruzar is on your home screen — that's how your phone lets us notify you in the background."}
          </p>
        </div>

        <ol className="px-6 py-5 space-y-4">
          {steps.map((s, i) => (
            <li key={i}>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">
                {s.title}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                {s.detail}
              </p>
            </li>
          ))}
        </ol>

        <div className="px-6 pb-6 space-y-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-bold py-3 rounded-2xl active:scale-[0.98] transition-transform"
          >
            {es ? 'Entendido' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Small hook for callers — tracks open state + reason.
export function useInstallGate() {
  const [state, setState] = useState<{ open: boolean; reason: InstallGateReason }>({ open: false, reason: 'alerts' })
  const show = (reason: InstallGateReason) => setState({ open: true, reason })
  const close = () => setState((s) => ({ ...s, open: false }))
  return { state, show, close }
}

// Helper used by callers to decide whether to gate.
export function needsInstallGate(): boolean {
  if (typeof window === 'undefined') return false
  return detectInstallState() === 'web'
}
