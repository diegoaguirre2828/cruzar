'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, Bot, User, AlertCircle } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED_ES = [
  '¿Qué documentos necesito para cruzar?',
  '¿Olvidé entregar mi permiso al salir, qué hago?',
  '¿Cómo aplico para SENTRI?',
  '¿Qué puedo traer de México sin declarar?',
  '¿Necesito seguro especial para entrar a México en carro?',
  '¿Qué pasa si me mandan a secundaria?',
]

const SUGGESTED_EN = [
  'What documents do I need to cross?',
  'I forgot to turn in my permit when leaving, what do I do?',
  'How do I apply for SENTRI?',
  'What can I bring from Mexico without declaring?',
  'Do I need special insurance to drive into Mexico?',
  'What happens if I get sent to secondary inspection?',
]

export default function ChatPage() {
  const { lang } = useLang()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const suggested = lang === 'es' ? SUGGESTED_ES : SUGGESTED_EN

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
  }, [input])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const newMessages: Message[] = [...messages, { role: 'user', content: trimmed }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error')
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let reply = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        reply += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: reply }
          return updated
        })
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error'
      setError(
        msg.includes('Too many')
          ? (lang === 'es' ? 'Demasiados mensajes. Intenta en una hora.' : 'Too many messages. Try again in an hour.')
          : (lang === 'es' ? 'No se pudo conectar. Intenta de nuevo.' : 'Could not connect. Try again.')
      )
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-gray-800 flex-shrink-0">
        <Link href="/" className="p-2 rounded-xl bg-gray-800 text-gray-400 hover:text-gray-200">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-100">Cruz</p>
            <p className="text-xs text-green-400">
              {lang === 'es' ? 'En línea · responde al instante' : 'Online · answers instantly'}
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mx-4 mt-3 flex-shrink-0">
        <div className="flex items-start gap-2 bg-amber-900/30 border border-amber-700/50 rounded-xl px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80">
            {lang === 'es'
              ? 'Información general — no es asesoría legal. Para casos migratorios complicados consulta un abogado.'
              : 'General information only — not legal advice. For complex immigration matters, consult an attorney.'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-36">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                <p className="text-sm text-gray-100 leading-relaxed">
                  {lang === 'es'
                    ? '¡Hola! Soy Cruz 🌉 Pregúntame lo que necesites sobre cruzar la frontera — documentos, permisos, aduanas, SENTRI, lo que sea.'
                    : "Hey! I'm Cruz 🌉 Ask me anything about crossing the border — documents, permits, customs, SENTRI, whatever you need."}
                </p>
              </div>
            </div>

            {/* Suggested questions */}
            <div className="ml-10">
              <p className="text-xs text-gray-500 mb-2">
                {lang === 'es' ? 'Preguntas frecuentes:' : 'Common questions:'}
              </p>
              <div className="flex flex-col gap-2">
                {suggested.map(q => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="text-left text-xs text-blue-400 bg-blue-950/40 border border-blue-800/50 hover:bg-blue-900/40 px-3 py-2.5 rounded-xl transition-colors leading-snug"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex items-start gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              m.role === 'user' ? 'bg-gray-600' : 'bg-blue-600'
            }`}>
              {m.role === 'user'
                ? <User className="w-3.5 h-3.5 text-white" />
                : <Bot className="w-3.5 h-3.5 text-white" />}
            </div>
            <div className={`max-w-[85%] text-sm leading-relaxed ${m.role === 'user' ? '' : ''}`}>
              <div className={`px-4 py-3 whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm'
                  : 'bg-gray-800 text-gray-100 rounded-2xl rounded-tl-sm'
              }`}>
                {m.content}
                {m.role === 'assistant' && loading && i === messages.length - 1 && m.content === '' && (
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                )}
              </div>
              {m.role === 'assistant' && m.content.length > 0 && (
                <p className="text-[10px] text-gray-600 mt-1 px-1">
                  {lang === 'es'
                    ? 'Información general · No es asesoría legal · cbp.gov para info oficial'
                    : 'General info only · Not legal advice · cbp.gov for official guidance'}
                </p>
              )}
            </div>
          </div>
        ))}

        {error && (
          <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-xl px-3 py-2 mx-1">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 px-4 py-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <div className="flex items-end gap-2 max-w-lg mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={lang === 'es' ? '¿Tienes alguna pregunta sobre cruzar?' : 'Ask anything about crossing...'}
            className="flex-1 bg-gray-800 text-gray-100 placeholder-gray-500 border border-gray-700 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="w-10 h-10 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-center text-xs text-gray-600 mt-2">
          Cruz · cruzar.app
        </p>
      </div>
    </main>
  )
}
