'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { Mic, MicOff, Volume2, ArrowLeft, RadioTower, Check } from 'lucide-react'

interface NearbyPort {
  port_id: string
  name: string
  city: string
  region: string
  distKm: number
  driveMin: number
  waitMin: number | null
  totalMin: number
}

interface Circle {
  id: string
  name: string
}

export default function CopilotPage() {
  const { lang } = useLang()
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [nearby, setNearby] = useState<NearbyPort[]>([])
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [circles, setCircles] = useState<Circle[]>([])
  const [autoTextCircleId, setAutoTextCircleId] = useState('')
  const [voiceOptIn, setVoiceOptIn] = useState(false)
  const [crossed, setCrossed] = useState(false)
  const [busy, setBusy] = useState(false)
  const recogRef = useRef<unknown>(null)

  const t = {
    title: lang === 'es' ? '🎙️ Co-Pilot' : '🎙️ Co-Pilot',
    subtitle: lang === 'es' ? 'Manos libres para tu cruce.' : 'Hands-free for your crossing.',
    listen: lang === 'es' ? 'Escuchar' : 'Listen',
    stop: lang === 'es' ? 'Detener' : 'Stop',
    speak: lang === 'es' ? 'Decir espera' : 'Speak wait',
    crossed: lang === 'es' ? 'Ya crucé' : 'I crossed',
    crossedSent: lang === 'es' ? 'Aviso enviado a tu familia ✓' : 'Family notified ✓',
    voiceLabel: lang === 'es' ? 'Activar voz' : 'Enable voice',
    autoText: lang === 'es' ? 'Avisar a este círculo cuando cruce' : 'Notify this circle when I cross',
    sayPrompt: lang === 'es' ? 'Di "espera" o "puente más cercano"' : 'Say "wait" or "nearest bridge"',
    back: lang === 'es' ? 'Inicio' : 'Home',
    none: lang === 'es' ? 'Sin círculo' : 'No circle',
  }

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition((p) => {
      setCoords({ lat: p.coords.latitude, lng: p.coords.longitude })
    }, () => {}, { maximumAge: 60000, timeout: 10000 })

    fetch('/api/circles').then((r) => r.json()).then((j) => {
      setCircles((j.circles ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
    }).catch(() => {})

    fetch('/api/profile').then((r) => r.json()).then((j) => {
      const p = j?.profile ?? {}
      if (typeof p.copilot_voice_opt_in === 'boolean') setVoiceOptIn(p.copilot_voice_opt_in)
      if (p.copilot_auto_text_circle_id) setAutoTextCircleId(p.copilot_auto_text_circle_id)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!coords) return
    fetch(`/api/smart-route?lat=${coords.lat}&lng=${coords.lng}&limit=3`)
      .then((r) => r.json())
      .then((j) => setNearby(j.routes ?? []))
      .catch(() => {})
  }, [coords])

  function speak(text: string) {
    if (typeof window === 'undefined') return
    const synth = window.speechSynthesis
    if (!synth) return
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang === 'es' ? 'es-MX' : 'en-US'
    u.rate = 1
    synth.cancel()
    synth.speak(u)
  }

  function toggleListening() {
    if (typeof window === 'undefined') return
    type RecogConstructor = new () => {
      lang: string
      continuous: boolean
      interimResults: boolean
      onresult: (e: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void
      onend: () => void
      start: () => void
      stop: () => void
    }
    const SR = (window as unknown as { SpeechRecognition?: RecogConstructor; webkitSpeechRecognition?: RecogConstructor }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: RecogConstructor }).webkitSpeechRecognition
    if (!SR) {
      speak(lang === 'es' ? 'Voz no disponible en este navegador.' : 'Voice not available in this browser.')
      return
    }
    if (listening) {
      const r = recogRef.current as { stop: () => void } | null
      r?.stop()
      setListening(false)
      return
    }
    const recog = new SR()
    recog.lang = lang === 'es' ? 'es-MX' : 'en-US'
    recog.continuous = false
    recog.interimResults = true
    recog.onresult = (e) => {
      let final = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
      }
      if (final) {
        setTranscript(final.trim())
        handleVoiceCommand(final.toLowerCase())
      }
    }
    recog.onend = () => setListening(false)
    recogRef.current = recog
    recog.start()
    setListening(true)
  }

  function handleVoiceCommand(cmd: string) {
    if (cmd.includes('espera') || cmd.includes('wait')) {
      speakWait()
    } else if (cmd.includes('puente') || cmd.includes('bridge') || cmd.includes('nearest')) {
      speakNearest()
    } else if (cmd.includes('crucé') || cmd.includes('crossed')) {
      markCrossed()
    } else if (cmd.includes('hora') || cmd.includes('eta') || cmd.includes('time')) {
      speakNearest()
    }
  }

  function speakWait() {
    const r = nearby[0]
    if (!r) return
    const msg = lang === 'es'
      ? `La espera en ${r.name} es ${r.waitMin ?? 'desconocida'} minutos. Total con tráfico ${r.totalMin} minutos.`
      : `Wait at ${r.name} is ${r.waitMin ?? 'unknown'} minutes. Total with traffic ${r.totalMin} minutes.`
    speak(msg)
  }

  function speakNearest() {
    const r = nearby[0]
    if (!r) return
    const msg = lang === 'es'
      ? `El puente más cercano es ${r.name}, a ${r.distKm} kilómetros, con ${r.driveMin} minutos de manejo y espera de ${r.waitMin ?? 'desconocida'} minutos.`
      : `Nearest bridge is ${r.name}, ${r.distKm} kilometers away, ${r.driveMin} drive minutes, wait ${r.waitMin ?? 'unknown'}.`
    speak(msg)
  }

  async function markCrossed() {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/copilot/cross-detected', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lat: coords?.lat,
          lng: coords?.lng,
          port_id: nearby[0]?.port_id,
          circle_id: autoTextCircleId || null,
        }),
      })
      setCrossed(true)
      speak(lang === 'es' ? 'Listo, avisé a tu familia.' : 'Done — family notified.')
    } finally {
      setBusy(false)
    }
  }

  async function saveSettings() {
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        copilot_voice_opt_in: voiceOptIn,
        copilot_auto_text_circle_id: autoTextCircleId || null,
      }),
    })
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-16 pt-6">
        <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 mb-3"><ArrowLeft className="w-3 h-3" /> {t.back}</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t.title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5">{t.subtitle}</p>

        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={toggleListening}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold ${listening ? 'bg-red-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {listening ? t.stop : t.listen}
            </button>
            <button onClick={speakWait} className="ml-2 flex items-center gap-1 px-3 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-medium">
              <Volume2 className="w-4 h-4" /> {t.speak}
            </button>
          </div>
          <p className="text-xs text-gray-400 italic">{t.sayPrompt}</p>
          {transcript && <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">"{transcript}"</p>}
        </section>

        {nearby.length > 0 && (
          <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm mb-4">
            <h2 className="text-sm font-semibold mb-3">{lang === 'es' ? 'Puentes cercanos' : 'Nearest bridges'}</h2>
            <ul className="space-y-2">
              {nearby.slice(0, 3).map((r) => (
                <li key={r.port_id} className="flex items-center justify-between text-sm">
                  <span>{r.name}</span>
                  <span className="text-xs text-gray-500">{r.waitMin ?? '?'}min wait · {r.driveMin}min drive</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm mb-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><RadioTower className="w-4 h-4" /> {t.autoText}</h2>
          <select value={autoTextCircleId} onChange={(e) => setAutoTextCircleId(e.target.value)} className="w-full text-sm rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2">
            <option value="">{t.none}</option>
            {circles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="flex items-center gap-2 mt-3 text-xs text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={voiceOptIn} onChange={(e) => setVoiceOptIn(e.target.checked)} />
            {t.voiceLabel}
          </label>
          <button onClick={saveSettings} className="mt-3 w-full text-xs font-medium text-blue-600 hover:underline">Save</button>
        </section>

        <button
          onClick={markCrossed}
          disabled={busy || crossed}
          className={`w-full py-3 rounded-xl text-sm font-semibold ${crossed ? 'bg-green-500 text-white' : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:opacity-90'} disabled:opacity-60`}
        >
          {crossed ? <span className="inline-flex items-center gap-1"><Check className="w-4 h-4" /> {t.crossedSent}</span> : t.crossed}
        </button>
      </div>
    </main>
  )
}
