'use client'
import PageErrorBoundary, { type Props } from '@/components/PageErrorBoundary'

export default function Error(p: Omit<Props, 'emoji' | 'titleEs' | 'titleEn' | 'subEs' | 'subEn'>) {
  return (
    <PageErrorBoundary
      {...p}
      emoji="✨"
      titleEs="El catálogo no cargó"
      titleEn="Features list didn't load"
      subEs="Reintenta en un momento"
      subEn="Try again shortly"
    />
  )
}
