'use client'
import PageErrorBoundary, { type Props } from '@/components/PageErrorBoundary'

export default function Error(p: Omit<Props, 'emoji' | 'titleEs' | 'titleEn' | 'subEs' | 'subEn'>) {
  return (
    <PageErrorBoundary
      {...p}
      emoji="🛡️"
      titleEs="Seguros no cargaron"
      titleEn="Insurance didn't load"
      subEs="Reintenta o consulta aseguradoras directamente"
      subEn="Try again or contact insurers directly"
    />
  )
}
