import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const revalidate = 900 // regenerate every 15 min
export const alt = 'Cruzar – Live US-Mexico Border Wait Times'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const FEATURED = ['230501', '230502', '230503', '230901', '535501', '230401']
const PORT_NAMES: Record<string, string> = {
  '230501': 'Hidalgo / McAllen',
  '230502': 'Pharr–Reynosa',
  '230503': 'Anzaldúas',
  '230901': 'Progreso',
  '535501': 'Brownsville Gateway',
  '230401': 'Laredo I',
}

export default async function OGImage() {
  let crossings: { name: string; wait: number; level: string }[] = []
  try {
    const res = await fetch('https://cruzar.app/api/ports', { cache: 'no-store' })
    const { ports } = await res.json()
    crossings = FEATURED
      .map(id => {
        const p = ports?.find((x: { portId: string; vehicle: number | null }) => x.portId === id)
        const wait = p?.vehicle ?? null
        const level = !wait || wait <= 0 ? 'low' : wait <= 20 ? 'low' : wait <= 45 ? 'medium' : 'high'
        return { name: PORT_NAMES[id] || id, wait: wait ?? 0, level }
      })
      .filter(c => c.wait > 0)
  } catch {
    crossings = [
      { name: 'Hidalgo / McAllen', wait: 12, level: 'low' },
      { name: 'Pharr–Reynosa', wait: 28, level: 'medium' },
      { name: 'Anzaldúas', wait: 8, level: 'low' },
      { name: 'Progreso', wait: 45, level: 'medium' },
      { name: 'Brownsville Gateway', wait: 15, level: 'low' },
      { name: 'Laredo I', wait: 55, level: 'high' },
    ]
  }

  const now = new Date().toLocaleTimeString('es-MX', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago',
  })

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
          <span style={{ color: '#ffffff', fontSize: 52, fontWeight: 800, letterSpacing: -1 }}>
            Cruzar
          </span>
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
            EN VIVO · {now.toUpperCase()}
          </div>
        </div>

        <div style={{ color: '#94a3b8', fontSize: 22, marginBottom: 40, fontWeight: 400 }}>
          Tiempos de espera US–México en tiempo real · Gratis para todos
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
            cruzar.app
          </span>
          <div style={{ display: 'flex', gap: 20 }}>
            {['52 puentes', 'Cada 15 min', 'Gratis'].map(tag => (
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
