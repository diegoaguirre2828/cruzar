import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Cruzar — Tiempos de espera en los puentes US-México en vivo'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Evergreen OG image. Previous version fetched live /api/ports data
// and rendered a "EN VIVO · {time}" pill, but Facebook caches OG
// images aggressively — the cached PNG would show a stale timestamp
// and stale bridge numbers hours or days after first crawl, which
// undermines the "real time" pitch the image was supposed to sell.
// This version commits to permanent facts about the product only,
// so the image stays accurate forever without cache churn.
export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          padding: '56px 72px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Header — div-positioned bridge logo matching public/logo-icon.svg.
            Satori doesn't render curved SVG paths, so the arch is
            approximated by varying pillar heights. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              background: '#0f172a',
              borderRadius: 22,
              position: 'relative',
              display: 'flex',
              border: '2px solid rgba(255,255,255,0.14)',
            }}
          >
            <div style={{ position: 'absolute', left: 13, right: 13, top: 66, height: 4, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
            <div style={{ position: 'absolute', left: 16, top: 70, width: 2, height: 8, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
            <div style={{ position: 'absolute', right: 16, top: 70, width: 2, height: 8, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
            <div style={{ position: 'absolute', left: 20, top: 54, width: 2, height: 12, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
            <div style={{ position: 'absolute', left: 28, top: 39, width: 2, height: 27, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
            <div style={{ position: 'absolute', left: 38, top: 28, width: 2, height: 38, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
            <div style={{ position: 'absolute', left: 47, top: 24, width: 2.5, height: 42, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
            <div style={{ position: 'absolute', left: 57, top: 28, width: 2, height: 38, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
            <div style={{ position: 'absolute', left: 67, top: 39, width: 2, height: 27, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
            <div style={{ position: 'absolute', left: 75, top: 54, width: 2, height: 12, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
          </div>
          <span style={{ color: '#ffffff', fontSize: 80, fontWeight: 800, letterSpacing: -3, textTransform: 'lowercase' }}>
            cruzar
          </span>
        </div>

        {/* Main headline — the three-beat pain point hook */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          marginTop: 32,
          marginBottom: 8,
        }}>
          <div style={{ color: '#ffffff', fontSize: 68, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05, display: 'flex' }}>
            Todos los puentes.
          </div>
          <div style={{ color: '#ffffff', fontSize: 68, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05, display: 'flex' }}>
            En vivo. <span style={{ color: '#22c55e' }}>Sin adivinar.</span>
          </div>
        </div>

        <div style={{
          color: '#94a3b8',
          fontSize: 24,
          fontWeight: 400,
          marginTop: 20,
          marginBottom: 28,
          display: 'flex',
        }}>
          Cámaras, historial, alertas y reportes de la comunidad — en un solo lugar.
        </div>

        {/* 4 feature tiles — evergreen value prop, no stale data */}
        <div style={{
          display: 'flex',
          gap: 12,
          flex: 1,
        }}>
          {[
            { icon: '🎥', label: 'Cámaras en vivo' },
            { icon: '📊', label: 'Historial por hora' },
            { icon: '🔔', label: 'Alertas de inspecciones' },
            { icon: '🤝', label: 'Reportes de la raza' },
          ].map(f => (
            <div
              key={f.label}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 18,
                padding: '20px 18px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 40, display: 'flex' }}>{f.icon}</div>
              <div style={{
                color: '#e2e8f0',
                fontSize: 20,
                fontWeight: 700,
                lineHeight: 1.2,
                display: 'flex',
              }}>
                {f.label}
              </div>
            </div>
          ))}
        </div>

        {/* Footer — permanent facts, no timestamps */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 24,
          paddingTop: 20,
          borderTop: '1px solid rgba(255,255,255,0.10)',
        }}>
          <span style={{ color: '#ffffff', fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>
            cruzar.app
          </span>
          <div style={{ display: 'flex', gap: 12 }}>
            {['52 puentes', 'US ↔ MX', 'Gratis'].map(tag => (
              <div
                key={tag}
                style={{
                  background: 'rgba(34,197,94,0.14)',
                  color: '#4ade80',
                  fontSize: 16,
                  fontWeight: 700,
                  padding: '8px 16px',
                  borderRadius: 100,
                  border: '1px solid rgba(34,197,94,0.28)',
                  display: 'flex',
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
