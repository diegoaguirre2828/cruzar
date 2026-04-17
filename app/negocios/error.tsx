'use client'
import PageErrorBoundary, { type Props } from '@/components/PageErrorBoundary'

export default function Error(p: Omit<Props, 'emoji' | 'titleEs' | 'titleEn' | 'subEs' | 'subEn'>) {
  return (
    <PageErrorBoundary
      {...p}
      emoji="🏪"
      titleEs="Los negocios no cargaron"
      titleEn="Businesses didn't load"
      subEs="Reintenta. Si sigue, los listados están en nuestra cola."
      subEn="Try again. If it persists, the listings are in our queue."
    />
  )
}
