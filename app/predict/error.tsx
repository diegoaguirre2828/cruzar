'use client'
import PageErrorBoundary, { type Props } from '@/components/PageErrorBoundary'

export default function Error(p: Omit<Props, 'emoji' | 'titleEs' | 'titleEn' | 'subEs' | 'subEn'>) {
  return (
    <PageErrorBoundary
      {...p}
      emoji="🔮"
      titleEs="Los pronósticos no cargaron"
      titleEn="Predictions didn't load"
      subEs="Reintenta en un momento"
      subEn="Try again shortly"
    />
  )
}
