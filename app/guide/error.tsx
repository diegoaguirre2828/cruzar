'use client'
import PageErrorBoundary, { type Props } from '@/components/PageErrorBoundary'

export default function Error(p: Omit<Props, 'emoji' | 'titleEs' | 'titleEn' | 'subEs' | 'subEn'>) {
  return (
    <PageErrorBoundary
      {...p}
      emoji="📖"
      titleEs="La guía no cargó"
      titleEn="Guide didn't load"
      subEs="Reintenta o vuelve al inicio"
      subEn="Try again or go home"
    />
  )
}
