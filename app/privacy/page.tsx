'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

export default function PrivacyPage() {
  const { lang } = useLang()

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <div className="pt-8 pb-6">
          <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4">
            <ArrowLeft className="w-3 h-3" /> {lang === 'es' ? 'Atrás' : 'Back'}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {lang === 'es' ? 'Política de Privacidad' : 'Privacy Policy'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {lang === 'es' ? 'Última actualización: 25 de abril de 2026' : 'Last updated: April 25, 2026'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '1. Qué Recopilamos' : '1. What We Collect'}
            </h2>
            <p>
              {lang === 'es'
                ? 'Cuando creas una cuenta, recopilamos tu correo electrónico y cualquier información de perfil que decidas proporcionar (nombre, empresa, biografía). Si usas el inicio de sesión con Google, recibimos tu nombre y correo de Google.'
                : 'When you create an account, we collect your email address and any profile information you choose to provide (name, company, bio). If you use Google sign-in, we receive your name and email from Google.'}
            </p>
            <p className="mt-2">
              {lang === 'es'
                ? 'Cuando usas la app, recopilamos los reportes de conductor que envías voluntariamente, los cruces que guardas y las preferencias de alerta que configuras.'
                : 'When you use the app, we collect driver reports you voluntarily submit, crossings you save, and alert preferences you set.'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '2. Cómo Usamos tus Datos' : '2. How We Use Your Data'}
            </h2>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                {lang === 'es'
                  ? 'Para proporcionar tiempos de espera fronterizos en vivo y funciones personalizadas'
                  : 'To provide live border wait times and personalized features'}
              </li>
              <li>
                {lang === 'es'
                  ? 'Para enviarte alertas cuando bajen los tiempos de espera en los cruces que sigues'
                  : 'To send you alerts when wait times drop at crossings you follow'}
              </li>
              <li>
                {lang === 'es'
                  ? 'Para mejorar los patrones históricos de tiempos de espera usando datos de cruce agregados y anónimos'
                  : 'To improve historical wait time patterns using aggregated, anonymous crossing data'}
              </li>
              <li>
                {lang === 'es'
                  ? 'Para procesar pagos de suscripción vía Stripe (nunca guardamos datos de tarjeta)'
                  : 'To process subscription payments via Stripe (we never store card details)'}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '3. Publicidad' : '3. Advertising'}
            </h2>
            <p>
              {lang === 'es' ? (
                <>Los usuarios sin cuenta pueden ver anuncios servidos por Google AdSense. Google puede usar cookies para mostrar anuncios relevantes. Puedes optar por no recibirlos en <a href="https://adssettings.google.com" className="text-blue-600 dark:text-blue-400 underline" target="_blank" rel="noopener">adssettings.google.com</a>. Los usuarios con cuenta gratuita solo ven anuncios de negocios locales patrocinados. Los suscriptores Pro y Business no ven anuncios.</>
              ) : (
                <>Users without an account may see ads served by Google AdSense. Google may use cookies to show relevant ads. You can opt out at <a href="https://adssettings.google.com" className="text-blue-600 dark:text-blue-400 underline" target="_blank" rel="noopener">adssettings.google.com</a>. Users with a free account see locally sponsored business ads only. Pro and Business subscribers see no ads.</>
              )}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '4. Compartir Datos' : '4. Data Sharing'}
            </h2>
            <p>
              {lang === 'es'
                ? 'No vendemos tus datos personales. Solo compartimos datos con:'
                : 'We do not sell your personal data. We share data only with:'}
            </p>
            <ul className="list-disc pl-4 mt-2 space-y-1">
              <li>
                <strong>Supabase</strong> — {lang === 'es' ? 'proveedor de base de datos y autenticación' : 'database and authentication provider'}
              </li>
              <li>
                <strong>Stripe</strong> — {lang === 'es' ? 'procesamiento de pagos para suscripciones' : 'payment processing for subscriptions'}
              </li>
              <li>
                <strong>Google AdSense</strong> — {lang === 'es' ? 'publicidad solo para usuarios invitados' : 'ad serving for guest users only'}
              </li>
              <li>
                <strong>Vercel</strong> — {lang === 'es' ? 'proveedor de hosting' : 'hosting provider'}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '5. Reportes de Conductores' : '5. Driver Reports'}
            </h2>
            <p>
              {lang === 'es'
                ? 'Los reportes que envías (condiciones de espera, tiempos de cruce) son públicos y se muestran a todos los usuarios. Incluyen el rol de tu cuenta pero no tu nombre, a menos que lo hayas agregado a tu perfil y lo hayas puesto visible.'
                : "Reports you submit (wait conditions, crossing times) are public and shown to all users. They include your account role but not your name unless you've added it to your profile and set it to visible."}
            </p>
          </section>

          <section id="auto-crossing">
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es'
                ? '6. Rastreo Automático de Cruce (opcional)'
                : '6. Auto-Crossing Detection (opt-in)'}
            </h2>
            <p>
              {lang === 'es'
                ? 'Si activas "Rastreo automático de cruce" en tu cuenta, la app puede detectar cuándo cruzas un puente y registrar el tiempo de espera. Esta función está APAGADA por defecto y solo se activa cuando tú la enciendes.'
                : 'If you turn on "Auto-crossing detection" in your account, the app can detect when you cross a bridge and record the wait time. This feature is OFF by default and only runs when you turn it on.'}
            </p>
            <p className="mt-2">
              {lang === 'es' ? 'Cuando está activo:' : 'When active:'}
            </p>
            <ul className="list-disc pl-4 mt-1 space-y-1">
              <li>
                {lang === 'es'
                  ? 'Tu posición GPS se procesa SOLO en tu dispositivo — nunca se envía ni se guarda en nuestros servidores.'
                  : 'Your GPS position is processed ONLY on your device — it is never sent to or stored on our servers.'}
              </li>
              <li>
                {lang === 'es'
                  ? 'Lo único que guardamos es el tiempo entre que tocas "Estoy en la fila" y que cruzas — sin tu identidad y sin tu ruta.'
                  : 'The only thing we save is the time between you tapping "I\'m in line" and crossing — with no identity and no route attached.'}
              </li>
              <li>
                {lang === 'es'
                  ? 'Estos datos anónimos mejoran las predicciones de tiempo de espera para todos los usuarios.'
                  : 'This anonymous data improves wait-time predictions for all users.'}
              </li>
              <li>
                {lang === 'es'
                  ? 'Puedes apagar el rastreo en cualquier momento desde tu cuenta.'
                  : 'You can turn tracking off at any time from your account.'}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '7. Retención de Datos' : '7. Data Retention'}
            </h2>
            <p>
              {lang === 'es'
                ? 'Conservamos los datos de tu cuenta mientras tu cuenta esté activa. Las lecturas de tiempos de espera se almacenan hasta por 90 días para análisis histórico. Puedes eliminar tu cuenta en cualquier momento contactándonos.'
                : 'We retain your account data as long as your account is active. Wait time readings are stored for up to 90 days for historical analysis. You may delete your account at any time by contacting us.'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '8. Tus Derechos' : '8. Your Rights'}
            </h2>
            <p>
              {lang === 'es' ? (
                <>Puedes solicitar acceso, corrección o eliminación de tus datos personales en cualquier momento. Contáctanos en <strong>hello@cruzar.app</strong>.</>
              ) : (
                <>You may request access to, correction of, or deletion of your personal data at any time. Contact us at <strong>hello@cruzar.app</strong>.</>
              )}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '9. Menores de Edad' : '9. Children'}
            </h2>
            <p>
              {lang === 'es'
                ? 'Cruzar no está dirigido a menores de 13 años. No recopilamos conscientemente datos de menores.'
                : 'Cruzar is not directed at children under 13. We do not knowingly collect data from children.'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '10. Contacto' : '10. Contact'}
            </h2>
            <p>
              {lang === 'es' ? (
                <>¿Preguntas? Escríbenos a <strong>hello@cruzar.app</strong>.</>
              ) : (
                <>Questions? Email us at <strong>hello@cruzar.app</strong>.</>
              )}
            </p>
          </section>

        </div>
      </div>
    </main>
  )
}
