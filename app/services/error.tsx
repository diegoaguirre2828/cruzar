'use client'
import PageErrorBoundary, { type Props } from '@/components/PageErrorBoundary'

export default function Error(p: Omit<Props, 'emoji' | 'titleEs' | 'titleEn' | 'subEs' | 'subEn'>) {
  return (
    <PageErrorBoundary
      {...p}
      emoji="🇲🇽"
      titleEs="Servicios no cargaron"
      titleEn="Services didn't load"
      subEs="Dental, farmacias y más regresan en unos segundos"
      subEn="Dental, pharmacies and more — back in a few seconds"
    />
  )
}
