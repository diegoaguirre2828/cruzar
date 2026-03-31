'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'

interface PulseItem {
  portId: string
  count: number
  avgWait: number | null
  mood: 'fast' | 'slow' | 'mixed'
  minsAgo: number
}

const MOOD_CONFIG = {
  fast:  { dot: 'bg-green-500', text: 'text-green-700 dark:text-green-400', label: 'Moving fast', labelEs: 'Fluye rápido' },
  slow:  { dot: 'bg-red-500',   text: 'text-red-700 dark:text-red-400',     label: 'Heavy traffic', labelEs: 'Tráfico pesado' },
  mixed: { dot: 'bg-yellow-500',text: 'text-yellow-700 dark:text-yellow-400',label: 'Mixed reports', labelEs: 'Reportes mixtos' },
}

export function ActivityPulse() {
  const { lang } = useLang()
  const [pulse, setPulse] = useState<PulseItem[]>([])
  const [portNames, setPortNames] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/activity').then(r => r.json()).then(d => setPulse(d.pulse || []))
    fetch('/api/ports').then(r => r.json()).then(d => {
      const map: Record<string, string> = {}
      for (const p of (d.ports || [])) map[p.portId] = p.portName
      setPortNames(map)
    })
  }, [])

  if (pulse.length === 0) return null

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        {lang === 'es' ? '🔴 Actividad en vivo — últimos 30 min' : '🔴 Live activity — last 30 min'}
      </p>
      <div className="flex flex-col gap-1.5">
        {pulse.slice(0, 4).map(item => {
          const mood = MOOD_CONFIG[item.mood]
          const name = portNames[item.portId] || item.portId
          return (
            <Link key={item.portId} href={`/port/${encodeURIComponent(item.portId)}`}>
              <div className="flex items-center gap-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${mood.dot} animate-pulse`} />
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex-1 truncate">{name}</span>
                <span className={`text-xs font-medium ${mood.text} flex-shrink-0`}>
                  {lang === 'es' ? mood.labelEs : mood.label}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {item.count} {lang === 'es' ? 'rep.' : 'rpts'}
                  {item.avgWait !== null ? ` · ${item.avgWait}m` : ''}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
