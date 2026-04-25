'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { ArrowLeft, Upload, FileCheck, AlertTriangle, FileText } from 'lucide-react'
import { LangToggle } from '@/components/LangToggle'

interface Issue { severity: string; field: string; problem: string; fix: string }
interface ValidationResult {
  id: string
  doc_kind: string
  source_url: string
  extracted_fields: Record<string, unknown>
  issues: Issue[]
  severity: 'clean' | 'minor' | 'blocker'
  ai_summary: string
  ms_to_complete: number
}

const DOC_KINDS = [
  { id: 'pedimento',         labelEs: 'Pedimento',        labelEn: 'Pedimento (MX entry)' },
  { id: 'commercial_invoice', labelEs: 'Factura comercial', labelEn: 'Commercial invoice' },
  { id: 'usmca_cert',         labelEs: 'Certificado USMCA', labelEn: 'USMCA Certificate of Origin' },
  { id: 'packing_list',       labelEs: 'Lista de empaque',  labelEn: 'Packing list' },
  { id: 'bill_of_lading',     labelEs: 'Conocimiento (BL)', labelEn: 'Bill of Lading' },
] as const

export default function OperatorPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { lang } = useLang()
  const [tier, setTier] = useState<string>('')
  const [kind, setKind] = useState<typeof DOC_KINDS[number]['id']>('pedimento')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [history, setHistory] = useState<ValidationResult[]>([])

  // No redirect for anon visitors — they see the public hero + sample.
  useEffect(() => {
    if (!user) return
    fetch('/api/profile').then(r => r.json()).then(d => setTier(String(d?.profile?.tier ?? 'free')))
    fetch('/api/operator/history').then(r => r.ok ? r.json() : { items: [] }).then(d => setHistory(d.items || []))
  }, [user])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setSubmitting(true)
    setError('')
    setResult(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('kind', kind)
    const res = await fetch('/api/operator/validate', { method: 'POST', body: fd })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) {
      setError(data.error || `${res.status}`)
      return
    }
    setResult(data)
    setHistory((prev) => [data as ValidationResult, ...prev].slice(0, 50))
    setFile(null)
  }

  if (authLoading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" /></div>
  }

  // Public hero for anonymous visitors — explains the product, links
  // to the live sample, points to pricing for signup. No upload form
  // until they sign in + subscribe.
  if (!user) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-2xl mx-auto px-4 pb-16">
          <div className="pt-6 pb-4 flex items-center justify-between gap-3">
            <Link href="/" className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <LangToggle />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm mb-4">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-blue-600 dark:text-blue-400 mb-1">
              Cruzar Operator · $99/mo
            </p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              {lang === 'es'
                ? 'Cuts pedimento prep from 2 hours to 3 minutes'
                : 'Cuts pedimento prep from 2 hours to 3 minutes'}
            </h1>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              {lang === 'es'
                ? 'Sube tu pedimento, factura comercial, certificado USMCA, lista de empaque o BL. La IA marca cada error que dispararía una inspección secundaria — antes de que tu camión llegue al puente. Hasta 34% más rápido en el cruce.'
                : 'Upload your pedimento, commercial invoice, USMCA cert, packing list, or BOL. AI flags every error that would trigger secondary inspection — before your truck reaches the bridge. Up to 34% faster clearance.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              <Link href="/operator/sample" className="py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-bold text-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                {lang === 'es' ? 'Ver una validación de muestra →' : 'See a sample validation →'}
              </Link>
              <Link href="/pricing#operator" className="py-2.5 px-4 rounded-xl bg-blue-600 text-white text-sm font-bold text-center hover:bg-blue-700 transition-colors">
                {lang === 'es' ? 'Empezar prueba gratuita' : 'Start free trial'}
              </Link>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {lang === 'es' ? '7 días gratis · cancela cuando quieras · sin tarjeta' : '7 days free · cancel anytime · no card required'}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? 'Documentos que validamos' : 'Documents we validate'}
            </h2>
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1.5">
              <li>{lang === 'es' ? '• Pedimento (entrada México) — número, RFC, valor en aduana, fracciones arancelarias' : '• Pedimento (Mexican entry) — number, RFC, valor en aduana, HS codes'}</li>
              <li>{lang === 'es' ? '• Factura comercial — Incoterm, país de origen, sumas, tax IDs' : '• Commercial invoice — Incoterm, country of origin, totals, tax IDs'}</li>
              <li>{lang === 'es' ? '• Certificado USMCA — período, criterio de origen, firma, HS clasificación' : '• USMCA Certificate — blanket period, origin criterion, signature, HS classification'}</li>
              <li>{lang === 'es' ? '• Lista de empaque — pesos, marcas, PO, descripciones' : '• Packing list — weights, marks, PO, descriptions'}</li>
              <li>{lang === 'es' ? '• Bill of Lading — sellos, contenedor, freight terms' : '• Bill of Lading — seals, container, freight terms'}</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
              {lang === 'es' ? 'Cómo funciona' : 'How it works'}
            </h2>
            <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-1.5 list-decimal list-inside">
              <li>{lang === 'es' ? 'Suscríbete por $99/mes (7 días gratis)' : 'Subscribe for $99/mo (7-day free trial)'}</li>
              <li>{lang === 'es' ? 'Sube cualquiera de los 5 documentos arriba (PDF, PNG, JPEG)' : 'Upload any of the 5 documents above (PDF, PNG, JPEG)'}</li>
              <li>{lang === 'es' ? 'En menos de 60 segundos: lista de errores con corrección sugerida por campo' : 'In under 60 seconds: list of issues with field-by-field suggested fixes'}</li>
              <li>{lang === 'es' ? 'Corriges antes de que tu broker la presente — evitas la inspección secundaria' : 'Fix before your broker submits — avoid secondary inspection'}</li>
            </ol>
          </div>

          <div className="mt-4 text-center">
            <Link href="/express-cert" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
              {lang === 'es' ? 'Acelera tu certificación C-TPAT / OEA →' : 'Express C-TPAT / OEA certification →'}
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const isOperator = tier === 'operator' || tier === 'business'

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <div className="pt-6 pb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {lang === 'es' ? 'Cruzar Operator' : 'Cruzar Operator'}
            </h1>
          </div>
          <LangToggle />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-4">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {lang === 'es' ? 'Validación de papelería antes del cruce' : 'Pre-cross paperwork validation'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {lang === 'es'
              ? 'Sube tu pedimento, factura, o certificado USMCA. La IA revisa errores comunes en menos de 60 segundos. Convierte 2 horas de prep en 3 minutos. Hasta 34% más rápido en el puente.'
              : 'Upload your pedimento, commercial invoice, or USMCA cert. AI flags common errors in under 60 seconds. Cuts 2-hour prep to 3 minutes. Up to 34% faster border clearance.'}
          </p>
        </div>

        {!isOperator && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 mb-4">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
              {lang === 'es' ? 'Suscripción Cruzar Operator requerida' : 'Cruzar Operator subscription required'}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 mb-3">
              {lang === 'es' ? '$99/mes — validaciones ilimitadas + alertas de inteligencia.' : '$99/mo — unlimited validations + intelligence alerts.'}
            </p>
            <Link href="/pricing#operator" className="inline-block px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold">
              {lang === 'es' ? 'Empezar prueba gratuita' : 'Start free trial'}
            </Link>
          </div>
        )}

        <form onSubmit={submit} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-4">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
            {lang === 'es' ? 'Tipo de documento' : 'Document kind'}
          </label>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {DOC_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors text-left ${kind === k.id ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
              >
                {lang === 'es' ? k.labelEs : k.labelEn}
              </button>
            ))}
          </div>

          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
            {lang === 'es' ? 'Archivo (PDF, PNG, JPEG · 10 MB max)' : 'File (PDF, PNG, JPEG · 10 MB max)'}
          </label>
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-gray-700 dark:text-gray-300 mb-3 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:dark:bg-gray-700 file:text-gray-700 file:dark:text-gray-300"
          />

          <button
            type="submit"
            disabled={!file || submitting || !isOperator}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {submitting ? (lang === 'es' ? 'Analizando…' : 'Analyzing…') : (lang === 'es' ? 'Validar documento' : 'Validate document')}
          </button>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </form>

        {result && (
          <div className={`rounded-2xl border p-5 shadow-sm mb-4 ${result.severity === 'blocker' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : result.severity === 'minor' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'}`}>
            <div className="flex items-start gap-2 mb-2">
              {result.severity === 'clean'
                ? <FileCheck className="w-5 h-5 text-emerald-600" />
                : <AlertTriangle className={`w-5 h-5 ${result.severity === 'blocker' ? 'text-red-600' : 'text-amber-600'}`} />}
              <div>
                <p className={`text-sm font-bold ${result.severity === 'blocker' ? 'text-red-800 dark:text-red-300' : result.severity === 'minor' ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300'}`}>
                  {result.severity === 'clean' ? (lang === 'es' ? 'Listo para cruzar' : 'Ready to cross') : result.severity === 'minor' ? (lang === 'es' ? 'Avisos menores' : 'Minor flags') : (lang === 'es' ? 'Bloqueador — corrige antes de enviar' : 'Blocker — fix before submitting')}
                </p>
                <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">{result.ai_summary}</p>
                <p className="text-[10px] text-gray-500 mt-1">{Math.round(result.ms_to_complete / 1000)}s</p>
              </div>
            </div>

            {result.issues.length > 0 && (
              <div className="mt-3 space-y-2">
                {result.issues.map((iss, i) => (
                  <div key={i} className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{iss.field}</p>
                      <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${iss.severity === 'blocker' ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'}`}>{iss.severity}</span>
                    </div>
                    <p className="text-xs text-gray-700 dark:text-gray-300">{iss.problem}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">→ {iss.fix}</p>
                  </div>
                ))}
              </div>
            )}

            {Object.keys(result.extracted_fields || {}).length > 0 && (
              <details className="mt-3">
                <summary className="text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                  {lang === 'es' ? 'Campos extraídos' : 'Extracted fields'}
                </summary>
                <pre className="mt-2 text-[11px] text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 p-3 rounded-lg overflow-auto">
                  {JSON.stringify(result.extracted_fields, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {lang === 'es' ? 'Validaciones anteriores' : 'Past validations'}
            </h2>
            <ul className="space-y-2">
              {history.slice(0, 10).map((h) => (
                <li key={h.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 dark:text-gray-300 truncate">{h.doc_kind}</span>
                  <span className={`font-bold ${h.severity === 'blocker' ? 'text-red-600' : h.severity === 'minor' ? 'text-amber-600' : 'text-emerald-600'}`}>{h.severity}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 text-center">
          <Link href="/express-cert" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            {lang === 'es' ? 'Acelera tu certificación C-TPAT / OEA →' : 'Express C-TPAT / OEA certification →'}
          </Link>
        </div>
      </div>
    </main>
  )
}
