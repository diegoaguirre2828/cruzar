'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { createBrowserClient } from '@supabase/ssr'

export default function DataDeletionPage() {
  const { lang } = useLang()
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(!!data.user)
      setUserEmail(data.user?.email ?? null)
    })
  }, [supabase])

  const es = lang === 'es'

  async function handleDelete() {
    setBusy(true)
    setErrMsg(null)
    try {
      const res = await fetch('/api/profile', { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      await supabase.auth.signOut()
      router.push('/?deleted=1')
    } catch (e) {
      setErrMsg((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <div className="pt-8 pb-6">
          <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4">
            <ArrowLeft className="w-3 h-3" /> {es ? 'Atrás' : 'Back'}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {es ? 'Eliminar tu Cuenta' : 'Delete Your Account'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {es
              ? 'Elimina tu cuenta de Cruzar y tus datos personales'
              : 'Delete your Cruzar account and personal data'}
          </p>
        </div>

        {signedIn && (
          <div className="bg-red-50 dark:bg-red-950/20 rounded-2xl border border-red-200 dark:border-red-900 p-6 mb-6">
            <h2 className="text-lg font-bold text-red-900 dark:text-red-200 mb-2">
              {es ? 'Eliminar cuenta ahora' : 'Delete account now'}
            </h2>
            <p className="text-sm text-red-800 dark:text-red-200/80 mb-4">
              {es
                ? `Sesión iniciada como ${userEmail ?? ''}. Borraremos permanentemente tu perfil, cruces guardados, alertas, suscripciones push y registros de suscripción. Tus reportes de cruce se anonimizan (siguen visibles pero sin tu nombre).`
                : `Signed in as ${userEmail ?? ''}. We will permanently delete your profile, saved crossings, alerts, push subscriptions, and subscription records. Your crossing reports are anonymized (still visible but no longer tied to you).`}
            </p>
            <button
              onClick={() => setConfirmOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl active:scale-[0.98] transition-transform"
            >
              {es ? 'Eliminar mi cuenta' : 'Delete my account'}
            </button>
          </div>
        )}

        {signedIn === false && (
          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-2xl border border-blue-200 dark:border-blue-900 p-6 mb-6">
            <h2 className="text-lg font-bold text-blue-900 dark:text-blue-200 mb-2">
              {es ? 'Inicia sesión para eliminar' : 'Sign in to delete'}
            </h2>
            <p className="text-sm text-blue-800 dark:text-blue-200/80 mb-4">
              {es
                ? 'La forma más rápida de eliminar tu cuenta es desde dentro de la app. Inicia sesión primero, después regresa aquí.'
                : 'The fastest way to delete your account is from inside the app. Sign in first, then come back here.'}
            </p>
            <Link
              href="/login?next=/data-deletion"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl"
            >
              {es ? 'Iniciar sesión' : 'Sign in'}
            </Link>
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {es ? 'Alternativa — Solicitud por Correo' : 'Alternative — Email Request'}
            </h2>
            <p>
              {es ? (
                <>Si no puedes iniciar sesión, envía un correo a <strong>hello@cruzar.app</strong> con el asunto <strong>&quot;Eliminar Mi Cuenta&quot;</strong> desde el correo asociado a tu cuenta.</>
              ) : (
                <>If you can&apos;t sign in, send an email to <strong>hello@cruzar.app</strong> with subject <strong>&quot;Delete My Account&quot;</strong> from the email tied to your account.</>
              )}
            </p>
            <p className="mt-2">
              {es
                ? 'Eliminaremos permanentemente tu cuenta y datos asociados dentro de 7 días hábiles y lo confirmaremos por correo.'
                : 'We will permanently delete your account and associated data within 7 business days and confirm by email.'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {es ? 'Qué se Elimina' : 'What Gets Deleted'}
            </h2>
            <ul className="list-disc pl-4 space-y-1">
              <li>{es ? 'Tu cuenta y perfil (nombre, correo, nombre visible)' : 'Your account and profile (name, email, display name)'}</li>
              <li>{es ? 'Cruces guardados y preferencias de alerta' : 'Saved crossings and alert preferences'}</li>
              <li>{es ? 'Suscripciones a notificaciones push' : 'Push notification subscriptions'}</li>
              <li>{es ? 'Registros de suscripción (después de la conciliación final de facturación)' : 'Subscription records (after final billing reconciliation)'}</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {es ? 'Qué Puede Retenerse' : 'What May Be Retained'}
            </h2>
            <p>
              {es
                ? 'Los reportes de cruce que enviaste se anonimizan y siguen visibles para la comunidad sin vínculo con tu identidad. Los datos agregados de tiempos de espera (sin identificadores) se retienen para mejorar las predicciones.'
                : 'Crossing reports you submitted are anonymized and remain visible to the community with no link to your identity. Aggregate wait time data (no identifiers) is retained to improve predictions.'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {es ? 'Preguntas' : 'Questions'}
            </h2>
            <p>
              {es ? (
                <>Si tienes preguntas sobre la eliminación de datos, escríbenos a <strong>hello@cruzar.app</strong>.</>
              ) : (
                <>Questions about data deletion? Contact <strong>hello@cruzar.app</strong>.</>
              )}
            </p>
          </section>

        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center px-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
              {es ? 'Confirmar eliminación' : 'Confirm deletion'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {es ? (
                <>Escribe <strong>ELIMINAR</strong> para confirmar. Esto no se puede deshacer.</>
              ) : (
                <>Type <strong>DELETE</strong> to confirm. This cannot be undone.</>
              )}
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 mb-3"
              placeholder={es ? 'ELIMINAR' : 'DELETE'}
            />
            {errMsg && (
              <p className="text-xs text-red-600 dark:text-red-400 mb-3">{errMsg}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setConfirmOpen(false); setTyped(''); setErrMsg(null) }}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-sm font-semibold"
              >
                {es ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                onClick={handleDelete}
                disabled={busy || (typed !== 'DELETE' && typed !== 'ELIMINAR')}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-300 dark:disabled:bg-red-950 disabled:cursor-not-allowed text-white text-sm font-bold"
              >
                {busy
                  ? (es ? 'Eliminando…' : 'Deleting…')
                  : (es ? 'Eliminar' : 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
