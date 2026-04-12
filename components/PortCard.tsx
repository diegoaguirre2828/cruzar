'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { getWaitLevel, waitLevelDot } from '@/lib/cbp'
import { WaitBadge } from './WaitBadge'
import { useLang } from '@/lib/LangContext'
import { getPortMeta } from '@/lib/portMeta'
import type { PortWaitTime } from '@/types'

export interface PortSignal {
  type: 'accident' | 'delay' | 'clear' | 'crossed'
  count?: number
  minutesAgo?: number
  waited?: number
}

interface Props {
  port: PortWaitTime
  signal?: PortSignal | null
}

export function PortCard({ port, signal }: Props) {
  const { t, lang } = useLang()
  const meta = getPortMeta(port.portId)
  const displayCrossing = meta.localName
    ? `${port.crossingName} / ${meta.localName}`
    : port.crossingName
  const allNull = port.vehicle === null && port.pedestrian === null && port.sentri === null && port.commercial === null
  const primaryLevel = getWaitLevel(port.vehicle)
  // Closed = gray dot; no data late at night = green dot; otherwise use wait level
  const dot = port.isClosed ? 'bg-gray-400' : allNull ? 'bg-green-500' : waitLevelDot(primaryLevel)
  const primaryWait = port.vehicle ?? port.pedestrian
  const [shared, setShared] = useState(false)
  const [showToast, setShowToast] = useState(false)

  // Use actual lanes open for accuracy if available (0.7 cars/min/lane avg)
  // Fallback: assume ~3 cars/min total (typical 4-lane crossing at 0.75/lane)
  const carsAhead = primaryWait !== null && primaryWait > 0
    ? port.vehicleLanesOpen && port.vehicleLanesOpen > 0
      ? Math.round(primaryWait * port.vehicleLanesOpen * 0.7)
      : Math.round(primaryWait * 3)
    : null

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    const fmt = (n: number) => n === 0 ? '<1 min' : `${n} min`
    const parts: string[] = []
    if (port.vehicle !== null) parts.push(`🚗 ${lang === 'es' ? 'Auto' : 'Car'}: ${fmt(port.vehicle)}`)
    if (port.pedestrian !== null) parts.push(`🚶 ${lang === 'es' ? 'A pie' : 'Walk'}: ${fmt(port.pedestrian)}`)
    if (port.sentri !== null) parts.push(`⚡ SENTRI: ${fmt(port.sentri)}`)
    if (port.commercial !== null) parts.push(`🚛 ${lang === 'es' ? 'Camión' : 'Truck'}: ${fmt(port.commercial)}`)

    const text = lang === 'es'
      ? `🌉 ${port.portName} — espera ahorita:\n${parts.join(' · ')}`
      : `🌉 ${port.portName} wait times right now:\n${parts.join(' · ')}`

    const url = 'https://cruzar.app'

    let shared = false
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Cruzar', text, url })
        shared = true
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
    }

    if (!shared) {
      try {
        await navigator.clipboard.writeText(`${text}\n\n${url}`)
      } catch { /* ignore */ }
      setShowToast(true)
      setTimeout(() => setShowToast(false), 4000)
    }

    setShared(true)
    setTimeout(() => setShared(false), 2000)
  }

  return (
    <Link href={`/port/${encodeURIComponent(port.portId)}`}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98]">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${dot} flex-shrink-0`} />
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg leading-tight">
                {port.portName}
              </h3>
            </div>
            {displayCrossing && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 ml-4">{displayCrossing}</p>}
          </div>
          <div className="flex items-center gap-2">
            {primaryWait !== null && (
              <div className="text-right">
                {primaryWait === 0 ? (
                  <span className="text-base font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-3 py-1.5 rounded-xl">&lt;1 min</span>
                ) : (
                  <>
                    <div>
                      <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{primaryWait}</span>
                      <span className="text-sm text-gray-400 dark:text-gray-500 ml-1">min</span>
                    </div>
                    {carsAhead !== null && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-right">{t.carsAhead(carsAhead)}</p>
                    )}
                  </>
                )}
              </div>
            )}
            <button
              onClick={handleShare}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
              title="Share wait times"
            >
              {shared ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showToast && (
          <div className="mt-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-blue-800 dark:text-blue-300 font-medium">
            <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            {lang === 'es' ? '¡Copiado! Pégalo en tu grupo de Facebook.' : 'Copied! Paste it into your Facebook group.'}
          </div>
        )}

        {(port.source || port.reportCount) && primaryWait !== null && (
          <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 ml-4">
            {(() => {
              const parts: string[] = []
              if (port.source === 'community')
                parts.push(lang === 'es' ? `según ${port.reportCount} reportes` : `from ${port.reportCount} reports`)
              else if (port.source === 'consensus')
                parts.push(
                  lang === 'es'
                    ? `consenso · CBP + ${port.reportCount ? `${port.reportCount} reportes` : 'tráfico'}`
                    : `consensus · CBP + ${port.reportCount ? `${port.reportCount} reports` : 'traffic'}`
                )
              else if (port.source === 'traffic')
                parts.push(lang === 'es' ? 'estimado por tráfico' : 'traffic-estimated')
              else parts.push(lang === 'es' ? 'según CBP' : 'per CBP')

              if (port.lastReportMinAgo != null && port.lastReportMinAgo <= 30)
                parts.push(lang === 'es' ? `último reporte hace ${port.lastReportMinAgo} min` : `last report ${port.lastReportMinAgo} min ago`)
              else if (port.cbpStaleMin != null && port.cbpStaleMin > 25)
                parts.push(lang === 'es' ? `CBP hace ${port.cbpStaleMin} min` : `CBP ${port.cbpStaleMin} min ago`)

              return parts.join(' · ')
            })()}
          </p>
        )}

        {signal && (
          <div className={`mt-2 px-2 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 ${
            signal.type === 'accident' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' :
            signal.type === 'delay'    ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' :
            signal.type === 'clear'    ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' :
                                         'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
          }`}>
            {signal.type === 'accident' && `💥 ${lang === 'es' ? `${signal.count} reportan accidente` : `${signal.count} reporting accident`}`}
            {signal.type === 'delay'    && `⚠️ ${lang === 'es' ? `${signal.count} reportan más espera` : `${signal.count} reporting longer wait`}`}
            {signal.type === 'clear'    && `🟢 ${lang === 'es' ? `${signal.count} reportan que fluye` : `${signal.count} say it's moving fast`}`}
            {signal.type === 'crossed'  && `✅ ${lang === 'es'
              ? `Alguien cruzó hace ${signal.minutesAgo} min${signal.waited ? ` · esperó ${signal.waited} min` : ''}`
              : `Someone crossed ${signal.minutesAgo} min ago${signal.waited ? ` · waited ${signal.waited} min` : ''}`}`}
          </div>
        )}

        {port.isClosed ? (
          <div className="flex items-center justify-center gap-1.5 mt-2 py-1">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Closed</p>
          </div>
        ) : !allNull || port.vehicleClosed || port.pedestrianClosed || port.commercialClosed ? (
          <div className="flex gap-3 mt-2 justify-around">
            {(port.vehicle !== null || port.vehicleClosed) && <WaitBadge minutes={port.vehicle} label={t.laneCar} lanesOpen={port.vehicleLanesOpen} isClosed={port.vehicleClosed} />}
            {port.sentri !== null && <WaitBadge minutes={port.sentri} label={t.laneSentri} lanesOpen={port.sentriLanesOpen} />}
            {(port.pedestrian !== null || port.pedestrianClosed) && <WaitBadge minutes={port.pedestrian} label={t.laneWalk} lanesOpen={port.pedestrianLanesOpen} isClosed={port.pedestrianClosed} />}
            {(port.commercial !== null || port.commercialClosed) && <WaitBadge minutes={port.commercial} label={t.laneTruck} lanesOpen={port.commercialLanesOpen} isClosed={port.commercialClosed} />}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 mt-2 py-1">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <p className="text-sm text-green-600 dark:text-green-400 font-semibold">{t.noWaitLowTraffic}</p>
          </div>
        )}
      </div>
    </Link>
  )
}
