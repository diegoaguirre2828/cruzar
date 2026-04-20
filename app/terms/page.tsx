'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

export default function TermsPage() {
  const { lang } = useLang()

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <div className="pt-8 pb-6">
          <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4">
            <ArrowLeft className="w-3 h-3" /> {lang === 'es' ? 'Atrás' : 'Back'}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {lang === 'es' ? 'Términos del Servicio' : 'Terms of Service'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {lang === 'es' ? 'Última actualización: 29 de marzo de 2026' : 'Last updated: March 29, 2026'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '1. Aceptación' : '1. Acceptance'}
            </h2>
            <p>
              {lang === 'es'
                ? 'Al usar Cruzar ("la app"), aceptas estos términos. Si no estás de acuerdo, no uses la app.'
                : 'By using Cruzar ("the app"), you agree to these terms. If you don\'t agree, don\'t use the app.'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '2. Qué es Cruzar' : '2. What Cruzar Is'}
            </h2>
            <p>
              {lang === 'es'
                ? 'Cruzar proporciona tiempos de espera en vivo y estimados para los cruces fronterizos entre EE.UU. y México, obtenidos de la API pública de la Oficina de Aduanas y Protección Fronteriza de EE.UU. (CBP) y de reportes de conductores en comunidad. Los tiempos de espera son solo informativos. No estamos afiliados con CBP ni con ninguna agencia gubernamental.'
                : 'Cruzar provides live and estimated US-Mexico border crossing wait times sourced from the US Customs and Border Protection (CBP) public API and crowdsourced driver reports. Wait times are informational only. We are not affiliated with CBP or any government agency.'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '3. Aviso de Precisión' : '3. Accuracy Disclaimer'}
            </h2>
            <p>
              {lang === 'es'
                ? 'Los tiempos de espera son estimaciones y pueden no reflejar las condiciones reales al momento del cruce. No dependas únicamente de Cruzar para decisiones de viaje con tiempo limitado. Cruzar no se hace responsable de demoras, citas perdidas ni de cualquier consecuencia de decisiones de cruce tomadas usando esta app.'
                : 'Wait times are estimates and may not reflect actual conditions at the time of crossing. Do not rely solely on Cruzar for time-sensitive travel decisions. Cruzar is not responsible for delays, missed appointments, or any consequences of crossing decisions made using this app.'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '4. Cuentas de Usuario' : '4. User Accounts'}
            </h2>
            <p>
              {lang === 'es'
                ? 'Eres responsable de mantener seguras tus credenciales de acceso. No puedes compartir cuentas ni usar la app para scraping automatizado. Una cuenta por persona.'
                : 'You are responsible for keeping your login credentials secure. You may not share accounts or use the app for automated scraping. One account per person.'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '5. Reportes de la Comunidad' : '5. Community Reports'}
            </h2>
            <p>
              {lang === 'es'
                ? 'Los reportes enviados por usuarios no están verificados y son generados por la comunidad. Cruzar no garantiza su precisión. No tomes decisiones con tiempo limitado o críticas para la seguridad basándote únicamente en reportes de la comunidad. Al enviar un reporte, le otorgas a Cruzar una licencia perpetua y no exclusiva para mostrarlo, agregarlo y analizarlo. No envíes reportes falsos, engañosos o dañinos. Nos reservamos el derecho de eliminar cualquier reporte sin previo aviso.'
                : 'Reports submitted by users are unverified and community-generated. Cruzar does not guarantee their accuracy. Do not make time-sensitive or safety-critical decisions based solely on community reports. By submitting a report, you grant Cruzar a perpetual, non-exclusive license to display, aggregate, and analyze it. Do not submit false, misleading, or harmful reports. We reserve the right to remove any report without notice.'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '5a. Asistente de IA' : '5a. AI Assistant'}
            </h2>
            <p>
              {lang === 'es'
                ? 'El asistente de IA de Cruzar proporciona respuestas informativas generales sobre procedimientos de cruce fronterizo. No es un abogado de inmigración licenciado y sus respuestas no constituyen asesoría legal. No dependas de las respuestas de la IA para decisiones migratorias. Siempre verifica la información con fuentes oficiales como cbp.gov o con un abogado de inmigración licenciado. Cruzar no es responsable de ninguna consecuencia derivada de depender de respuestas generadas por IA.'
                : 'The Cruzar AI assistant provides general informational responses about border crossing procedures. It is not a licensed immigration attorney and its responses do not constitute legal advice. Do not rely on AI responses for immigration decisions. Always verify information with official sources such as cbp.gov or a licensed immigration attorney. Cruzar is not liable for any consequences arising from reliance on AI-generated responses.'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '6. Suscripciones y Facturación' : '6. Subscriptions & Billing'}
            </h2>
            <p>
              {lang === 'es'
                ? 'Las suscripciones Pro ($2.99/mes) y Business ($49/mes) se cobran mensualmente vía Stripe. Puedes cancelar en cualquier momento desde tu página de cuenta — el acceso continúa hasta el final del periodo de facturación. No se emiten reembolsos por meses parciales.'
                : 'Pro ($2.99/mo) and Business ($49/mo) subscriptions are billed monthly via Stripe. You may cancel anytime from your account page — access continues until the end of the billing period. No refunds are issued for partial months.'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '7. Publicidad' : '7. Advertising'}
            </h2>
            <p>
              {lang === 'es'
                ? 'Los usuarios invitados (sin cuenta) pueden ver anuncios de Google AdSense. Los titulares de cuentas gratuitas pueden ver anuncios de negocios locales patrocinados. Los suscriptores Pro y Business no ven anuncios. No nos hacemos responsables del contenido publicitario de terceros.'
                : 'Guest users (no account) may see Google AdSense ads. Free account holders may see locally sponsored business ads. Pro and Business subscribers see no ads. We are not responsible for third-party ad content.'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '8. Datos y Analítica' : '8. Data & Analytics'}
            </h2>
            <p>
              {lang === 'es'
                ? 'Cruzar recopila datos anonimizados y agregados sobre patrones de cruce, incluyendo tendencias de tiempos de espera, volumen de tráfico por hora del día y condiciones reportadas por la comunidad. Estos datos no identifican a usuarios individuales. Podemos usar, analizar y licenciar estos datos agregados a terceros, incluyendo empresas de logística, instituciones de investigación y agencias gubernamentales. No se incluye información personal identificable en ningún dato compartido con terceros.'
                : 'Cruzar collects anonymized, aggregated crossing pattern data including wait time trends, traffic volume by time of day, and community-reported conditions. This data does not identify individual users. We may use, analyze, and license this aggregated data to third parties including logistics companies, research institutions, and government agencies. No personally identifiable information is included in any data shared with third parties.'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '9. Solicitudes Gubernamentales y Legales' : '9. Government & Legal Requests'}
            </h2>
            <p>
              {lang === 'es'
                ? 'Cruzar cumplirá con las solicitudes gubernamentales legales, órdenes judiciales y citatorios. Notificaremos a los usuarios afectados de tales solicitudes en la medida permitida por la ley. Minimizamos los datos personales que retenemos para limitar la exposición en estos casos.'
                : 'Cruzar will comply with lawful government requests, court orders, and subpoenas. We will notify affected users of such requests to the extent permitted by law. We minimize the personal data we retain to limit exposure in such cases.'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '10. Uso Prohibido' : '10. Prohibited Use'}
            </h2>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                {lang === 'es'
                  ? 'Scraping o acceso automatizado sin permiso escrito'
                  : 'Scraping or automated access without written permission'}
              </li>
              <li>
                {lang === 'es'
                  ? 'Enviar reportes de cruce falsos o engañosos'
                  : 'Submitting false or misleading crossing reports'}
              </li>
              <li>
                {lang === 'es'
                  ? 'Usar la app para facilitar cualquier actividad ilegal'
                  : 'Using the app to facilitate any illegal activity'}
              </li>
              <li>
                {lang === 'es'
                  ? 'Intentar hacer ingeniería inversa o comprometer la app'
                  : 'Attempting to reverse-engineer or compromise the app'}
              </li>
              <li>
                {lang === 'es'
                  ? 'Usar el asistente de IA para buscar consejos sobre cómo evadir regulaciones fronterizas'
                  : 'Using the AI assistant to seek advice on evading border regulations'}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '11. Terminación' : '11. Termination'}
            </h2>
            <p>
              {lang === 'es'
                ? 'Podemos suspender o terminar cuentas que violen estos términos. Puedes eliminar tu cuenta en cualquier momento.'
                : 'We may suspend or terminate accounts that violate these terms. You may delete your account at any time.'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '12. Limitación de Responsabilidad' : '12. Limitation of Liability'}
            </h2>
            <p>
              {lang === 'es'
                ? 'Cruzar se proporciona "tal cual". No ofrecemos garantías sobre tiempo de actividad, precisión o idoneidad para cualquier propósito particular. Nuestra responsabilidad hacia ti no excederá la cantidad que nos pagaste en los últimos 3 meses.'
                : 'Cruzar is provided "as is." We make no warranties about uptime, accuracy, or fitness for any particular purpose. Our liability to you shall not exceed the amount you paid us in the last 3 months.'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '13. Ley Aplicable' : '13. Governing Law'}
            </h2>
            <p>
              {lang === 'es'
                ? 'Estos términos se rigen por las leyes del Estado de Texas, EE.UU.'
                : 'These terms are governed by the laws of the State of Texas, USA.'}
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? '14. Contacto' : '14. Contact'}
            </h2>
            <p>
              {lang === 'es' ? (
                <>¿Preguntas? Escribe a <strong>hello@cruzar.app</strong>.</>
              ) : (
                <>Questions? Email <strong>hello@cruzar.app</strong>.</>
              )}
            </p>
          </section>

        </div>
      </div>
    </main>
  )
}
