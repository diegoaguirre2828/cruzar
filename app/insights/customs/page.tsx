'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type FormType = 'cbp_7501' | 'pace' | 'padv' | 'immex_manifest' | 'generic_invoice'

interface HsLine {
  hs_code: string
  description: string
  qty: number
  unit: string
  unit_value_usd: number
  origin_country: string
  fta_eligible?: boolean
  fta_criterion?: 'A' | 'B' | 'C' | 'D'
  rvc_pct?: number
}

interface Declaration {
  id: string
  form_type: FormType
  lane: string
  importer_name: string
  exporter_name: string
  invoice_total_usd: number | null
  fta_claimed: string | null
  status: string
  created_at: string
}

const EMPTY_LINE: HsLine = {
  hs_code: '',
  description: '',
  qty: 1,
  unit: 'EA',
  unit_value_usd: 0,
  origin_country: 'MX',
}

export default function CustomsGeneratorPage() {
  const [decls, setDecls] = useState<Declaration[]>([])
  const [formType, setFormType] = useState<FormType>('cbp_7501')
  const [lane, setLane] = useState('Laredo WTB northbound')
  const [importerName, setImporterName] = useState('')
  const [importerEin, setImporterEin] = useState('')
  const [exporterName, setExporterName] = useState('')
  const [originCountry, setOriginCountry] = useState('MX')
  const [destinationCountry, setDestinationCountry] = useState('US')
  const [incoterms, setIncoterms] = useState<string>('FCA')
  const [ftaClaimed, setFtaClaimed] = useState<'USMCA' | 'NONE'>('USMCA')
  const [lines, setLines] = useState<HsLine[]>([EMPTY_LINE])
  const [acked, setAcked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rendered, setRendered] = useState<{ markdown: string; text: string } | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  async function load() {
    const res = await fetch('/api/insights/customs').then((r) => r.json()).catch(() => ({ declarations: [] }))
    setDecls(res.declarations ?? [])
  }
  useEffect(() => { load() }, [])

  function updateLine(i: number, patch: Partial<HsLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function addLine() { setLines((prev) => [...prev, { ...EMPTY_LINE }]) }
  function removeLine(i: number) { setLines((prev) => prev.filter((_, idx) => idx !== i)) }

  async function generate() {
    setBusy(true); setError(null); setRendered(null); setWarnings([])
    try {
      const body = {
        form_type: formType,
        lane,
        importer_name: importerName,
        importer_ein: importerEin || undefined,
        exporter_name: exporterName,
        origin_country: originCountry,
        destination_country: destinationCountry,
        incoterms: incoterms || undefined,
        currency: 'USD',
        fta_claimed: ftaClaimed,
        hs_codes: lines.map((l) => ({
          hs_code: l.hs_code,
          description: l.description,
          qty: Number(l.qty),
          unit: l.unit,
          unit_value_usd: Number(l.unit_value_usd),
          origin_country: l.origin_country,
          fta_eligible: l.fta_eligible ?? (ftaClaimed === 'USMCA'),
          fta_criterion: l.fta_criterion,
          rvc_pct: l.rvc_pct,
        })),
        generator_disclaimer_acked: acked,
      }
      const res = await fetch('/api/insights/customs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'failed')
      setRendered(j.rendered)
      setWarnings(j.warnings || [])
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function copyMd() {
    if (!rendered?.markdown) return
    navigator.clipboard.writeText(rendered.markdown).catch(() => {})
  }

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Customs declaration generator</h1>
            <p className="text-sm text-zinc-500 mt-1">Broker-grade draft for CBP 7501 + MX pedimento + IMMEX manifest. Verify with your licensed broker before filing.</p>
          </div>
          <Link href="/insights/loads" className="text-sm font-medium text-blue-600 hover:underline">← Loads</Link>
        </div>

        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 mb-8 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Form type">
              <select value={formType} onChange={(e) => setFormType(e.target.value as FormType)} className={inputCls}>
                <option value="cbp_7501">CBP 7501 (US entry summary)</option>
                <option value="pace">Pedimento PACE (MX)</option>
                <option value="padv">Pedimento de Aviso (MX)</option>
                <option value="immex_manifest">IMMEX manifest</option>
                <option value="generic_invoice">Commercial invoice</option>
              </select>
            </Field>
            <Field label="Lane">
              <input value={lane} onChange={(e) => setLane(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Importer name">
              <input value={importerName} onChange={(e) => setImporterName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Importer EIN / IRS #">
              <input value={importerEin} onChange={(e) => setImporterEin(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Exporter name">
              <input value={exporterName} onChange={(e) => setExporterName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Origin / Destination">
              <div className="flex gap-2">
                <input value={originCountry} onChange={(e) => setOriginCountry(e.target.value.toUpperCase())} className={inputCls + ' uppercase'} maxLength={2} />
                <span className="self-center text-sm text-zinc-500">→</span>
                <input value={destinationCountry} onChange={(e) => setDestinationCountry(e.target.value.toUpperCase())} className={inputCls + ' uppercase'} maxLength={2} />
              </div>
            </Field>
            <Field label="Incoterms 2020">
              <select value={incoterms} onChange={(e) => setIncoterms(e.target.value)} className={inputCls}>
                {['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DDP', 'FOB', 'CFR', 'CIF'].map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="FTA claim">
              <select value={ftaClaimed} onChange={(e) => setFtaClaimed(e.target.value as 'USMCA' | 'NONE')} className={inputCls}>
                <option value="USMCA">USMCA</option>
                <option value="NONE">No FTA</option>
              </select>
            </Field>
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Line items</h3>
              <button onClick={addLine} className="text-xs font-medium text-blue-600 hover:underline">+ Add line</button>
            </div>
            <div className="space-y-3">
              {lines.map((l, i) => (
                <div key={i} className="bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="HS code (10-dig)" value={l.hs_code} onChange={(e) => updateLine(i, { hs_code: e.target.value })} className={inputCls} />
                    <input placeholder="Description" value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} className={inputCls} />
                    <input type="number" step="any" placeholder="Qty" value={l.qty} onChange={(e) => updateLine(i, { qty: parseFloat(e.target.value || '0') })} className={inputCls} />
                    <input placeholder="Unit (EA/KG)" value={l.unit} onChange={(e) => updateLine(i, { unit: e.target.value })} className={inputCls} />
                    <input type="number" step="any" placeholder="Unit value USD" value={l.unit_value_usd} onChange={(e) => updateLine(i, { unit_value_usd: parseFloat(e.target.value || '0') })} className={inputCls} />
                    <input placeholder="Origin (ISO-2)" value={l.origin_country} onChange={(e) => updateLine(i, { origin_country: e.target.value.toUpperCase() })} className={inputCls + ' uppercase'} maxLength={2} />
                    {ftaClaimed === 'USMCA' && (
                      <>
                        <select value={l.fta_criterion ?? ''} onChange={(e) => updateLine(i, { fta_criterion: (e.target.value || undefined) as 'A' | 'B' | 'C' | 'D' | undefined })} className={inputCls}>
                          <option value="">USMCA criterion…</option>
                          <option value="A">A — wholly obtained</option>
                          <option value="B">B — tariff shift / RVC</option>
                          <option value="C">C — produced from originating</option>
                          <option value="D">D — except. for ch. 84/85</option>
                        </select>
                        <input type="number" step="any" placeholder="RVC % (if criterion B)" value={l.rvc_pct ?? ''} onChange={(e) => updateLine(i, { rvc_pct: parseFloat(e.target.value || '0') })} className={inputCls} />
                      </>
                    )}
                  </div>
                  <div className="text-right mt-2">
                    <button onClick={() => removeLine(i)} className="text-xs text-red-500 hover:underline">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <input type="checkbox" checked={acked} onChange={(e) => setAcked(e.target.checked)} className="mt-0.5" />
            <span>I acknowledge this is a working draft, not a filing. I will verify HS classification and duty rates with my licensed customs broker before submitting through ACE/SAAI.</span>
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button onClick={generate} disabled={busy} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
            {busy ? 'Generating…' : 'Generate declaration'}
          </button>
        </section>

        {warnings.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">Compliance warnings</h3>
            <ul className="list-disc list-inside text-xs text-amber-800 dark:text-amber-300 space-y-1">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        {rendered && (
          <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 mb-8 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Rendered declaration</h3>
              <button onClick={copyMd} className="text-xs font-medium text-blue-600 hover:underline">Copy markdown</button>
            </div>
            <pre className="text-xs whitespace-pre-wrap font-mono bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 max-h-[500px] overflow-auto">
{rendered.markdown}
            </pre>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold mb-3">Recent declarations</h2>
          {decls.length === 0 ? (
            <p className="text-sm text-zinc-500">No declarations yet.</p>
          ) : (
            <ul className="space-y-2">
              {decls.map((d) => (
                <li key={d.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{d.form_type.toUpperCase()} · {d.importer_name} → {d.exporter_name}</span>
                    <span className="text-xs text-zinc-500">${(d.invoice_total_usd ?? 0).toFixed(2)} · {d.status}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">{d.lane} · {d.fta_claimed ?? 'no FTA'} · {new Date(d.created_at).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}

const inputCls = 'w-full text-sm rounded-lg bg-stone-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{label}</label>
      {children}
    </div>
  )
}
