'use client'

import { getWaitLevel, waitLevelColor } from '@/lib/cbp'
import { useLang } from '@/lib/LangContext'

interface Props {
  minutes: number | null
  label: string
  lanesOpen?: number | null
  isClosed?: boolean
}

export function WaitBadge({ minutes, label, lanesOpen, isClosed }: Props) {
  const { t, lang } = useLang()
  const level = getWaitLevel(minutes)
  const colors = isClosed
    ? 'text-gray-400 bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
    : waitLevelColor(level)

  const display = isClosed
    ? (lang === 'es' ? 'Cerrado' : 'Closed')
    : minutes === null ? '—'
    : minutes === 0 ? t.lessThanMin
    : `${minutes} min`

  const lanesLabel = !isClosed && lanesOpen != null && lanesOpen > 0
    ? lang === 'es'
      ? `${lanesOpen} ${lanesOpen === 1 ? 'carril' : 'carriles'}`
      : `${lanesOpen} ${lanesOpen === 1 ? 'lane' : 'lanes'}`
    : null

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-sm text-gray-500 font-semibold">{label}</span>
      <span className={`text-base font-bold px-3 py-1.5 rounded-full border ${colors}`}>
        {display}
      </span>
      {lanesLabel && (
        <span className="text-xs text-gray-400 dark:text-gray-500">{lanesLabel}</span>
      )}
    </div>
  )
}
