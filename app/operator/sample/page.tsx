'use client'

import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { ArrowLeft, AlertTriangle, FileCheck } from 'lucide-react'
import { LangToggle } from '@/components/LangToggle'

// Public, no-auth-required demo of what a Cruzar Operator validation
// result looks like. Hand-curated using a realistic Mexican commercial
// invoice + USMCA cert to seed the imagination of cold visitors. The
// shape mirrors exactly what /api/operator/validate returns.

const SAMPLE = {
  doc_kind: 'commercial_invoice',
  source_filename: 'INV-2026-04-A-1442.pdf',
  ms_to_complete: 41200,
  severity: 'minor' as const,
  ai_summary: {
    es: 'Factura comercial mayormente correcta. Dos avisos menores: tax ID del comprador (RFC) está mal formateado y descripción de la línea 3 es demasiado vaga ("merchandise"). Aduanas mexicanas rechazaría esa descripción y podría retener el embarque para inspección secundaria.',
    en: 'Commercial invoice mostly correct. Two minor flags: buyer tax ID (RFC) is malformed and the line-3 description is too vague ("merchandise"). Mexican customs would reject that description and likely pull the shipment for secondary inspection.',
  },
  extracted_fields: {
    invoice_number: 'INV-2026-04-A-1442',
    invoice_date: '2026-04-22',
    seller: 'Acme Logistics LLC (EIN 47-1234567)',
    buyer: 'Maquiladora del Norte SA de CV',
    buyer_rfc: 'MNO910214A45',
    incoterm: 'FOB Laredo',
    currency: 'USD',
    line_items: [
      { line: 1, desc: 'PVC pipe, 4-inch schedule 40, 20-ft', qty: 240, unit_price: 18.5, total: 4440, hs_code: '3917.23' },
      { line: 2, desc: 'PVC fittings, elbow 90°, 4-inch', qty: 1200, unit_price: 2.75, total: 3300, hs_code: '3917.40' },
      { line: 3, desc: 'merchandise', qty: 60, unit_price: 35.00, total: 2100, hs_code: null },
    ],
    grand_total: 9840,
    country_of_origin: 'United States',
  },
  issues: [
    {
      severity: 'minor',
      field_es: 'RFC del comprador',
      field_en: 'Buyer RFC',
      problem_es: 'MNO910214A45 tiene 12 caracteres. RFC de persona moral debe tener exactamente 13.',
      problem_en: 'MNO910214A45 is 12 chars. Mexican corporate RFC must be exactly 13.',
      fix_es: 'Verificar el RFC en el portal del SAT (sat.gob.mx) — probablemente falta un dígito de homoclave al final.',
      fix_en: 'Verify the RFC on the SAT portal (sat.gob.mx) — most likely missing a final homoclave digit.',
    },
    {
      severity: 'minor',
      field_es: 'Descripción de línea 3',
      field_en: 'Line 3 description',
      problem_es: '"merchandise" no describe la mercancía. Aduanas mexicanas rechaza descripciones genéricas — riesgo alto de inspección secundaria.',
      problem_en: '"merchandise" does not describe the goods. Mexican customs rejects generic descriptions — high secondary-inspection risk.',
      fix_es: 'Reemplazar con descripción específica + HS code de 8 dígitos. Ej: "PVC ball valve, 4-inch, threaded · 8481.80".',
      fix_en: 'Replace with specific description + 8-digit HS code. E.g., "PVC ball valve, 4-inch, threaded · 8481.80".',
    },
  ],
}

export default function SamplePage() {
  const { lang } = useLang()
  const es = lang === 'es'

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <div className="pt-6 pb-4 flex items-center justify-between gap-3">
          <Link href="/operator" className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <LangToggle />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-4">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400 mb-1">
            {es ? 'Validación de muestra' : 'Sample validation'}
          </p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            {SAMPLE.source_filename}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {es ? 'Tipo: factura comercial · 41 segundos para procesar' : 'Type: commercial invoice · 41 seconds to process'}
          </p>
        </div>

        <div className="rounded-2xl border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 p-5 mb-4">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                {es ? 'Avisos menores' : 'Minor flags'}
              </p>
              <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                {es ? SAMPLE.ai_summary.es : SAMPLE.ai_summary.en}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {SAMPLE.issues.map((iss, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                    {es ? iss.field_es : iss.field_en}
                  </p>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-600 text-white">
                    {iss.severity}
                  </span>
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-300">
                  {es ? iss.problem_es : iss.problem_en}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  → {es ? iss.fix_es : iss.fix_en}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-4">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {es ? 'Campos extraídos' : 'Extracted fields'}
          </p>
          <pre className="text-[11px] text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg overflow-auto">
{JSON.stringify(SAMPLE.extracted_fields, null, 2)}
          </pre>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5">
          <div className="flex items-start gap-2 mb-2">
            <FileCheck className="w-5 h-5 text-emerald-600 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                {es ? '¿Qué hubiera pasado sin Cruzar Operator?' : 'What would have happened without Cruzar Operator?'}
              </p>
              <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                {es
                  ? 'La descripción "merchandise" en línea 3 hubiera disparado inspección secundaria al cruzar — 2 a 6 horas adicionales en el puente. A $80/hora de costo de operación, eso son $160–$480 perdidos por embarque.'
                  : 'The "merchandise" description on line 3 would have triggered secondary inspection at the crossing — 2 to 6 additional hours at the bridge. At $80/hr operating cost, that\'s $160–$480 lost per shipment.'}
              </p>
            </div>
          </div>
          <Link href="/pricing#operator" className="block mt-3 py-2.5 px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold text-center hover:bg-emerald-700 transition-colors">
            {es ? 'Empezar prueba gratis — $99/mes' : 'Start free trial — $99/mo'}
          </Link>
        </div>
      </div>
    </main>
  )
}
