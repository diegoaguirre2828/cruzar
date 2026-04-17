'use client'
import PageErrorBoundary, { type Props } from '@/components/PageErrorBoundary'

export default function Error(p: Omit<Props, 'emoji' | 'titleEs' | 'titleEn' | 'subEs' | 'subEn'>) {
  return (
    <PageErrorBoundary
      {...p}
      emoji="📣"
      titleEs="Panel del promotor no cargó"
      titleEn="Promoter panel didn't load"
      subEs="Reintenta. Tu link y estadísticas están a salvo."
      subEn="Try again. Your link and stats are safe."
    />
  )
}
