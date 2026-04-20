'use client'

import { useState, useEffect } from 'react'
import { useLang } from '@/lib/LangContext'
import { trackShare } from '@/lib/trackShare'
import type { PortWaitTime } from '@/types'

// Timed share prompt — appears after a user has been on a port detail
// page for 10 seconds. The hypothesis: if someone is checking a bridge
// for 10+ seconds, they're about to cross. That's the perfect moment
// to ask them to tell their people about Cruzar.
//
// Only shows once per session (localStorage flag). Dismissable.
// Native share on mobile, WhatsApp fallback on desktop.

interface Props {
  port: PortWaitTime
}

export function SharePrompt({ port }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Don't show if already dismissed this session
    try {
      if (sessionStorage.getItem('cruzar_share_dismissed')) return
    } catch { /* private browsing */ }

    const timer = setTimeout(() => setVisible(true), 10_000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible || dismissed || port.vehicle == null) return null

  const wait = port.vehicle
  const name = port.portName || 'the bridge'

  function handleDismiss() {
    setDismissed(true)
    try { sessionStorage.setItem('cruzar_share_dismissed', '1') } catch {}
  }

  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const text = es
      ? `${name} está en ${wait} min ahorita. Yo uso cruzar.app pa' checar los puentes antes de salir — tiene todos los puentes en vivo, gratis.`
      : `${name} is at ${wait} min right now. I use cruzar.app to check bridge times before leaving — all crossings live, free.`

    // Share-snapshot URL bakes the wait into the path so the OG preview
    // that WhatsApp/FB renders always shows a real number.
    const hasSnapshot = typeof wait === 'number' && Number.isFinite(wait) && wait >= 0 && wait <= 240
    const url = hasSnapshot ? `https://cruzar.app/w/${port.portId}/${wait}` : 'https://cruzar.app'

    if (navigator.share) {
      try {
        trackShare('native', 'share_prompt')
        await navigator.share({ title: 'Cruzar', text, url })
        trackShare('native_success', 'share_prompt')
        handleDismiss()
        return
      } catch { /* cancelled or unavailable — fall through */ }
    }

    // Copy-to-clipboard fallback — covers iMessage / Telegram / email /
    // desktop / anyone who doesn't use WhatsApp. Previous fallback was
    // WhatsApp-only which stranded ~half of iOS users.
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`)
        trackShare('copy', 'share_prompt')
        setCopied(true)
        setTimeout(() => { setCopied(false); handleDismiss() }, 1800)
        return
      } catch { /* fall through to wa.me */ }
    }

    trackShare('whatsapp', 'share_prompt')
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`
    window.open(waUrl, '_blank')
    handleDismiss()
  }

  return (
    <div className="mt-4 bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl p-4 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-white/50 hover:text-white text-lg leading-none w-6 h-6 flex items-center justify-center"
      >
        ×
      </button>
      <p className="text-white text-sm font-black">
        {es ? '¿Conoces a alguien que cruza?' : 'Know someone who crosses?'}
      </p>
      <p className="text-green-100 text-[11px] mt-0.5">
        {es
          ? 'Mándales el link — les va a ahorrar el andar preguntando en los grupos'
          : 'Send them the link — saves them from scrolling FB groups every time'}
      </p>
      <button
        onClick={handleShare}
        className="mt-3 w-full py-2.5 bg-white text-green-700 text-sm font-black rounded-xl active:scale-[0.97] transition-transform"
      >
        {copied
          ? (es ? '¡Link copiado!' : 'Link copied!')
          : (es ? 'Compartir link' : 'Share link')}
      </button>
    </div>
  )
}
