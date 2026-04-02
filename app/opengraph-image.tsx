import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Cruza – Live US-Mexico Border Wait Times'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  const crossings = [
    { name: 'Hidalgo / McAllen',     wait: 12, level: 'low' },
    { name: 'Pharr–Reynosa',         wait: 28, level: 'medium' },
    { name: 'Laredo I (Gateway)',     wait: 51, level: 'high' },
    { name: 'Gateway International', wait: 8,  level: 'low' },
    { name: 'Anzaldúas',             wait: 19, level: 'low' },
    { name: 'Laredo II (World Trade)',wait: 34, level: 'medium' },
  ]

  const dotColor = (level: string) =>
    level === 'low' ? '#22c55e' : level === 'medium' ? '#f59e0b' : '#ef4444'

  const badgeBg = (level: string) =>
    level === 'low' ? '#14532d' : level === 'medium' ? '#713f12' : '#7f1d1d'

  const badgeText = (level: string) =>
    level === 'low' ? '#4ade80' : level === 'medium' ? '#fbbf24' : '#f87171'

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          padding: '60px 72px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 52 }}>🌉</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#ffffff', fontSize: 52, fontWeight: 800, letterSpacing: -1 }}>
              Cruza
            </span>
          </div>
          <div style={{
            marginLeft: 12,
            background: '#22c55e',
            color: '#fff',
            fontSize: 18,
            fontWeight: 700,
            padding: '6px 16px',
            borderRadius: 100,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <div style={{ width: 8, height: 8, background: '#fff', borderRadius: '50%' }} />
            LIVE
          </div>
        </div>

        <div style={{ color: '#94a3b8', fontSize: 24, marginBottom: 44, fontWeight: 400 }}>
          Real-time US–Mexico border wait times · Free for everyone
        </div>

        {/* Crossing cards grid */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          flex: 1,
        }}>
          {crossings.map((c) => (
            <div
              key={c.name}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 16,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 24,
                width: 'calc(50% - 6px)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: dotColor(c.level),
                  flexShrink: 0,
                }} />
                <span style={{ color: '#e2e8f0', fontSize: 18, fontWeight: 600 }}>
                  {c.name}
                </span>
              </div>
              <div style={{
                background: badgeBg(c.level),
                color: badgeText(c.level),
                fontSize: 20,
                fontWeight: 800,
                padding: '4px 14px',
                borderRadius: 100,
                display: 'flex',
              }}>
                {c.wait}m
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 32,
          paddingTop: 24,
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          <span style={{ color: '#475569', fontSize: 18 }}>
            cruzaapp.vercel.app
          </span>
          <div style={{ display: 'flex', gap: 20 }}>
            {['52 crossings', 'Updated every 15 min', 'Free forever'].map(tag => (
              <div
                key={tag}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: '#94a3b8',
                  fontSize: 15,
                  padding: '6px 14px',
                  borderRadius: 100,
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
