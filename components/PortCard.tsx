'use client'

import Link from 'next/link'
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
          {primaryWait !== null && (
            <div className="text-right">
              <span className="text-2xl font-bold text-gray-900">{primaryWait}</span>
              <span className="text-xs text-gray-400 ml-1">min</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-2 justify-around">
          <WaitBadge minutes={port.vehicle} label="Car" />
          <WaitBadge minutes={port.sentri} label="SENTRI" />
          <WaitBadge minutes={port.pedestrian} label="Walk" />
          <WaitBadge minutes={port.commercial} label="Truck" />
        </div>
      </div>
    </Link>
  )
}
