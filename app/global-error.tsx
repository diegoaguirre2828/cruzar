'use client'

// Next.js global error boundary — fires ONLY when the root layout
// itself throws. This happens rarely but catastrophically (e.g. a
// provider crashes before children mount), and without this file
// Next falls back to a blank white page with no recovery UI.
//
// Rules for this file, per Next.js docs:
//   1. Must be a client component
//   2. Must render its own <html> and <body> (the root layout is
//      broken, so we don't get its chrome)
//   3. Should not import anything from the normal layout / providers
//      (LangContext, ThemeContext, etc.) because those may be what
//      crashed. Keep it minimalist.

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{
        margin: 0,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif',
        backgroundColor: '#0f172a',
        color: '#f5f5f7',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}>
        <div style={{
          maxWidth: '420px',
          width: '100%',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '1.5rem',
          textAlign: 'center',
        }}>
          {/* Plain <img> rather than the BridgeLogo wrapper — this file
              must stay self-contained per Next.js global-error rules
              (no shared providers / context / component imports that
              could be what crashed). */}
          <img
            src="/logo-icon.svg"
            alt="Cruzar"
            width={56}
            height={56}
            style={{ width: 56, height: 56, marginBottom: '0.75rem', borderRadius: 12 }}
          />
          <h1 style={{ fontSize: '1.125rem', fontWeight: 900, margin: '0 0 0.5rem' }}>
            Cruzar está caído · Cruzar is down
          </h1>
          <p style={{ fontSize: '0.75rem', opacity: 0.65, margin: '0 0 1.25rem', lineHeight: 1.5 }}>
            Algo falló al cargar. Ya nos enteramos. Intenta de nuevo en un momento. · Something failed to load. We&apos;ve been notified. Try again in a moment.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              onClick={reset}
              style={{
                width: '100%',
                padding: '0.625rem 1rem',
                borderRadius: '12px',
                backgroundColor: '#2563eb',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.875rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Reintentar · Try again
            </button>
            <a
              href="/"
              style={{
                width: '100%',
                padding: '0.625rem 1rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#f5f5f7',
                fontWeight: 600,
                fontSize: '0.875rem',
                textDecoration: 'none',
                display: 'block',
                boxSizing: 'border-box',
              }}
            >
              Inicio · Home
            </a>
          </div>
          {error.digest && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.625rem', opacity: 0.4, fontFamily: 'monospace' }}>
              ID: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  )
}
