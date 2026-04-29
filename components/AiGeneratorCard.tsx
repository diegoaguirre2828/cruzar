'use client'

import { useState } from 'react'
import { Sparkles, Copy, Check, Loader2 } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

// Claude-backed AI generator for the promoter + admin workflow.
// Three output types, each a Diego-specific pain point:
//
//   - reply   → pasted FB group post/comment → 3 casual reply variants
//   - post    → situation/angle → 3 promoter-style FB post variants
//   - comment → pasted thread → 3 one-sentence comment variants
//
// Uses /api/admin/ai-generate. Admin + promoter users only.
// Outputs are copy-to-clipboard pastable. Templates reference the
// literal "cruzar.app" form (switched from "cruzar punto app"
// 2026-04-29). Don't add any other URLs to outputs — FB groups
// still reject deep-link URLs.

type GenType = 'reply' | 'post' | 'comment'

interface Variant {
  text: string
  tone: string
}

const TYPE_CONFIG: Record<GenType, {
  labelEs: string
  labelEn: string
  iconEs: string
  placeholderEs: string
  placeholderEn: string
  helpEs: string
  helpEn: string
}> = {
  reply: {
    labelEs: 'Respuesta',
    labelEn: 'Reply',
    iconEs: '💬',
    placeholderEs: 'Pega aquí el comentario o post al que vas a responder…',
    placeholderEn: 'Paste the comment or post you want to reply to…',
    helpEs: '3 respuestas casuales, una validando, una con tip, una comunitaria',
    helpEn: '3 casual replies — one validating, one tip-forward, one community',
  },
  post: {
    labelEs: 'Publicación',
    labelEn: 'Post',
    iconEs: '✍️',
    placeholderEs: 'Describe la situación o el ángulo. Ej: "viernes pesado, la fila en Pharr está brava"',
    placeholderEn: 'Describe the situation or angle. E.g. "heavy Friday, Pharr line is rough"',
    helpEs: '3 posts nuevos pa\' grupos de FB — observación, consejo y comunitario',
    helpEn: '3 new posts for FB groups — observation, tip, and community',
  },
  comment: {
    labelEs: 'Comentario',
    labelEn: 'Comment',
    iconEs: '💭',
    placeholderEs: 'Pega el thread o post bajo el que vas a comentar…',
    placeholderEn: 'Paste the thread or post you want to comment under…',
    helpEs: '3 comentarios de una sola línea — casuales y breves',
    helpEn: '3 one-line comments — casual and brief',
  },
}

export function AiGeneratorCard() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [type, setType] = useState<GenType>('reply')
  const [context, setContext] = useState('')
  const [variants, setVariants] = useState<Variant[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  async function generate() {
    setError(null)
    setLoading(true)
    setVariants(null)
    try {
      const res = await fetch('/api/admin/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, context }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Generation failed')
        return
      }
      setVariants(data.variants || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function copy(text: string, idx: number) {
    try {
      navigator.clipboard.writeText(text)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1500)
    } catch { /* clipboard blocked */ }
  }

  return (
    <div className="bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-700 rounded-3xl p-5 text-white shadow-2xl relative overflow-hidden">
      <div className="absolute -top-16 -right-16 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5" />
          <h2 className="text-lg font-black leading-none">
            {es ? 'Generador AI' : 'AI Generator'}
          </h2>
        </div>
        <p className="text-xs text-indigo-100 mb-4 leading-snug">
          {es
            ? 'Describe la situación o pega el texto — te doy 3 variantes listas pa\' pegar. Nada de URLs, todo en voz de la raza.'
            : 'Describe the situation or paste the text — I give you 3 variants ready to paste. No URLs, always in the neighborhood voice.'}
        </p>

        {/* Type picker */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {(Object.keys(TYPE_CONFIG) as GenType[]).map((t) => {
            const cfg = TYPE_CONFIG[t]
            const active = type === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => { setType(t); setVariants(null); setError(null) }}
                className={`flex flex-col items-center gap-0.5 py-2 text-xs font-bold rounded-xl border-2 transition-all ${
                  active
                    ? 'bg-white text-indigo-700 border-white'
                    : 'bg-white/10 text-white border-white/20 hover:border-white/40'
                }`}
              >
                <span className="text-base leading-none">{cfg.iconEs}</span>
                <span>{es ? cfg.labelEs : cfg.labelEn}</span>
              </button>
            )
          })}
        </div>

        <p className="text-[11px] text-indigo-200 mb-2 leading-snug">
          {es ? TYPE_CONFIG[type].helpEs : TYPE_CONFIG[type].helpEn}
        </p>

        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder={es ? TYPE_CONFIG[type].placeholderEs : TYPE_CONFIG[type].placeholderEn}
          rows={4}
          className="w-full bg-white/95 dark:bg-gray-900/95 text-gray-900 dark:text-gray-100 placeholder-gray-500 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-white/50"
        />

        <button
          type="button"
          onClick={generate}
          disabled={loading || !context.trim()}
          className="mt-3 w-full flex items-center justify-center gap-2 bg-white text-indigo-700 font-black py-3 rounded-2xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {es ? 'Generando…' : 'Generating…'}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {es ? 'Generar 3 variantes' : 'Generate 3 variants'}
            </>
          )}
        </button>

        {error && (
          <div className="mt-3 bg-red-100/20 border border-red-300/40 rounded-xl px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}

        {variants && variants.length > 0 && (
          <div className="mt-4 space-y-2">
            {variants.map((v, idx) => {
              const isCopied = copiedIdx === idx
              return (
                <div
                  key={idx}
                  className="bg-white text-gray-900 rounded-2xl p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                      {v.tone}
                    </span>
                    <button
                      type="button"
                      onClick={() => copy(v.text, idx)}
                      className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors ${
                        isCopied
                          ? 'bg-green-600 text-white'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {isCopied ? (es ? 'Copiado' : 'Copied') : (es ? 'Copiar' : 'Copy')}
                    </button>
                  </div>
                  <p className="text-sm leading-snug whitespace-pre-wrap">{v.text}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
