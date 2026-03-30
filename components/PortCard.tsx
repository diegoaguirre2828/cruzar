'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { getWaitLevel, waitLevelDot } from '@/lib/cbp'
import { WaitBadge } from './WaitBadge'
import type { PortWaitTime } from '@/types'

interface Props {
  port: PortWaitTime
}

export function PortCard({ port }: Props) {
  const primaryLevel = getWaitLevel(port.vehicle)
  const dot = waitLevelDot(primaryLevel)
  const primaryWait = port.vehicle ?? port.pedestrian
  const [shared, setShared] = useState(false)

  // Rough estimate: ~3 cars processed per minute at a typical crossing
  const carsAhead = primaryWait !== null && primaryWait > 0
    ? Math.round(primaryWait * 3)
    : null

  function handleShare(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    const parts: string[] = []
    if (port.vehicle !== null) parts.push(`🚗 Car: ${port.vehicle} min`)
    if (port.pedestrian !== null) parts.push(`🚶 Walk: ${port.pedestrian} min`)
    if (port.sentri !== null) parts.push(`⚡ SENTRI: ${port.sentri} min`)
    if (port.commercial !== null) parts.push(`🚛 Truck: ${port.commercial} min`)

    const text = `🌉 ${port.portName} wait times right now:\n${parts.join(' · ')}\n\ncruza.app`

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
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98]">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${dot} flex-shrink-0`} />
              <h3 className="font-semibold text-gray-900 text-base leading-tight">
                {port.portName}
              </h3>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 ml-4">{port.crossingName}</p>
          </div>
          <div className="flex items-center gap-2">
            {primaryWait !== null && (
              <div className="text-right">
                {primaryWait === 0 ? (
                  <span className="text-sm font-bold text-gray-400 bg-gray-100 px-3 py-1.5 rounded-xl">Closed</span>
                ) : (
                  <>
                    <div>
                      <span className="text-2xl font-bold text-gray-900">{primaryWait}</span>
                      <span className="text-xs text-gray-400 ml-1">min</span>
                    </div>
                    {carsAhead !== null && (
                      <p className="text-xs text-gray-400 text-right">~{carsAhead} cars</p>
                    )}
                  </>
                )}
              </div>
            )}
            <button
              onClick={handleShare}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
              title="Share wait times"
            >
              {shared ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Only show lanes that have data */}
        {[
          { minutes: port.vehicle, label: 'Car' },
          { minutes: port.sentri, label: 'SENTRI' },
          { minutes: port.pedestrian, label: 'Walk' },
          { minutes: port.commercial, label: 'Truck' },
        ].filter(lane => lane.minutes !== null).length > 0 ? (
          <div className="flex gap-3 mt-2 justify-around">
            {port.vehicle !== null && <WaitBadge minutes={port.vehicle} label="Car" />}
            {port.sentri !== null && <WaitBadge minutes={port.sentri} label="SENTRI" />}
            {port.pedestrian !== null && <WaitBadge minutes={port.pedestrian} label="Walk" />}
            {port.commercial !== null && <WaitBadge minutes={port.commercial} label="Truck" />}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center mt-2 py-1">No data available — crossing may be closed</p>
        )}
      </div>
    </Link>
  )
}
