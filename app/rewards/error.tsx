'use client'
import PageErrorBoundary, { type Props } from '@/components/PageErrorBoundary'

export default function Error(p: Omit<Props, 'emoji' | 'titleEs' | 'titleEn' | 'subEs' | 'subEn'>) {
  return (
    <PageErrorBoundary
      {...p}
      emoji="🎁"
      titleEs="Recompensas no cargaron"
      titleEn="Rewards didn't load"
      subEs="Tus puntos y canjes están a salvo — solo es un problema de render"
      subEn="Your points and redemptions are safe — just a rendering issue"
    />
  )
}
