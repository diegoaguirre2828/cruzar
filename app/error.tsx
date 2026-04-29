'use client'

// Root-level error boundary — catches any unhandled exception from a
// server component, layout, or page that doesn't have its own
// error.tsx nearer the route. Without this file, Next.js falls back
// to its default dev-style error page, which renders as a white
// screen with stack trace text to end users in production — looks
// broken rather than degraded.
//
// Sentry captures the exception via captureUnderscoreErrorException
// (already wired in sentry.server.config.ts + instrumentation.ts), so
// this component is purely the user-facing graceful-degradation UI.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import { BridgeLogo } from '@/components/BridgeLogo'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

function looksLikeChunkError(err: Error & { digest?: string }): boolean {
  const msg = err?.message || ''
  const name = err?.name || ''
  if (name === 'ChunkLoadError') return true
  return (
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /Loading CSS chunk/i.test(msg) ||
    /failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg)
  )
}

const CHUNK_RELOAD_KEY = 'cruzar_chunk_reload_at'
const CHUNK_LOOP_WINDOW_MS = 10_000

export default function GlobalError({ error, reset }: Props) {
  // Network-aware copy: "we're on it" reads as our fault, which for
  // the #1 failure mode (spotty border cell) is a lie — user is
  // offline. Checking navigator.onLine lets us swap to "check your
  // signal" so they know to move or retry instead of assuming the
  // app is broken. Updates live if connectivity changes.
  const [online, setOnline] = useState(true)
  useEffect(() => {
    if (typeof navigator !== 'undefined') setOnline(navigator.onLine)
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    Sentry.captureException(error)

    // If the exception bubbling into the root boundary is a chunk-load
    // failure (stale SW shell referencing deleted Next.js chunk hashes),
    // auto-recover: wipe SW caches, unregister the SW, hard reload.
    // Guard against infinite loops with a 10s sessionStorage window.
    if (looksLikeChunkError(error)) {
      try {
        const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0)
        if (last && Date.now() - last < CHUNK_LOOP_WINDOW_MS) return
        sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
      } catch { /* session storage blocked — still try once */ }
      ;(async () => {
        try {
          if ('caches' in window) {
            const keys = await caches.keys()
            await Promise.all(keys.map((k) => caches.delete(k)))
          }
        } catch {}
        try {
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations()
            await Promise.all(regs.map((r) => r.unregister()))
          }
        } catch {}
        window.location.reload()
      })()
    }
  }, [error])

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm text-center">
        <div className="flex justify-center mb-3"><BridgeLogo size={48} /></div>
        <h1 className="text-lg font-black text-gray-900 dark:text-gray-100 mb-1">
          {online ? 'Algo falló · Something broke' : 'Sin señal · No connection'}
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug mb-5">
          {online
            ? 'Tuvimos un problema cargando esta página. Ya nos enteramos. · We had trouble loading this page. We’re on it.'
            : 'Revisa tu señal y vuelve a intentar. · Check your signal and try again.'}
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={reset}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold active:scale-[0.98] transition-transform"
          >
            Reintentar · Try again
          </button>
          <Link
            href="/"
            className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-sm font-semibold"
          >
            Volver al inicio · Back to home
          </Link>
        </div>
        {error.digest && (
          <p className="mt-4 text-[10px] text-gray-400 dark:text-gray-500 font-mono">
            ID: {error.digest}
          </p>
        )}
      </div>
    </main>
  )
}
