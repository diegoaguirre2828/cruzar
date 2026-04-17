'use client'
import PageErrorBoundary, { type Props } from '@/components/PageErrorBoundary'

export default function Error(p: Omit<Props, 'emoji' | 'titleEs' | 'titleEn' | 'subEs' | 'subEn'>) {
  return (
    <PageErrorBoundary
      {...p}
      emoji="👤"
      titleEs="Tu cuenta no cargó"
      titleEn="Account didn't load"
      subEs="Tus datos están a salvo. Reintenta o vuelve al inicio."
      subEn="Your data is safe. Try again or head home."
    />
  )
}
