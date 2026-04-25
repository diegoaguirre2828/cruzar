'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { ArrowLeft, ShieldCheck, FileText } from 'lucide-react'

interface Application {
  id: string
  program: 'ctpat' | 'oea'
  status: 'draft' | 'paid' | 'generated' | 'submitted'
  answers: Record<string, string>
  generated_pdf_url: string | null
}

const QUESTIONS = [
  { id: 'company_legal_name',  labelEn: 'Legal company name',                       labelEs: 'Razón social' },
  { id: 'company_dba',          labelEn: 'DBA / Trade name',                         labelEs: 'Nombre comercial' },
  { id: 'company_address',      labelEn: 'Headquarters address',                     labelEs: 'Domicilio de la sede' },
  { id: 'tax_id_us',            labelEn: 'US tax ID (EIN)',                          labelEs: 'EIN (IRS US)' },
  { id: 'tax_id_mx',            labelEn: 'Mexican RFC (if applicable)',              labelEs: 'RFC (si aplica)' },
  { id: 'business_activity',    labelEn: 'Business activity (one sentence)',         labelEs: 'Actividad comercial (una oración)' },
  { id: 'years_in_business',    labelEn: 'Years in business',                        labelEs: 'Años en operación' },
  { id: 'fleet_size',           labelEn: 'Number of trucks / drivers',                labelEs: 'Número de unidades / operadores' },
  { id: 'annual_loads',         labelEn: 'Approx. annual border crossings',           labelEs: 'Cruces fronterizos anuales aprox.' },
  { id: 'main_corridors',       labelEn: 'Main corridors used (e.g. Laredo-Nuevo Laredo)', labelEs: 'Corredores principales (ej. Laredo-Nvo. Laredo)' },
  { id: 'top_commodities',      labelEn: 'Top 3 commodity types you ship',           labelEs: 'Top 3 mercancías que mueves' },
  { id: 'top_partners',         labelEn: 'Top 3 trading partners (importer / exporter names)', labelEs: 'Top 3 socios comerciales (nombres)' },
  { id: 'security_officer',     labelEn: 'Security point of contact (name + email)', labelEs: 'Responsable de seguridad (nombre + correo)' },
  { id: 'container_seals',      labelEn: 'Do you use ISO 17712 high-security seals? (yes/no)', labelEs: '¿Usan sellos ISO 17712? (sí/no)' },
  { id: 'driver_screening',     labelEn: 'How are drivers background-checked? (one paragraph)', labelEs: '¿Cómo se verifica antecedentes de operadores? (un párrafo)' },
  { id: 'gps_tracking',         labelEn: 'Do you use real-time GPS on trailers? (yes/no + vendor)', labelEs: '¿GPS en tiempo real en remolques? (sí/no + proveedor)' },
  { id: 'facility_security',    labelEn: 'Yard / facility physical security (gates, cameras, etc.)', labelEs: 'Seguridad del patio / instalaciones' },
  { id: 'cybersecurity',        labelEn: 'Cybersecurity practices (one paragraph)',  labelEs: 'Ciberseguridad (un párrafo)' },
  { id: 'training_program',     labelEn: 'Security training program (one paragraph)', labelEs: 'Programa de capacitación en seguridad (un párrafo)' },
  { id: 'past_violations',      labelEn: 'Any past CBP violations? (yes/no + brief)', labelEs: '¿Violaciones previas de CBP? (sí/no + breve)' },
] as const

export default function ExpressCertPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { lang } = useLang()
  const [program, setProgram] = useState<'ctpat' | 'oea'>('ctpat')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [app, setApp] = useState<Application | null>(null)
  const [saving, setSaving] = useState(false)
  const [paying, setPaying] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login?next=/express-cert')
  }, [user, authLoading, router])

  async function save() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/express-cert/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ program, answers }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || `${res.status}`); return }
    setApp({ id: data.id, program, status: data.status, answers, generated_pdf_url: null })
  }

  async function pay() {
    if (!app) return
    setPaying(true)
    setError('')
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'express_cert' }),
    })
    const data = await res.json()
    setPaying(false)
    if (!res.ok) { setError(data.error || `${res.status}`); return }
    window.location.href = data.url
  }

  async function generate() {
    if (!app) return
    setGenerating(true)
    setError('')
    const res = await fetch('/api/express-cert/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: app.id }),
    })
    const data = await res.json()
    setGenerating(false)
    if (!res.ok) { setError(data.error || `${res.status}`); return }
    router.push(`/express-cert/${app.id}/print`)
  }

  if (authLoading || !user) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" /></div>
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <div className="pt-6 pb-4 flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            {lang === 'es' ? 'Express Cert' : 'Express Cert'}
          </h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-4">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {lang === 'es' ? 'Acelera tu certificación C-TPAT u OEA' : 'AI-assisted C-TPAT or OEA application'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {lang === 'es'
              ? 'Contesta 20 preguntas. La IA arma tu solicitud completa lista para enviar. $499 una sola vez. Te ahorra $50k+/año en demoras una vez aprobado.'
              : 'Answer 20 questions. AI builds your complete submission-ready application. $499 one-time. Saves $50k+/yr in delays once approved.'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-4">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
            {lang === 'es' ? 'Programa' : 'Program'}
          </label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {([
              { id: 'ctpat', label: 'C-TPAT (US)' },
              { id: 'oea',   label: 'OEA (México)' },
            ] as const).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setProgram(id)}
                className={`py-2.5 px-3 rounded-xl text-sm font-bold transition-colors ${program === id ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {QUESTIONS.map((q) => (
              <div key={q.id}>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                  {lang === 'es' ? q.labelEs : q.labelEn}
                </label>
                <textarea
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  rows={2}
                  className="w-full text-xs text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 resize-none"
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-sm font-bold disabled:opacity-50"
            >
              {saving ? (lang === 'es' ? 'Guardando…' : 'Saving…') : (lang === 'es' ? 'Guardar borrador' : 'Save draft')}
            </button>
            {app?.status === 'draft' && (
              <button
                onClick={pay}
                disabled={paying}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50"
              >
                {paying ? (lang === 'es' ? 'Redirigiendo…' : 'Redirecting…') : (lang === 'es' ? 'Pagar $499 + generar' : 'Pay $499 + generate')}
              </button>
            )}
            {app?.status === 'paid' && (
              <button
                onClick={generate}
                disabled={generating}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50"
              >
                {generating ? (lang === 'es' ? 'Generando…' : 'Generating…') : (lang === 'es' ? 'Generar solicitud' : 'Generate application')}
              </button>
            )}
            {app?.status === 'generated' && (
              <Link
                href={`/express-cert/${app.id}/print`}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold text-center flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                {lang === 'es' ? 'Ver / imprimir' : 'View / print'}
              </Link>
            )}
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      </div>
    </main>
  )
}
