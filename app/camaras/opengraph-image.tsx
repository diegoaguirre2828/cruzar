import { ImageResponse } from 'next/og'
import { PORT_META } from '@/lib/portMeta'
import { BRIDGE_CAMERAS } from '@/lib/bridgeCameras'

export const runtime = 'edge'
export const alt = 'Cruzar — cámaras en vivo de los puentes fronterizos'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Featured ports shown in the OG preview — chosen for highest search
// volume in the FB groups where this link gets shared. Keep the set
// small (6 max) so each tile stays legible at 1200×630 thumbnail size.
const FEATURED_PORT_IDS = [
  '230501', // Hidalgo
  '230502', // Pharr
  '230401', // Laredo I
  '240201', // BOTA El Paso
  '250401', // San Ysidro
  '535504', // Gateway Brownsville
]

interface ApiPort {
  portId: string
  vehicle: number | null
  isClosed: boolean
}

async function fetchLiveWaits(): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>()
  try {
    const res = await fetch('https://cruzar.app/api/ports', {
      next: { revalidate: 300 },
    })
    if (!res.ok) return map
    const data = await res.json()
    const ports: ApiPort[] = data.ports || []
    for (const p of ports) {
      map.set(p.portId, p.isClosed ? null : p.vehicle)
    }
  } catch {
    /* fall back to empty map — tiles render with "—" */
  }
  return map
}

function tone(mins: number | null): { bg: string; border: string; fg: string; label: string } {
  if (mins === null) return { bg: '#1f2937', border: '#374151', fg: '#9ca3af', label: '—' }
  if (mins <= 20) return { bg: '#14532d', border: '#22c55e', fg: '#4ade80', label: `${mins} min` }
  if (mins <= 45) return { bg: '#78350f', border: '#f59e0b', fg: '#fbbf24', label: `${mins} min` }
  return { bg: '#7f1d1d', border: '#ef4444', fg: '#f87171', label: `${mins} min` }
}

export default async function CamarasOG() {
  const waits = await fetchLiveWaits()
  const total = Object.values(BRIDGE_CAMERAS).reduce((n, feeds) => n + (feeds?.length || 0), 0)
  const portCount = Object.keys(BRIDGE_CAMERAS).length

  const tiles = FEATURED_PORT_IDS.map((portId) => {
    const meta = PORT_META[portId]
    const name = meta?.localName || meta?.city || portId
    const mins = waits.get(portId) ?? null
    return { name, mins, tone: tone(mins) }
  })

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          padding: '40px 56px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Header row — brand + live pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <span
              style={{
                color: '#ffffff',
                fontSize: 44,
                fontWeight: 900,
                letterSpacing: -2,
                textTransform: 'lowercase',
              }}
            >
              cruzar
            </span>
            <span style={{ color: '#64748b', fontSize: 20, fontWeight: 700, display: 'flex' }}>
              .app/camaras
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.45)',
              padding: '8px 18px',
              borderRadius: 100,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 10,
                background: '#ef4444',
                display: 'flex',
              }}
            />
            <span style={{ color: '#fca5a5', fontSize: 18, fontWeight: 900, letterSpacing: 1.5 }}>
              EN VIVO
            </span>
          </div>
        </div>

        {/* Headline — the pitch */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 22 }}>
          <div
            style={{
              color: '#ffffff',
              fontSize: 60,
              fontWeight: 900,
              letterSpacing: -2.5,
              lineHeight: 1.03,
              display: 'flex',
            }}
          >
            Mira los puentes ahorita.
          </div>
          <div
            style={{
              color: '#4ade80',
              fontSize: 60,
              fontWeight: 900,
              letterSpacing: -2.5,
              lineHeight: 1.03,
              display: 'flex',
            }}
          >
            Cámaras + tiempo en vivo.
          </div>
        </div>

        {/* Live data grid — 3 columns × 2 rows of port tiles */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            marginTop: 24,
            flex: 1,
          }}
        >
          {tiles.map((t) => (
            <div
              key={t.name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 16,
                padding: '14px 16px',
                gap: 8,
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 8,
                    background: '#ef4444',
                    display: 'flex',
                  }}
                />
                <span
                  style={{
                    color: '#94a3b8',
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    display: 'flex',
                  }}
                >
                  📹 En vivo
                </span>
              </div>
              <div
                style={{
                  color: '#ffffff',
                  fontSize: 24,
                  fontWeight: 800,
                  letterSpacing: -0.5,
                  lineHeight: 1.1,
                  display: 'flex',
                }}
              >
                {t.name}
              </div>
              <div
                style={{
                  background: t.tone.bg,
                  border: `1.5px solid ${t.tone.border}`,
                  color: t.tone.fg,
                  fontSize: 22,
                  fontWeight: 900,
                  padding: '6px 14px',
                  borderRadius: 100,
                  alignSelf: 'flex-start',
                  display: 'flex',
                }}
              >
                {t.tone.label}
              </div>
            </div>
          ))}
        </div>

        {/* Footer — social proof / coverage stats */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 20,
            paddingTop: 18,
            borderTop: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div style={{ display: 'flex', gap: 24 }}>
            <span style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 800, display: 'flex' }}>
              {portCount} puentes
            </span>
            <span style={{ color: '#64748b', fontSize: 20, display: 'flex' }}>·</span>
            <span style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 800, display: 'flex' }}>
              {total} cámaras
            </span>
            <span style={{ color: '#64748b', fontSize: 20, display: 'flex' }}>·</span>
            <span style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 800, display: 'flex' }}>
              Gratis
            </span>
          </div>
          <span style={{ color: '#4ade80', fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }}>
            Abrir →
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
