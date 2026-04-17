import { ImageResponse } from 'next/og'
import { PORT_META } from '@/lib/portMeta'
import { BRIDGE_CAMERAS } from '@/lib/bridgeCameras'

export const runtime = 'edge'
export const alt = 'Cruzar — cámaras en vivo de los puentes fronterizos'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Featured ports surfaced in the preview. Chosen for highest search
// volume in the FB groups where this link gets shared. Kept evergreen
// (no runtime fetch) so the image always renders fast and never
// ships stale numbers — the v1 attempt at pulling live /api/ports
// at edge-render time returned 0-byte PNGs under load.
const FEATURED: Array<{ portId: string; viewLabel: string }> = [
  { portId: '230501', viewLabel: 'McAllen · Hidalgo' },
  { portId: '230502', viewLabel: 'Reynosa · Pharr' },
  { portId: '230401', viewLabel: 'Laredo · Gateway' },
  { portId: '240201', viewLabel: 'Juárez · BOTA' },
  { portId: '250401', viewLabel: 'Tijuana · San Ysidro' },
  { portId: '535504', viewLabel: 'Matamoros · Gateway' },
]

export default async function CamarasOG() {
  const total = Object.values(BRIDGE_CAMERAS).reduce((n, feeds) => n + (feeds?.length || 0), 0)
  const portCount = Object.keys(BRIDGE_CAMERAS).length

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
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 28 }}>
          <div
            style={{
              color: '#ffffff',
              fontSize: 64,
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
              fontSize: 64,
              fontWeight: 900,
              letterSpacing: -2.5,
              lineHeight: 1.03,
              display: 'flex',
            }}
          >
            Cámaras + tiempo en vivo.
          </div>
        </div>

        {/* Port tile rows — two rows of three, flex-only (Satori doesn't grid) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28, flex: 1 }}>
          {[FEATURED.slice(0, 3), FEATURED.slice(3, 6)].map((row, rIdx) => (
            <div key={rIdx} style={{ display: 'flex', gap: 12, flex: 1 }}>
              {row.map((t) => {
                const meta = PORT_META[t.portId]
                const localName = meta?.localName || meta?.city || t.portId
                return (
                  <div
                    key={t.portId}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      background: 'rgba(34,197,94,0.06)',
                      border: '1px solid rgba(255,255,255,0.14)',
                      borderRadius: 16,
                      padding: '14px 16px',
                      justifyContent: 'space-between',
                      gap: 6,
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
                          color: '#fca5a5',
                          fontSize: 13,
                          fontWeight: 900,
                          letterSpacing: 1.2,
                          textTransform: 'uppercase',
                          display: 'flex',
                        }}
                      >
                        Cámara en vivo
                      </span>
                    </div>
                    <div
                      style={{
                        color: '#ffffff',
                        fontSize: 26,
                        fontWeight: 900,
                        letterSpacing: -0.8,
                        lineHeight: 1.05,
                        display: 'flex',
                      }}
                    >
                      {localName}
                    </div>
                    <div
                      style={{
                        color: '#94a3b8',
                        fontSize: 14,
                        fontWeight: 700,
                        letterSpacing: 0.2,
                        display: 'flex',
                      }}
                    >
                      {t.viewLabel}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer — social proof / coverage stats + CTA */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 18,
            paddingTop: 18,
            borderTop: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
            <span style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 900, display: 'flex' }}>
              {portCount} puentes
            </span>
            <span style={{ color: '#475569', fontSize: 22, display: 'flex' }}>·</span>
            <span style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 900, display: 'flex' }}>
              {total} cámaras
            </span>
            <span style={{ color: '#475569', fontSize: 22, display: 'flex' }}>·</span>
            <span style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 900, display: 'flex' }}>
              Gratis
            </span>
          </div>
          <span style={{ color: '#4ade80', fontSize: 24, fontWeight: 900, letterSpacing: -0.5 }}>
            Abrir →
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
