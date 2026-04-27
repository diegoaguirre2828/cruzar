'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { ArrowLeft, AlertOctagon, Phone, UserPlus, Trash2 } from 'lucide-react'
import { SAFETY_SCRIPTS, type EmergencyKind } from '@/lib/safetyScripts'

interface Contact {
  id: string
  display_name: string
  phone: string | null
  email: string | null
  relation: string | null
  priority: number
}

const KINDS: EmergencyKind[] = [
  'secondary_inspection', 'vehicle_breakdown', 'accident',
  'lost_sentri', 'document_seizure', 'medical', 'other',
]

export default function SosPage() {
  const { lang } = useLang()
  const [kind, setKind] = useState<EmergencyKind>('secondary_inspection')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [notes, setNotes] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // contact form
  const [cName, setCName] = useState('')
  const [cPhone, setCPhone] = useState('')
  const [cEmail, setCEmail] = useState('')
  const [cRelation, setCRelation] = useState('')

  const t = {
    title: lang === 'es' ? '🚨 SOS' : '🚨 SOS',
    subtitle: lang === 'es' ? 'Modo emergencia con guías y avisos a tu gente.' : 'Emergency mode with scripts and family alerts.',
    pickKind: lang === 'es' ? '¿Qué pasó?' : 'What happened?',
    notesLabel: lang === 'es' ? 'Notas (opcional)' : 'Notes (optional)',
    fire: lang === 'es' ? 'Activar SOS y avisar a mi gente' : 'Activate SOS and notify my people',
    sentNote: lang === 'es' ? 'SOS activado. Tus contactos y círculo recibieron aviso.' : 'SOS activated. Contacts and circle notified.',
    contactsTitle: lang === 'es' ? 'Mis contactos de emergencia' : 'My emergency contacts',
    addContact: lang === 'es' ? 'Agregar contacto' : 'Add contact',
    name: lang === 'es' ? 'Nombre' : 'Name',
    relation: lang === 'es' ? 'Relación (esposo, abogado, etc.)' : 'Relation (spouse, attorney, etc.)',
    add: lang === 'es' ? 'Agregar' : 'Add',
    none: lang === 'es' ? 'Sin contactos aún. Agrega al menos uno.' : 'No contacts yet. Add at least one.',
    steps: lang === 'es' ? 'Pasos' : 'Steps',
    phrases: lang === 'es' ? 'Frases listas' : 'Ready phrases',
    hotlines: lang === 'es' ? 'Teléfonos clave' : 'Key hotlines',
    back: lang === 'es' ? 'Inicio' : 'Home',
  }

  async function loadContacts() {
    const j = await fetch('/api/safety/contacts').then((r) => r.json()).catch(() => ({ contacts: [] }))
    setContacts(j.contacts ?? [])
  }
  useEffect(() => {
    loadContacts()
    navigator.geolocation?.getCurrentPosition((p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }), () => {}, { maximumAge: 60000, timeout: 10000 })
  }, [])

  async function addContact() {
    if (!cName) return
    await fetch('/api/safety/contacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        display_name: cName,
        phone: cPhone || undefined,
        email: cEmail || undefined,
        relation: cRelation || undefined,
      }),
    })
    setCName(''); setCPhone(''); setCEmail(''); setCRelation('')
    loadContacts()
  }
  async function delContact(id: string) {
    await fetch(`/api/safety/contacts?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    loadContacts()
  }

  async function fireSos() {
    setBusy(true); setSent(null)
    try {
      const r = await fetch('/api/safety/sos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind,
          lat: coords?.lat,
          lng: coords?.lng,
          notes: notes || undefined,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'failed')
      setSent(t.sentNote)
    } catch (e) {
      setSent((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const script = SAFETY_SCRIPTS[kind]

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-16 pt-6">
        <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 mb-3"><ArrowLeft className="w-3 h-3" /> {t.back}</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t.title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5">{t.subtitle}</p>

        <section className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-5 shadow-sm mb-6">
          <h2 className="text-sm font-semibold mb-3 text-red-800 dark:text-red-200 flex items-center gap-2"><AlertOctagon className="w-4 h-4" /> {t.pickKind}</h2>
          <select value={kind} onChange={(e) => setKind(e.target.value as EmergencyKind)} className="w-full text-sm rounded-lg bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 px-3 py-2 mb-3">
            {KINDS.map((k) => <option key={k} value={k}>{lang === 'es' ? SAFETY_SCRIPTS[k].title_es : SAFETY_SCRIPTS[k].title_en}</option>)}
          </select>
          <textarea placeholder={t.notesLabel} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full text-sm rounded-lg bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 px-3 py-2 mb-3" />
          <button onClick={fireSos} disabled={busy} className="w-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-3 rounded-lg disabled:opacity-50">
            {busy ? '…' : t.fire}
          </button>
          {sent && <p className="text-xs text-red-800 dark:text-red-200 mt-3">{sent}</p>}
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm mb-4">
          <h3 className="text-sm font-semibold mb-2">{t.steps}</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
            {(lang === 'es' ? script.steps_es : script.steps_en).map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm mb-4">
          <h3 className="text-sm font-semibold mb-2">{t.phrases}</h3>
          <ul className="space-y-1 text-sm">
            {script.phrases.map((p, i) => (
              <li key={i}>
                <div className="font-medium">{lang === 'es' ? p.es : p.en}</div>
                <div className="text-xs text-gray-500">{lang === 'es' ? p.en : p.es}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm mb-6">
          <h3 className="text-sm font-semibold mb-2">{t.hotlines}</h3>
          <ul className="space-y-1 text-sm">
            {script.hotlines.map((h, i) => (
              <li key={i} className="flex items-center justify-between">
                <span>{lang === 'es' ? h.label_es : h.label_en}</span>
                <a href={`tel:${h.number.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                  <Phone className="w-3 h-3" /> {h.number}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><UserPlus className="w-4 h-4" /> {t.contactsTitle}</h3>
          {contacts.length === 0 ? <p className="text-sm text-gray-500 mb-3">{t.none}</p> : (
            <ul className="space-y-2 mb-3">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span>
                    <strong>{c.display_name}</strong>
                    {c.relation && <span className="text-gray-500"> · {c.relation}</span>}
                    {c.phone && <span className="text-gray-500"> · {c.phone}</span>}
                  </span>
                  <button onClick={() => delContact(c.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2">
            <input placeholder={t.name} value={cName} onChange={(e) => setCName(e.target.value)} className="w-full text-sm rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2" />
            <input placeholder={t.relation} value={cRelation} onChange={(e) => setCRelation(e.target.value)} className="w-full text-sm rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2" />
            <input placeholder="Phone" value={cPhone} onChange={(e) => setCPhone(e.target.value)} className="w-full text-sm rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2" />
            <input placeholder="Email" type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} className="w-full text-sm rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2" />
            <button onClick={addContact} disabled={!cName} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-50">{t.add}</button>
          </div>
        </section>
      </div>
    </main>
  )
}
