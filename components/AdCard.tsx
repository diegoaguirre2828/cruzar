'use client'

import { useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

interface Ad {
  id: string
  title: string
  description: string | null
  cta_text: string
  cta_url: string | null
  image_url: string | null
  ad_type: string
}

interface Props {
  ad: Ad
  portId?: string
  variant?: 'card' | 'banner' | 'nearby'
}

export function AdCard({ ad, portId, variant = 'card' }: Props) {
  const { lang } = useLang()
  const sponsoredLabel = lang === 'es' ? 'Patrocinado' : 'Sponsored'

  useEffect(() => {
    fetch('/api/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adId: ad.id, eventType: 'impression', portId }),
    })
  }, [ad.id, portId])

  function handleClick() {
    fetch('/api/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adId: ad.id, eventType: 'click', portId }),
    })
    if (ad.cta_url) window.open(ad.cta_url, '_blank', 'noopener')
  }

  if (variant === 'banner') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span className="text-xs text-amber-500 font-medium">{sponsoredLabel}</span>
          <p className="text-sm font-semibold text-gray-900 truncate">{ad.title}</p>
          {ad.description && <p className="text-xs text-gray-500 truncate">{ad.description}</p>}
        </div>
        <button
          onClick={handleClick}
          className="flex-shrink-0 bg-amber-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-1"
        >
          {ad.cta_text} <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    )
  }

  if (variant === 'nearby') {
    return (
      <button
        onClick={handleClick}
        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start gap-3">
          {ad.image_url && (
            <img src={ad.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-xs text-amber-500 font-medium">{sponsoredLabel}</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">{ad.title}</p>
            {ad.description && <p className="text-xs text-gray-500 mt-0.5">{ad.description}</p>}
          </div>
          <span className="text-xs text-blue-600 font-medium flex-shrink-0">{ad.cta_text}</span>
        </div>
      </button>
    )
  }

  // Default card variant
  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-amber-500 font-semibold uppercase tracking-wide">{sponsoredLabel}</span>
      </div>
      {ad.image_url && (
        <img src={ad.image_url} alt="" className="w-full h-24 object-cover rounded-xl mb-3" />
      )}
      <p className="font-bold text-gray-900">{ad.title}</p>
      {ad.description && <p className="text-sm text-gray-600 mt-1">{ad.description}</p>}
      {ad.cta_url && (
        <button
          onClick={handleClick}
          className="mt-3 w-full bg-amber-500 text-white text-sm font-medium py-2 rounded-xl hover:bg-amber-600 transition-colors flex items-center justify-center gap-1"
        >
          {ad.cta_text} <ExternalLink className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
