'use client'
import PageErrorBoundary, { type Props } from '@/components/PageErrorBoundary'

export default function Error(p: Omit<Props, 'emoji' | 'titleEs' | 'titleEn' | 'subEs' | 'subEn'>) {
  return (
    <PageErrorBoundary
      {...p}
      emoji="📢"
      titleEs="Anuncios no cargó"
      titleEn="Advertise didn't load"
      subEs="Reintenta para continuar con tu anuncio"
      subEn="Try again to continue with your ad"
    />
  )
}
