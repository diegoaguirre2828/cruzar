'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { ArrowLeft, FileText, Plus, Trash2, AlertTriangle, Sparkles } from 'lucide-react'

interface Document {
  id: string
  doc_type: string
  label: string | null
  expires_at: string | null
  shared_with_circle_id: string | null
  created_at: string
}

const DOC_TYPES = [
  'passport', 'passport_card', 'sentri', 'nexus', 'global_entry',
  'mx_id', 'mx_ine', 'mx_passport', 'vehicle_registration', 'insurance',
  'fmm', 'tip_permit', 'other',
]

export default function WalletPage() {
  const { lang } = useLang()
  const [docs, setDocs] = useState<Document[]>([])
  const [docType, setDocType] = useState('passport')
  const [label, setLabel] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [card, setCard] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const t = {
    title: lang === 'es' ? '🪪 Wallet' : '🪪 Wallet',
    subtitle: lang === 'es' ? 'Tus documentos para cruzar — un solo lugar.' : 'Your crossing documents — one place.',
    addNew: lang === 'es' ? 'Agregar documento' : 'Add document',
    type: lang === 'es' ? 'Tipo' : 'Type',
    labelLbl: lang === 'es' ? 'Etiqueta (ej. "Pasaporte de Mamá")' : 'Label (e.g. "Mom\'s passport")',
    expires: lang === 'es' ? 'Vence el' : 'Expires on',
    add: lang === 'es' ? 'Agregar' : 'Add',
    showCard: lang === 'es' ? 'Mostrar tarjeta para el agente' : 'Show agent prep card',
    none: lang === 'es' ? 'Sin documentos aún.' : 'No documents yet.',
    expiresBadge: lang === 'es' ? 'Vence' : 'Expires',
    expired: lang === 'es' ? 'Vencido' : 'Expired',
    expiringSoon: lang === 'es' ? 'Pronto' : 'Soon',
    back: lang === 'es' ? 'Inicio' : 'Home',
    deleteConfirm: lang === 'es' ? '¿Borrar este documento?' : 'Delete this document?',
  }

  async function load() {
    const j = await fetch('/api/wallet').then((r) => r.json()).catch(() => ({ documents: [] }))
    setDocs(j.documents ?? [])
  }
  useEffect(() => { load() }, [])

  async function add() {
    if (!docType) return
    setBusy(true)
    try {
      await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          doc_type: docType,
          label: label || undefined,
          expires_at: expiresAt || undefined,
        }),
      })
      setLabel(''); setExpiresAt('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function del(id: string) {
    if (!confirm(t.deleteConfirm)) return
    await fetch(`/api/wallet/${id}`, { method: 'DELETE' })
    await load()
  }

  async function showCard() {
    const j = await fetch('/api/wallet/agent-card').then((r) => r.json())
    setCard(j.markdown ?? '')
  }

  const today = new Date().toISOString().slice(0, 10)
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-16 pt-6">
        <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 mb-3"><ArrowLeft className="w-3 h-3" /> {t.back}</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t.title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5">{t.subtitle}</p>

        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm mb-6">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> {t.addNew}</h2>
          <div className="space-y-2">
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full text-sm rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2">
              {DOC_TYPES.map((d) => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
            </select>
            <input placeholder={t.labelLbl} value={label} onChange={(e) => setLabel(e.target.value)} className="w-full text-sm rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2" />
            <input type="date" placeholder={t.expires} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full text-sm rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2" />
            <button onClick={add} disabled={busy} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">{t.add}</button>
          </div>
        </section>

        <button onClick={showCard} className="w-full mb-5 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-semibold">
          <Sparkles className="w-4 h-4" /> {t.showCard}
        </button>

        {card && (
          <pre className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-xs whitespace-pre-wrap font-mono mb-6">
{card}
          </pre>
        )}

        <section>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> {lang === 'es' ? 'Mis documentos' : 'My documents'}</h2>
          {docs.length === 0 ? (
            <p className="text-sm text-gray-500">{t.none}</p>
          ) : (
            <ul className="space-y-2">
              {docs.map((d) => {
                const expired = d.expires_at && d.expires_at < today
                const expiringSoon = d.expires_at && !expired && d.expires_at < soon
                return (
                  <li key={d.id} className={`bg-white dark:bg-gray-900 rounded-xl border p-3 text-sm ${expired ? 'border-red-300' : expiringSoon ? 'border-amber-300' : 'border-gray-200 dark:border-gray-800'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{d.doc_type.replace(/_/g, ' ')}{d.label ? ` — ${d.label}` : ''}</div>
                        {d.expires_at && (
                          <div className="text-xs mt-0.5 flex items-center gap-1">
                            {expired
                              ? <span className="text-red-600 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {t.expired} {d.expires_at}</span>
                              : expiringSoon
                                ? <span className="text-amber-600 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {t.expiringSoon} — {d.expires_at}</span>
                                : <span className="text-gray-500">{t.expiresBadge} {d.expires_at}</span>
                            }
                          </div>
                        )}
                      </div>
                      <button onClick={() => del(d.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
