import { getWaitLevel, waitLevelColor } from '@/lib/cbp'

interface Props {
  minutes: number | null
  label: string
}

export function WaitBadge({ minutes, label }: Props) {
  const level = getWaitLevel(minutes)
  const colors = waitLevelColor(level)

  const display =
    minutes === null ? '—' :
    minutes === 0 ? 'Closed' :
    `${minutes} min`

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      <span className={`text-sm font-bold px-2 py-1 rounded-full border ${colors}`}>
        {display}
      </span>
    </div>
  )
}
