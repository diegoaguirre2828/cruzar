'use client'

import Link from 'next/link'
import { ArrowLeft, ShieldCheck, AlertTriangle, CheckCircle } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

// AFFILIATE LINKS — replace these URLs with your actual affiliate referral URLs from each provider
// Baja Bound affiliate program: https://www.bajabound.com/affiliate/
// MexPro affiliate program:     https://www.mexpro.com/en-US/affiliates
// Oscar Padilla:                contact them at info@mexicaninsurance.com
const PROVIDERS = [
  {
    name: 'Baja Bound',
    description: { en: 'Most popular choice for US residents. Instant online quotes, daily to annual coverage.', es: 'La opción más popular para residentes de EE.UU. Cotizaciones en línea al instante.' },
    url: 'https://www.bajabound.com/?ref=cruza', // TODO: replace with your affiliate URL
    badge: { en: 'Most Popular', es: 'Más Popular' },
    badgeColor: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  },
  {
    name: 'MexPro',
    description: { en: 'Competitive rates, strong customer service. Compare rates across multiple carriers.', es: 'Tarifas competitivas y buen servicio al cliente. Compara entre múltiples aseguradoras.' },
    url: 'https://www.mexpro.com/?ref=cruza', // TODO: replace with your affiliate URL
    badge: null,
    badgeColor: '',
  },
  {
    name: 'Oscar Padilla Mexican Insurance',
    description: { en: 'Trusted since 1979. Covers the full Mexican Republic. 24/7 roadside assistance.', es: 'De confianza desde 1979. Cobertura en toda la República. Asistencia en carretera 24/7.' },
    url: 'https://www.mexicaninsurance.com/?ref=cruza', // TODO: replace with your affiliate URL
    badge: null,
    badgeColor: '',
  },
]

const COVERAGE_ITEMS = {
  en: [
    { icon: '✅', text: 'Liability coverage (required by Mexican law)' },
    { icon: '✅', text: 'Physical damage to your vehicle' },
    { icon: '✅', text: 'Medical payments for you and passengers' },
    { icon: '✅', text: '24/7 roadside assistance in Mexico' },
    { icon: '✅', text: 'Legal assistance if you\'re in an accident' },
  ],
  es: [
    { icon: '✅', text: 'Responsabilidad civil (obligatoria por ley en México)' },
    { icon: '✅', text: 'Daños físicos a tu vehículo' },
    { icon: '✅', text: 'Gastos médicos para ti y tus pasajeros' },
    { icon: '✅', text: 'Asistencia en carretera 24/7 en México' },
    { icon: '✅', text: 'Asistencia legal en caso de accidente' },
  ],
}

const FAQ = {
  en: [
    { q: 'Is Mexican auto insurance really required?', a: 'Yes. Mexico\'s traffic laws require all drivers to carry liability insurance from a Mexican-licensed insurer. US policies are not valid in Mexico. Driving without it can result in fines, vehicle impoundment, or jail time if you\'re in an accident.' },
    { q: 'How much does it cost?', a: 'Day passes start around $7–15 for a standard vehicle. Annual policies can be as low as $150–300 depending on your car\'s value and coverage level.' },
    { q: 'Can I buy it at the border?', a: 'Yes, many insurance offices are right at the crossing. However, buying online before you leave takes 5 minutes and is usually cheaper.' },
    { q: 'Does it cover the whole country?', a: 'Most policies cover all of Mexico. Always confirm with your provider, especially for travel beyond border cities.' },
  ],
  es: [
    { q: '¿De verdad es obligatorio el seguro en México?', a: 'Sí. Las leyes de tránsito de México exigen que todos los conductores tengan seguro de responsabilidad civil de una aseguradora con licencia mexicana. Las pólizas de EE.UU. no son válidas en México. Sin seguro puedes recibir multas, que te retengan el vehículo, o incluso detención en caso de accidente.' },
    { q: '¿Cuánto cuesta?', a: 'Los pases diarios comienzan alrededor de $7–15 USD para un vehículo estándar. Las pólizas anuales pueden costar desde $150–300 USD según el valor del auto y el nivel de cobertura.' },
    { q: '¿Puedo comprarlo en la frontera?', a: 'Sí, muchas aseguradoras tienen oficinas justo en el cruce. Sin embargo, comprarlo en línea antes de salir toma 5 minutos y generalmente es más barato.' },
    { q: '¿Cubre todo el país?', a: 'La mayoría de las pólizas cubren todo México. Siempre confirma con tu proveedor, especialmente si viajas más allá de las ciudades fronterizas.' },
  ],
}

export default function InsurancePage() {
  const { lang } = useLang()
  const t = {
    back: lang === 'es' ? 'Inicio' : 'Home',
    title: lang === 'es' ? '🛡️ Seguro de Auto para México' : '🛡️ Mexico Auto Insurance',
    subtitle: lang === 'es'
      ? 'Obligatorio por ley. Evita multas y problemas — asegúrate antes de cruzar.'
      : 'Required by law. Avoid fines and serious problems — get covered before you cross.',
    warningTitle: lang === 'es' ? '⚠️ No cruces sin seguro' : '⚠️ Don\'t cross without insurance',
    warningBody: lang === 'es'
      ? 'Tu seguro de auto de EE.UU. no tiene validez en México. Si tienes un accidente sin seguro mexicano, puedes ser detenido hasta que se resuelva el caso.'
      : 'Your US auto insurance is not valid in Mexico. If you have an accident without Mexican insurance, you can be detained until the case is resolved.',
    coverageTitle: lang === 'es' ? 'Qué cubre una póliza típica' : 'What a typical policy covers',
    providersTitle: lang === 'es' ? 'Proveedores recomendados' : 'Recommended providers',
    getQuote: lang === 'es' ? 'Obtener cotización →' : 'Get a quote →',
    faqTitle: lang === 'es' ? 'Preguntas frecuentes' : 'Frequently asked questions',
    tipTitle: lang === 'es' ? '💡 Consejo rápido' : '💡 Quick tip',
    tipBody: lang === 'es'
      ? 'Si cruzas con frecuencia, una póliza anual es mucho más económica que pagar por día. Muchos cruzantes frecuentes pagan menos de $20 al mes por cobertura anual.'
      : 'If you cross regularly, an annual policy is much cheaper than paying per day. Many frequent crossers pay less than $20/month for annual coverage.',
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-16">

        <div className="pt-6 pb-2">
          <Link href="/services" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-3 transition-colors">
            <ArrowLeft className="w-3 h-3" /> {lang === 'es' ? 'Servicios en México' : 'Cross for Services'}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.subtitle}</p>
        </div>

        {/* Warning banner */}
        <div className="flex gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 mt-4 mb-5">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">{t.warningTitle}</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">{t.warningBody}</p>
          </div>
        </div>

        {/* Coverage */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.coverageTitle}</h2>
          </div>
          <ul className="space-y-2">
            {COVERAGE_ITEMS[lang].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                <span>{item.icon}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Quick tip */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mb-5">
          <p className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-0.5">{t.tipTitle}</p>
          <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">{t.tipBody}</p>
        </div>

        {/* Providers */}
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">{t.providersTitle}</h2>
        <div className="space-y-3 mb-6">
          {PROVIDERS.map(p => (
            <div key={p.name} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{p.name}</p>
                  {p.badge && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.badgeColor}`}>
                      {lang === 'es' ? p.badge.es : p.badge.en}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
                {lang === 'es' ? p.description.es : p.description.en}
              </p>
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-xl transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                {t.getQuote}
              </a>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">{t.faqTitle}</h2>
        <div className="space-y-3">
          {FAQ[lang].map((item, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{item.q}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
