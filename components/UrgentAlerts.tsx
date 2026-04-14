'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { useHomeRegion } from '@/lib/useHomeRegion'
import { useTier } from '@/lib/useTier'
import { getPortMeta } from '@/lib/portMeta'

interface Report {
  id: string
  port_id: string
  report_type: string
  description: string | null
  created_at: string
}

const PORT_NAMES: Record<string, string> = {
  '230501': 'Hidalgo / McAllen',
  '230502': 'Pharr–Reynosa',
  '230503': 'Anzaldúas',
  '230901': 'Progreso',
  '230902': 'Donna',
  '230701': 'Rio Grande City',
  '231001': 'Roma',
  '535501': 'Brownsville Gateway',
  '535502': 'Brownsville Veterans',
  '535503': 'Los Tomates',
  '230401': 'Laredo I',
  '230402': 'Laredo II',
  '230403': 'Laredo Colombia',
  '230301': 'Eagle Pass I',
  '230302': 'Eagle Pass II',
  '240201': 'El Paso',
  '250401': 'San Ysidro',
  '250601': 'Otay Mesa',
}

const URGENT_TYPES = new Set(['accident', 'inspection'])

function minsAgo(iso: string) {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000)
}

function pickUrgent(list: Report[]): Report[] {
  const cutoff = Date.now() - 30 * 60 * 1000
  const urgent = list.filter(
    (r) => URGENT_TYPES.has(r.report_type) && new Date(r.created_at).getTime() > cutoff,
  )
  const seen = new Set<string>()
  const deduped = urgent.filter((r) => {
    const key = `${r.port_id}-${r.report_type}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return deduped.slice(0, 3)
}

interface Props {
  initialReports?: Report[]
}

export function UrgentAlerts({ initialReports }: Props = {}) {
  const { lang } = useLang()
  const es = lang === 'es'
  const { homeRegion } = useHomeRegion()
  const { tier } = useTier()
  const isBusiness = tier === 'business'
  const scopeActive = !isBusiness && homeRegion != null

  const [rawAlerts, setRawAlerts] = useState<Report[]>(() => initialReports ? pickUrgent(initialReports) : [])

  useEffect(() => {
    // Only refetch if we didn't already get server data — avoids a
    // wasted round-trip on first paint on spotty connections.
    if (initialReports && initialReports.length > 0) return
    fetch('/api/reports/recent?limit=50')
      .then(r => r.json())
      .then(d => setRawAlerts(pickUrgent(d.reports || [])))
      .catch(() => {})
  }, [initialReports])

  // Scope the urgent alerts to the user's home region. A Matamoros
  // accident should not alarm a user in Tijuana.
  const alerts = useMemo(() => {
    if (!scopeActive) return rawAlerts
    return rawAlerts.filter((r) => getPortMeta(r.port_id).megaRegion === homeRegion)
  }, [rawAlerts, scopeActive, homeRegion])

  if (!alerts.length) return null

  return (
    <div className="mb-3 space-y-2">
      {alerts.map(alert => {
        const mins = minsAgo(alert.created_at)
        const portName = PORT_NAMES[alert.port_id] || alert.port_id
        const isAccident = alert.report_type === 'accident'
        return (
          <Link key={alert.id} href={`/port/${encodeURIComponent(alert.port_id)}`}>
            <div className={`flex items-start gap-3 rounded-2xl px-4 py-3 border ${
              isAccident
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            }`}>
              <span className="text-lg flex-shrink-0">{isAccident ? '🚨' : '🔍'}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${isAccident ? 'text-red-800 dark:text-red-300' : 'text-blue-800 dark:text-blue-300'}`}>
                  {isAccident
                    ? (es ? `Accidente reportado — ${portName}` : `Accident reported — ${portName}`)
                    : (es ? `Inspección en curso — ${portName}` : `Inspection reported — ${portName}`)
                  }
                </p>
                {alert.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{alert.description}</p>
                )}
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5">
                {mins < 1 ? (es ? 'ahora' : 'now') : `${mins}m`}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
