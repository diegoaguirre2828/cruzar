'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, CheckSquare, Square, RotateCcw, Share2, Check, Printer, Truck, ExternalLink } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

type Lane = 'standard' | 'fast' | 'express' | 'empty'
type Cargo = 'dry' | 'produce' | 'refrigerated' | 'hazmat' | 'livestock' | 'auto_parts'

interface ChecklistItem {
  id: string
  text: { en: string; es: string }
  note?: { en: string; es: string }
  required: boolean
}

const COMMON_ITEMS: ChecklistItem[] = [
  {
    id: 'ace_manifest',
    text: { en: 'ACE eManifest filed (cargo + driver + truck)', es: 'eManifest ACE presentado (carga + conductor + camión)' },
    note: { en: 'Standard: 30 min before arrival. FAST: 1 hr+. File at ace.cbp.gov or via your broker.', es: 'Estándar: 30 min antes de llegar. FAST: 1+ hr. Presenta en ace.cbp.gov o vía tu agente.' },
    required: true,
  },
  {
    id: 'driver_passport',
    text: { en: 'Driver passport + commercial driver license (CDL)', es: 'Pasaporte del conductor + licencia de conducir comercial (CDL)' },
    note: { en: 'Mexican drivers: SCT-issued operator license or B-1 visa for US delivery.', es: 'Conductores mexicanos: licencia de operador SCT o visa B-1 para entrega en EE.UU.' },
    required: true,
  },
  {
    id: 'truck_papers',
    text: { en: 'Truck registration + IRP cab card + IFTA decal', es: 'Registración del camión + tarjeta IRP + calcomanía IFTA' },
    note: { en: 'Plus current annual DOT inspection sticker. CBP can ask for any of these.', es: 'Más calcomanía actual de inspección anual DOT. CBP puede pedir cualquiera.' },
    required: true,
  },
  {
    id: 'mx_insurance',
    text: { en: 'Mexico commercial auto insurance (for southbound + return)', es: 'Seguro comercial mexicano (para sur + regreso)' },
    note: { en: 'US policy is NOT valid in Mexico. Required by Mexican federal law.', es: 'La póliza de EE.UU. NO es válida en México. Obligatorio por ley federal mexicana.' },
    required: true,
  },
  {
    id: 'bol',
    text: { en: 'Bill of Lading (BOL) — original + copies', es: 'Conocimiento de embarque (BOL) — original + copias' },
    note: { en: 'Must match the eManifest exactly. Discrepancy = secondary inspection.', es: 'Debe coincidir con el eManifest exactamente. Discrepancia = inspección secundaria.' },
    required: true,
  },
  {
    id: 'commercial_invoice',
    text: { en: 'Commercial invoice (HS code, value, terms)', es: 'Factura comercial (código HS, valor, términos)' },
    note: { en: 'Per-line HS classification + Incoterm (FOB/EXW/DAP). Broker uses this to clear.', es: 'Clasificación HS por línea + Incoterm (FOB/EXW/DAP). El agente la usa para liberar.' },
    required: true,
  },
  {
    id: 'packing_list',
    text: { en: 'Packing list (cartons, weights, dimensions)', es: 'Lista de empaque (cajas, pesos, dimensiones)' },
    required: true,
  },
  {
    id: 'usmca_cert',
    text: { en: 'USMCA certificate of origin (for duty-free claim)', es: 'Certificado de origen USMCA (para reclamo libre de impuestos)' },
    note: { en: 'Required to claim USMCA preference. Without it, MFN duty applies.', es: 'Requerido para reclamar preferencia USMCA. Sin él, se aplica arancel NMF.' },
    required: false,
  },
  {
    id: 'broker_contact',
    text: { en: 'Customs broker filer code + 24/7 phone', es: 'Código de filer del agente aduanal + teléfono 24/7' },
    note: { en: 'Driver should have on phone — primary inspection issues need broker on the line FAST.', es: 'El conductor debe tenerlo en el teléfono — problemas en primaria necesitan al agente RÁPIDO.' },
    required: true,
  },
]

const FAST_ITEMS: ChecklistItem[] = [
  {
    id: 'fast_card_driver',
    text: { en: 'FAST card (driver) — current + valid', es: 'Tarjeta FAST (conductor) — vigente y válida' },
    note: { en: 'CBP-issued, 5-yr validity. Driver must be FAST-approved or trip is standard-lane.', es: 'Emitida por CBP, vigencia 5 años. Conductor debe ser FAST-aprobado o el viaje es carril estándar.' },
    required: true,
  },
  {
    id: 'fast_carrier',
    text: { en: 'Carrier C-TPAT certification on file (FAST + C-TPAT)', es: 'Certificación C-TPAT del transportista en archivo (FAST + C-TPAT)' },
    note: { en: 'Both shipper + carrier must be C-TPAT certified. Lapsed cert = no FAST lane.', es: 'Tanto remitente como transportista deben estar certificados C-TPAT. Certificación vencida = sin carril FAST.' },
    required: true,
  },
  {
    id: 'fast_pre_arrival',
    text: { en: 'eManifest pre-filed ≥1 hour before arrival', es: 'eManifest pre-presentado ≥1 hora antes de llegar' },
    required: true,
  },
]

const CARGO_PRODUCE: ChecklistItem[] = [
  {
    id: 'ppq_587',
    text: { en: 'USDA PPQ Form 587 — Plant inspection request', es: 'Formulario USDA PPQ 587 — Solicitud de inspección vegetal' },
    note: { en: 'Required for fresh fruits, vegetables, plants. Filed in advance via APHIS.', es: 'Requerido para frutas, verduras, plantas frescas. Presentar por adelantado vía APHIS.' },
    required: true,
  },
  {
    id: 'aphis_permit',
    text: { en: 'APHIS import permit (per-commodity)', es: 'Permiso de importación APHIS (por mercancía)' },
    note: { en: 'Tomatoes, citrus, avocados etc. each have specific permit + treatment requirements.', es: 'Tomates, cítricos, aguacates etc. tienen requisitos específicos de permiso + tratamiento.' },
    required: true,
  },
  {
    id: 'phyto_cert',
    text: { en: 'Mexican phytosanitary certificate (SENASICA)', es: 'Certificado fitosanitario mexicano (SENASICA)' },
    required: true,
  },
  {
    id: 'cold_chain',
    text: { en: 'Cold-chain temperature log (if reefer cargo)', es: 'Registro de cadena de frío (si la carga es refrigerada)' },
    required: false,
  },
]

const CARGO_REFRIGERATED: ChecklistItem[] = [
  {
    id: 'temp_log',
    text: { en: 'Continuous temperature log (printable, signed)', es: 'Registro continuo de temperatura (imprimible, firmado)' },
    note: { en: 'CBP can demand at primary. Out-of-range readings = potential cargo rejection.', es: 'CBP puede pedirlo en primaria. Lecturas fuera de rango = posible rechazo de carga.' },
    required: true,
  },
  {
    id: 'fda_prior_notice',
    text: { en: 'FDA Prior Notice (food + beverage)', es: 'Aviso previo FDA (alimentos + bebidas)' },
    note: { en: 'File at access.fda.gov — minimum 4hr before arrival for truck shipments.', es: 'Presentar en access.fda.gov — mínimo 4hr antes de llegar para envíos en camión.' },
    required: true,
  },
  {
    id: 'ippc_pallets',
    text: { en: 'IPPC heat-treatment stamps on wood pallets (ISPM 15)', es: 'Estampas IPPC tratamiento térmico en tarimas de madera (ISPM 15)' },
    note: { en: 'No stamp = pallets get rejected at primary. Use plastic or stamped wood.', es: 'Sin estampa = tarimas rechazadas en primaria. Usa plástico o madera estampada.' },
    required: true,
  },
]

const CARGO_HAZMAT: ChecklistItem[] = [
  {
    id: 'hazmat_manifest',
    text: { en: 'Hazmat manifest — UN # + class + packing group per line', es: 'Manifiesto de materiales peligrosos — UN # + clase + grupo de empaque por línea' },
    required: true,
  },
  {
    id: 'placards',
    text: { en: 'DOT placards posted on truck (4 sides)', es: 'Placas DOT colocadas en el camión (4 lados)' },
    note: { en: 'Wrong/missing placards = SDDC violation + driver out of service.', es: 'Placas incorrectas/faltantes = violación SDDC + conductor fuera de servicio.' },
    required: true,
  },
  {
    id: 'msds',
    text: { en: 'SDS (Safety Data Sheet) per chemical, accessible in cab', es: 'SDS (Hoja de Datos de Seguridad) por químico, accesible en la cabina' },
    required: true,
  },
  {
    id: 'driver_hazmat_endorsement',
    text: { en: 'Driver CDL hazmat endorsement (HazMat-H) — current', es: 'Endoso de materiales peligrosos en CDL del conductor (HazMat-H) — vigente' },
    required: true,
  },
  {
    id: 'expect_secondary',
    text: { en: 'Expect secondary inspection — budget 2-4 hr extra', es: 'Espera inspección secundaria — presupuesta 2-4 hr adicionales' },
    note: { en: 'Hazmat cargo gets enhanced CBP screening regardless of trusted-trader status.', es: 'La carga peligrosa recibe revisión CBP intensificada sin importar estatus de trusted-trader.' },
    required: false,
  },
]

const CARGO_LIVESTOCK: ChecklistItem[] = [
  {
    id: 'vs_17_140',
    text: { en: 'VS Form 17-140 — Animal health certificate', es: 'Formulario VS 17-140 — Certificado de salud animal' },
    required: true,
  },
  {
    id: 'aphis_endorsement',
    text: { en: 'APHIS endorsement on health cert (signed by USDA vet)', es: 'Endoso APHIS en certificado de salud (firmado por veterinario USDA)' },
    required: true,
  },
  {
    id: 'designated_poe',
    text: { en: 'Crossing only at livestock-designated POE (Laredo, El Paso, Eagle Pass)', es: 'Cruce solo en POE designado para ganado (Laredo, El Paso, Eagle Pass)' },
    required: true,
  },
]

const CARGO_AUTO: ChecklistItem[] = [
  {
    id: 'usmca_rvc',
    text: { en: 'USMCA Regional Value Content (RVC) documentation', es: 'Documentación de Contenido de Valor Regional (RVC) USMCA' },
    note: { en: 'Auto parts must meet 75% RVC for full duty-free under USMCA. Tracking by part #.', es: 'Las autopartes deben cumplir 75% RVC para libre arancel bajo USMCA. Rastreo por # de parte.' },
    required: true,
  },
  {
    id: 'immex_id',
    text: { en: 'IMMEX program ID (if shipping via maquila)', es: 'ID del programa IMMEX (si envías vía maquila)' },
    required: false,
  },
]

const CARGO_DRY: ChecklistItem[] = [
  {
    id: 'fcc_radio',
    text: { en: 'FCC declaration if cargo includes radio/wireless devices', es: 'Declaración FCC si la carga incluye dispositivos de radio/inalámbricos' },
    required: false,
  },
  {
    id: 'cpsc_cert',
    text: { en: 'CPSC certification for consumer products (kids items, electronics)', es: 'Certificación CPSC para productos de consumo (artículos infantiles, electrónicos)' },
    required: false,
  },
]

const LANE_LABEL: Record<Lane, { en: string; es: string }> = {
  standard: { en: 'Standard Commercial', es: 'Comercial Estándar' },
  fast: { en: 'FAST Lane (trusted-trader)', es: 'Carril FAST (trusted-trader)' },
  express: { en: 'Express / Pre-cleared', es: 'Express / Pre-liberado' },
  empty: { en: 'Empty truck (returning)', es: 'Camión vacío (regreso)' },
}

const CARGO_LABEL: Record<Cargo, { en: string; es: string }> = {
  dry: { en: 'Dry goods', es: 'Carga seca' },
  produce: { en: 'Fresh produce', es: 'Productos frescos' },
  refrigerated: { en: 'Refrigerated (reefer)', es: 'Refrigerada (reefer)' },
  hazmat: { en: 'Hazardous materials', es: 'Materiales peligrosos' },
  livestock: { en: 'Live animals', es: 'Animales vivos' },
  auto_parts: { en: 'Auto parts / IMMEX', es: 'Autopartes / IMMEX' },
}

function buildChecklist(lane: Lane, cargo: Cargo): ChecklistItem[] {
  const cargoMap: Record<Cargo, ChecklistItem[]> = {
    dry: CARGO_DRY,
    produce: CARGO_PRODUCE,
    refrigerated: CARGO_REFRIGERATED,
    hazmat: CARGO_HAZMAT,
    livestock: CARGO_LIVESTOCK,
    auto_parts: CARGO_AUTO,
  }
  const lanePart = lane === 'fast' ? FAST_ITEMS : []
  if (lane === 'empty') {
    return COMMON_ITEMS.filter((i) => ['ace_manifest', 'driver_passport', 'truck_papers', 'mx_insurance', 'broker_contact'].includes(i.id))
  }
  return [...COMMON_ITEMS, ...lanePart, ...cargoMap[cargo]]
}

export default function ChecklistPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-gray-950" />}>
      <ChecklistContent />
    </Suspense>
  )
}

function ChecklistContent() {
  const search = useSearchParams()
  const { lang } = useLang()
  const es = lang === 'es'

  const initialLane = (search.get('lane') as Lane) || 'standard'
  const initialCargo = (search.get('cargo') as Cargo) || 'dry'

  const [lane, setLane] = useState<Lane>(['standard', 'fast', 'express', 'empty'].includes(initialLane) ? initialLane : 'standard')
  const [cargo, setCargo] = useState<Cargo>(['dry', 'produce', 'refrigerated', 'hazmat', 'livestock', 'auto_parts'].includes(initialCargo) ? initialCargo : 'dry')
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [shareCopied, setShareCopied] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('lane', lane)
    url.searchParams.set('cargo', cargo)
    window.history.replaceState({}, '', url.toString())
  }, [lane, cargo])

  const items = useMemo(() => buildChecklist(lane, cargo), [lane, cargo])
  const requiredCount = items.filter((i) => i.required).length
  const checkedRequiredCount = items.filter((i) => i.required && checked[i.id]).length

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function reset() {
    setChecked({})
  }

  async function share() {
    if (typeof navigator === 'undefined') return
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const text = es
      ? `Lista de cruce comercial — ${LANE_LABEL[lane].es} × ${CARGO_LABEL[cargo].es}. Cruzar.app`
      : `Commercial crossing checklist — ${LANE_LABEL[lane].en} × ${CARGO_LABEL[cargo].en}. Cruzar.app`
    const nav = navigator as Navigator
    if ('share' in nav && typeof nav.share === 'function') {
      try { await nav.share({ text, url }); return } catch { /* fall through */ }
    }
    try {
      await nav.clipboard.writeText(`${text}\n${url}`)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 3000)
    } catch { /* ignore */ }
  }

  function printList() {
    if (typeof window !== 'undefined') window.print()
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 pt-6 pb-20 print:bg-white print:px-0">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-3 print:hidden">
          <ArrowLeft className="w-3 h-3" /> {es ? 'Inicio' : 'Home'}
        </Link>

        <div className="flex items-center gap-2 mb-1">
          <Truck className="w-5 h-5 text-blue-600" />
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">
            {es ? 'Lista de cruce comercial' : 'Commercial crossing checklist'}
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          {es
            ? 'Documentos y requisitos por carril y tipo de carga. Genera, marca y comparte con tu conductor o despachador.'
            : 'Documents and requirements by lane and cargo type. Generate, check off, share with your driver or dispatcher.'}
        </p>

        {/* Lane / cargo selectors */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 mb-4 shadow-sm print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                {es ? 'Carril' : 'Lane'}
              </label>
              <select
                value={lane}
                onChange={(e) => setLane(e.target.value as Lane)}
                className="mt-1 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(Object.keys(LANE_LABEL) as Lane[]).map((k) => (
                  <option key={k} value={k}>{LANE_LABEL[k][lang]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                {es ? 'Tipo de carga' : 'Cargo type'}
              </label>
              <select
                value={cargo}
                onChange={(e) => setCargo(e.target.value as Cargo)}
                disabled={lane === 'empty'}
                className="mt-1 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {(Object.keys(CARGO_LABEL) as Cargo[]).map((k) => (
                  <option key={k} value={k}>{CARGO_LABEL[k][lang]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Header summary (visible in print) */}
        <div className="hidden print:block mb-4 border-b border-gray-300 pb-3">
          <h2 className="text-xl font-bold">Cruzar — {es ? 'Lista de cruce' : 'Crossing checklist'}</h2>
          <p className="text-xs text-gray-700">{LANE_LABEL[lane][lang]} × {CARGO_LABEL[cargo][lang]}</p>
        </div>

        {/* Progress bar */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-700 dark:text-gray-200">
              {checkedRequiredCount}/{requiredCount} {es ? 'requeridos' : 'required'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {Math.round((checkedRequiredCount / Math.max(1, requiredCount)) * 100)}%
            </p>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${checkedRequiredCount === requiredCount ? 'bg-emerald-500' : 'bg-blue-600'}`}
              style={{ width: `${(checkedRequiredCount / Math.max(1, requiredCount)) * 100}%` }}
            />
          </div>
        </div>

        {/* Items */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-4">
          {items.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              className={`w-full flex items-start gap-3 p-4 text-left border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${idx === 0 ? '' : ''}`}
            >
              {checked[item.id] ? (
                <CheckSquare className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <Square className="w-5 h-5 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className={`text-sm font-medium ${checked[item.id] ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
                    {item.text[lang]}
                  </p>
                  {item.required && (
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                      {es ? 'Requerido' : 'Required'}
                    </span>
                  )}
                </div>
                {item.note && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                    {item.note[lang]}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Action row */}
        <div className="grid grid-cols-3 gap-2 mb-6 print:hidden">
          <button
            onClick={reset}
            className="flex items-center justify-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> {es ? 'Reiniciar' : 'Reset'}
          </button>
          <button
            onClick={printList}
            className="flex items-center justify-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> {es ? 'Imprimir / PDF' : 'Print / PDF'}
          </button>
          <button
            onClick={share}
            className="flex items-center justify-center gap-1.5 bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white border border-gray-900 dark:border-gray-100 rounded-xl py-2.5 text-xs font-bold hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors"
          >
            {shareCopied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            {shareCopied ? (es ? 'Copiado' : 'Copied') : (es ? 'Compartir' : 'Share')}
          </button>
        </div>

        {/* Disclaimer */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 mb-5 text-[11px] text-amber-800 dark:text-amber-200 leading-snug">
          <p className="font-bold mb-1">⚠️ {es ? 'Importante' : 'Important'}</p>
          <p>
            {es
              ? 'Esta lista es una guía. Los requisitos cambian por puerto y por programa CBP/SAT. Tu agente aduanal licenciado tiene la última palabra. Cruzar no presenta documentación a CBP.'
              : 'This list is guidance. Requirements vary by POE and by CBP/SAT program. Your licensed customs broker has the final word. Cruzar does not file documentation with CBP.'}
          </p>
        </div>

        {/* Cross-sell to passenger checklist */}
        <Link
          href="/customs"
          className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors print:hidden"
        >
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {es ? '¿Cruce personal?' : 'Personal crossing?'}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {es ? 'Lista para pasajeros y vehículos personales' : 'Checklist for passengers and personal vehicles'}
            </p>
          </div>
          <ExternalLink className="w-4 h-4 text-gray-400" />
        </Link>
      </div>
    </main>
  )
}
