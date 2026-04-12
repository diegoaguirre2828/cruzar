'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'

interface Props {
  portId: string
  portName: string
  onSubmitted: () => void
  forceShow?: boolean
  onDismiss?: () => void
}

export function JustCrossedPrompt({ portId, portName, onSubmitted, forceShow, onDismiss }: Props) {
  const { user } = useAuth()
  const { lang } = useLang()
  const es = lang === 'es'
  const [show, setShow] = useState(false)
  const [step, setStep] = useState<'ask' | 'time' | 'done'>('ask')
  const [actualMinutes, setActualMinutes] = useState('')
  const [condition, setCondition] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pointsEarned, setPointsEarned] = useState(0)

  useEffect(() => {
    if (forceShow) { setShow(true); return }
    const key = `crossed_${portId}_${new Date().toDateString()}`
    if (sessionStorage.getItem(key)) return
    const timer = setTimeout(() => setShow(true), 45000)
    return () => clearTimeout(timer)
  }, [portId, forceShow])

  async function submit() {
    if (!condition) return
    setSubmitting(true)
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portId,
        condition,
        waitMinutes: actualMinutes ? parseInt(actualMinutes) : null,
        ref: typeof window !== 'undefined' ? localStorage.getItem('cruzar_ref') : null,
      }),
    })
    const data = await res.json()
    setPointsEarned(data.pointsEarned || 0)
    sessionStorage.setItem(`crossed_${portId}_${new Date().toDateString()}`, '1')
    setStep('done')
    setSubmitting(false)
    setTimeout(() => { setShow(false); onSubmitted() }, 2500)
  }

  function dismiss() {
    sessionStorage.setItem(`crossed_${portId}_${new Date().toDateString()}`, 'dismissed')
    setShow(false)
    onDismiss?.()
  }

  if (!show) return null

  return (
    <div
      className="fixed left-0 right-0 px-4 z-50 flex justify-center animate-in slide-in-from-bottom-4 duration-300"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 12px)' }}
    >
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl p-4">
        {step === 'ask' && (
          <>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {es ? `¿Acabas de cruzar en ${portName}?` : `Just crossed at ${portName}?`}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {es ? 'Ayuda a los demás + gana puntos' : 'Help others + earn points'}
                </p>
              </div>
              <button onClick={dismiss} className="text-gray-300 hover:text-gray-500 text-lg leading-none ml-2">×</button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { value: 'fast',   emoji: '🟢', label: es ? 'Rápido' : 'Fast',   sub: es ? 'Fast' : 'Rápido' },
                { value: 'normal', emoji: '🟡', label: 'Normal',                  sub: 'Normal' },
                { value: 'slow',   emoji: '🔴', label: es ? 'Lento' : 'Slow',    sub: es ? 'Slow' : 'Lento' },
              ].map(r => (
                <button
                  key={r.value}
                  onClick={() => setCondition(r.value)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-colors ${
                    condition === r.value
                      ? 'border-gray-900 dark:border-gray-100 bg-gray-900 dark:bg-gray-100'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'
                  }`}
                >
                  <span className="text-lg">{r.emoji}</span>
                  <span className={`text-xs font-semibold ${condition === r.value ? 'text-white dark:text-gray-900' : 'text-gray-700 dark:text-gray-300'}`}>{r.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-3">
              <input
                type="number"
                inputMode="numeric"
                value={actualMinutes}
                onChange={e => setActualMinutes(e.target.value)}
                placeholder={es ? 'Minutos de espera (opcional)' : 'Actual wait in minutes (optional)'}
                min={1} max={300}
                className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {user && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mb-2 text-center font-medium">
                +{actualMinutes ? '10' : '5'} {es ? 'puntos por reportar' : 'pts for reporting'}
              </p>
            )}

            <button
              onClick={submit}
              disabled={!condition || submitting}
              className="w-full bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-sm font-semibold py-3 rounded-xl hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              {submitting
                ? (es ? 'Enviando...' : 'Submitting...')
                : (es ? 'Enviar reporte' : 'Submit Report')}
            </button>
          </>
        )}

        {step === 'done' && (
          <div className="text-center py-3">
            <p className="text-3xl mb-2">🙌</p>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {es ? '¡Gracias!' : 'Thanks!'}
            </p>
            {pointsEarned > 0 && (
              <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold mt-1">
                +{pointsEarned} {es ? 'puntos ganados' : 'points earned'}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {es ? 'Estás ayudando a los demás cruzar mejor.' : "You're helping fellow crossers."}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
