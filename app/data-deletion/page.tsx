'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

export default function DataDeletionPage() {
  const { lang } = useLang()

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <div className="pt-8 pb-6">
          <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4">
            <ArrowLeft className="w-3 h-3" /> {lang === 'es' ? 'Atrás' : 'Back'}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {lang === 'es' ? 'Instrucciones para Eliminar Datos' : 'Data Deletion Instructions'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {lang === 'es'
              ? 'Cómo eliminar tu cuenta de Cruzar y tus datos personales'
              : 'How to delete your Cruzar account and personal data'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? 'Eliminar tu Cuenta' : 'Delete Your Account'}
            </h2>
            <p>
              {lang === 'es'
                ? 'Puedes solicitar la eliminación de tu cuenta de Cruzar y todos los datos personales asociados en cualquier momento. Hay dos maneras de hacerlo:'
                : 'You can request deletion of your Cruzar account and all associated personal data at any time. There are two ways to do this:'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? 'Opción 1 — Solicitud por Correo' : 'Option 1 — Email Request'}
            </h2>
            <p>
              {lang === 'es' ? (
                <>Envía un correo a <strong>cruzabusiness@gmail.com</strong> con el asunto <strong>"Eliminar Mi Cuenta"</strong> desde el correo asociado a tu cuenta de Cruzar.</>
              ) : (
                <>Send an email to <strong>cruzabusiness@gmail.com</strong> with the subject line <strong>"Delete My Account"</strong> from the email address associated with your Cruzar account.</>
              )}
            </p>
            <p className="mt-2">
              {lang === 'es' ? (
                <>Eliminaremos permanentemente tu cuenta, perfil, cruces guardados, preferencias de alerta y cualquier reporte vinculado a tu cuenta dentro de <strong>7 días hábiles</strong> y lo confirmaremos por correo.</>
              ) : (
                <>We will permanently delete your account, profile, saved crossings, alert preferences, and any reports tied to your account within <strong>7 business days</strong> and confirm by email.</>
              )}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? 'Opción 2 — Eliminación dentro de la App' : 'Option 2 — In-App Deletion'}
            </h2>
            <p>
              {lang === 'es'
                ? 'Si iniciaste sesión con Facebook, también puedes revocar el acceso de Cruzar desde tu cuenta de Facebook:'
                : "If you signed in with Facebook, you can also revoke Cruzar's access from your Facebook account:"}
            </p>
            <ol className="list-decimal pl-4 mt-2 space-y-1">
              <li>
                {lang === 'es' ? (
                  <>Ve a <strong>Facebook → Configuración y Privacidad → Configuración → Aplicaciones y Sitios Web</strong></>
                ) : (
                  <>Go to <strong>Facebook → Settings & Privacy → Settings → Apps and Websites</strong></>
                )}
              </li>
              <li>
                {lang === 'es' ? (
                  <>Encuentra <strong>Cruzar</strong> en la lista de aplicaciones activas</>
                ) : (
                  <>Find <strong>Cruzar</strong> in the list of active apps</>
                )}
              </li>
              <li>
                {lang === 'es' ? (
                  <>Haz clic en <strong>Eliminar</strong></>
                ) : (
                  <>Click <strong>Remove</strong></>
                )}
              </li>
            </ol>
            <p className="mt-2">
              {lang === 'es'
                ? 'Eliminar la app impide que Cruzar acceda a tus datos de Facebook de ahora en adelante. Para también eliminar los datos que ya almacenamos, por favor sigue la Opción 1.'
                : 'Removing the app stops Cruzar from accessing your Facebook data going forward. To also delete data we already stored, please follow Option 1.'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? 'Qué se Elimina' : 'What Gets Deleted'}
            </h2>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                {lang === 'es'
                  ? 'Tu cuenta y perfil (nombre, correo, nombre visible)'
                  : 'Your account and profile (name, email, display name)'}
              </li>
              <li>
                {lang === 'es'
                  ? 'Cruces guardados y preferencias de alerta'
                  : 'Saved crossings and alert preferences'}
              </li>
              <li>
                {lang === 'es'
                  ? 'Suscripciones a notificaciones push'
                  : 'Push notification subscriptions'}
              </li>
              <li>
                {lang === 'es'
                  ? 'Identificadores personales adjuntos a reportes de cruce'
                  : 'Personal identifiers attached to crossing reports'}
              </li>
              <li>
                {lang === 'es'
                  ? 'Registros de suscripción (después de la conciliación final de facturación)'
                  : 'Subscription records (after final billing reconciliation)'}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? 'Qué Puede Retenerse' : 'What May Be Retained'}
            </h2>
            <p>
              {lang === 'es'
                ? 'Los datos anonimizados y agregados de tiempos de espera (sin vínculo con tu identidad) pueden retenerse para análisis histórico y para mejorar las predicciones para todos los usuarios. Estos datos no pueden usarse para identificarte.'
                : 'Anonymized, aggregated wait time data (with no link to your identity) may be retained for historical analysis and to improve predictions for all users. This data cannot be used to identify you.'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? 'Preguntas' : 'Questions'}
            </h2>
            <p>
              {lang === 'es' ? (
                <>Si tienes preguntas sobre la eliminación de datos, contáctanos en <strong>cruzabusiness@gmail.com</strong>.</>
              ) : (
                <>If you have any questions about data deletion, contact us at <strong>cruzabusiness@gmail.com</strong>.</>
              )}
            </p>
          </section>

        </div>
      </div>
    </main>
  )
}
