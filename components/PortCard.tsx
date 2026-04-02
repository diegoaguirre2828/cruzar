'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { getWaitLevel, waitLevelDot } from '@/lib/cbp'
import { WaitBadge } from './WaitBadge'
import { useLang } from '@/lib/LangContext'
import type { PortWaitTime } from '@/types'

interface Props {
  port: PortWaitTime
}

export function PortCard({ port }: Props) {
  const { t } = useLang()
  const allNull = port.vehicle === null && port.pedestrian === null && port.sentri === null && port.commercial === null
  const primaryLevel = getWaitLevel(port.vehicle)
  // When CBP reports no data late at night, treat as low traffic (green dot)
  const dot = allNull ? 'bg-green-500' : waitLevelDot(primaryLevel)
  const primaryWait = port.vehicle ?? port.pedestrian
  const [shared, setShared] = useState(false)

  // Use actual lanes open for accuracy if available (0.7 cars/min/lane avg)
  // Fallback: assume ~3 cars/min total (typical 4-lane crossing at 0.75/lane)
  const carsAhead = primaryWait !== null && primaryWait > 0
    ? port.vehicleLanesOpen && port.vehicleLanesOpen > 0
      ? Math.round(primaryWait * port.vehicleLanesOpen * 0.7)
      : Math.round(primaryWait * 3)
    : null

  function handleShare(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    const parts: string[] = []
    if (port.vehicle !== null) parts.push(`🚗 Car: ${port.vehicle} min`)
    if (port.pedestrian !== null) parts.push(`🚶 Walk: ${port.pedestrian} min`)
    if (port.sentri !== null) parts.push(`⚡ SENTRI: ${port.sentri} min`)
    if (port.commercial !== null) parts.push(`🚛 Truck: ${port.commercial} min`)

    const text = `🌉 ${port.portName} wait times right now:\n${parts.join(' · ')}\n\ncruzaapp.vercel.app`

    if (navigator.share) {
      navigator.share({ text }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text).catch(() => {})
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
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base leading-tight">
                {port.portName}
              </h3>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 ml-4">{port.crossingName}</p>
          </div>
          <div className="flex items-center gap-2">
            {primaryWait !== null && (
              <div className="text-right">
                {primaryWait === 0 ? (
                  <span className="text-sm font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-3 py-1.5 rounded-xl">&lt;1 min</span>
                ) : (
                  <>
                    <div>
                      <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{primaryWait}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">min</span>
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

        {!allNull ? (
          <div className="flex gap-3 mt-2 justify-around">
            {port.vehicle !== null && <WaitBadge minutes={port.vehicle} label={t.laneCar} lanesOpen={port.vehicleLanesOpen} />}
            {port.sentri !== null && <WaitBadge minutes={port.sentri} label={t.laneSentri} lanesOpen={port.sentriLanesOpen} />}
            {port.pedestrian !== null && <WaitBadge minutes={port.pedestrian} label={t.laneWalk} lanesOpen={port.pedestrianLanesOpen} />}
            {port.commercial !== null && <WaitBadge minutes={port.commercial} label={t.laneTruck} lanesOpen={port.commercialLanesOpen} />}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 mt-2 py-1">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">{t.noWaitLowTraffic}</p>
          </div>
        )}
      </div>
    </Link>
  )
}
