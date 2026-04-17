'use client'
import PageErrorBoundary, { type Props } from '@/components/PageErrorBoundary'

export default function Error(p: Omit<Props, 'emoji' | 'titleEs' | 'titleEn' | 'subEs' | 'subEn'>) {
  return (
    <PageErrorBoundary
      {...p}
      emoji="⚖️"
      titleEs="La comparación no cargó"
      titleEn="Compare didn't load"
      subEs="Reintenta para ver los puentes lado a lado"
      subEn="Try again to see the bridges side by side"
    />
  )
}
