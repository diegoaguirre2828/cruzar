'use client'
import PageErrorBoundary, { type Props } from '@/components/PageErrorBoundary'

export default function Error(p: Omit<Props, 'emoji' | 'titleEs' | 'titleEn' | 'subEs' | 'subEn'>) {
  return (
    <PageErrorBoundary
      {...p}
      emoji="🏆"
      titleEs="Guardián no cargó"
      titleEn="Guardian didn't load"
      subEs="Intenta de nuevo en un momento"
      subEn="Try again in a moment"
    />
  )
}
