'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { BridgeLogo } from '@/components/BridgeLogo'

function formatDateFull(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function DelayReportContent() {
  const searchParams = useSearchParams()

  const ref = searchParams?.get('ref') || '—'
  const driver = searchParams?.get('driver') || '—'
  const origin = searchParams?.get('origin') || '—'
  const destination = searchParams?.get('destination') || '—'
  const port = searchParams?.get('port') || '—'
  const expected = searchParams?.get('expected') || null
  const actual = searchParams?.get('actual') || null
  const delayMins = Math.round(parseFloat(searchParams?.get('delay') || '0'))
  const carrier = searchParams?.get('carrier') || '—'

  const delayHours = Math.floor(delayMins / 60)
  const delayRemainMins = delayMins % 60
  const delayLabel = delayHours > 0
    ? `${delayHours} hour${delayHours > 1 ? 's' : ''} ${delayRemainMins > 0 ? `${delayRemainMins} min` : ''}`
    : `${delayMins} minutes`

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        body { background: white; }
      `}</style>

      <div className="min-h-screen bg-white text-gray-900" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif' }}>
        <div className="max-w-2xl mx-auto px-8 py-12">

          {/* Print button */}
          <div className="no-print flex justify-end mb-6">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-gray-700 transition-colors"
            >
              🖨️ Print / Save as PDF
            </button>
          </div>

          {/* Logo / Header */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b border-gray-200">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BridgeLogo size={28} />
                <span className="text-xl font-black tracking-tight text-gray-900">CRUZAR</span>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-0.5">Border Intelligence</span>
              </div>
              <p className="text-xs text-gray-400">cruzar.app</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Document date</p>
              <p className="text-sm font-semibold text-gray-700">{today}</p>
            </div>
          </div>

          {/* Document title */}
          <div className="mb-8">
            <h1 className="text-2xl font-black text-gray-900 mb-1">Border Delay Documentation</h1>
            <p className="text-sm text-gray-500">Official delay report for customs, insurance, and compliance purposes.</p>
          </div>

          {/* Shipment info */}
          <div className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Shipment Information</h2>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {[
                { label: 'Reference / Load #', value: ref },
                { label: 'Carrier', value: carrier },
                { label: 'Driver', value: driver },
                { label: 'Origin', value: origin },
                { label: 'Destination', value: destination },
                { label: 'Port of Entry', value: port },
              ].map((row, i) => (
                <div
                  key={row.label}
                  className="flex"
                  style={{ background: i % 2 === 0 ? '#f9fafb' : 'white' }}
                >
                  <div className="w-48 px-4 py-3 text-xs text-gray-500 font-medium flex-shrink-0">{row.label}</div>
                  <div className="flex-1 px-4 py-3 text-sm font-semibold text-gray-900">{row.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Delay documentation */}
          <div className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Delay Documentation</h2>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {[
                { label: 'Expected crossing', value: formatDateFull(expected) },
                { label: 'Actual crossing', value: formatDateFull(actual) },
                { label: 'Total delay', value: delayLabel, highlight: true },
              ].map((row, i) => (
                <div
                  key={row.label}
                  className="flex"
                  style={{ background: i % 2 === 0 ? '#f9fafb' : 'white' }}
                >
                  <div className="w-48 px-4 py-3 text-xs text-gray-500 font-medium flex-shrink-0">{row.label}</div>
                  <div
                    className="flex-1 px-4 py-3 text-sm font-semibold"
                    style={{ color: row.highlight ? '#dc2626' : '#111827' }}
                  >
                    {row.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 border border-gray-200 rounded-xl p-4 bg-gray-50">
              <p className="text-xs text-gray-600 leading-relaxed">
                <strong>Statement:</strong> The above delay was caused by CBP border wait times beyond the
                carrier&apos;s control. Crossing wait times are recorded and verified through the U.S. Customs
                and Border Protection public data feed (bwt.cbp.gov). This documentation is generated via
                Cruzar Border Intelligence and reflects official CBP-reported wait times at the time of crossing.
              </p>
            </div>
          </div>

          {/* Signature lines */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-10">
              <div>
                <div className="border-b border-gray-400 mb-1 h-8" />
                <p className="text-xs text-gray-400">Dispatcher signature</p>
              </div>
              <div>
                <div className="border-b border-gray-400 mb-1 h-8" />
                <p className="text-xs text-gray-400">Date</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-300 text-center">
              Generated by Cruzar Border Intelligence · cruzar.app · Data sourced from U.S. CBP public API
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export default function DelayReportPage() {
  return (
    <Suspense>
      <DelayReportContent />
    </Suspense>
  )
}
