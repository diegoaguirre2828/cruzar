'use client'

import { useState, useEffect } from 'react'
import { useLang } from '@/lib/LangContext'
import { ExchangeRateWidget } from './ExchangeRateWidget'

// Compact exchange-rate pill, meant to sit in the header row.
//
// Context: people constantly ask about the USD→MXN rate in border
// Facebook groups, so killing the widget entirely would lose real
// demand. But the full widget (converter + community-reported rates
// + report form) was too much above-the-fold real estate. The pill
// is the compromise: always visible, takes a single line, taps open
// a bottom sheet with the full widget.
//
// The pill shows the best-available rate: community-reported average
// if we have it (more authentic, reflects real casa de cambio rates),
// otherwise the mid-market rate from frankfurter.app.

interface ShortExchange {
  rate: number | null
  communityAvgSell: number | null
}

export function ExchangeRatePill() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [data, setData] = useState<ShortExchange | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/api/exchange')
      .then(r => r.json())
      .then(d => setData({ rate: d.rate ?? null, communityAvgSell: d.communityAvgSell ?? null }))
      .catch(() => setData({ rate: null, communityAvgSell: null }))
  }, [])

  const rate = data?.communityAvgSell ?? data?.rate ?? null
  const isCommunity = data?.communityAvgSell != null

  // Don't reserve space if we have no rate at all — avoids a flash of
  // empty pill on the first paint for users whose exchange API is
  // temporarily down.
  if (!rate) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full pl-3 pr-3.5 py-1.5 text-xs shadow-sm active:scale-[0.97] transition-transform hover:border-emerald-400 dark:hover:border-emerald-500"
      >
        <span className="text-base leading-none">💱</span>
        <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
          $1 = <span className="font-black text-emerald-700 dark:text-emerald-400">{rate.toFixed(2)}</span>
          <span className="ml-0.5 text-[10px] text-gray-400">MXN</span>
        </span>
        {isCommunity && (
          <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">
            {es ? 'real' : 'live'}
          </span>
        )}
        <span className="text-gray-400 text-[10px]">→</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
          onClick={() => setOpen(false)}
          role="dialog"
        >
          <div
            className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto cruzar-rise"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-5 py-3 flex items-center justify-between">
              <p className="text-sm font-black text-gray-900 dark:text-gray-100">
                {es ? 'Tipo de cambio' : 'Exchange rate'}
              </p>
              <button
                onClick={() => setOpen(false)}
                className="text-2xl leading-none text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                aria-label={es ? 'Cerrar' : 'Close'}
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <ExchangeRateWidget />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
