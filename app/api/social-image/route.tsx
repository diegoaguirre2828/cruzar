import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

// Live wait-time card v2 for FB Page photo posts.
//
// Design intent (replaces v1 list-style flat layout):
//   • HERO at top — the fastest bridge right now, with a giant number,
//     bridge name, and a saturated colored background. This is the
//     ACTIONABLE moment ("go to X, only N min") and deserves the visual
//     weight. v1 buried this in a tiny pill that overlapped a row.
//   • SECONDARY GRID — other 5 bridges as flat rows w/ colored pill
//     wait-time badges. Reads like a compact dashboard, not a list.
//   • Brand bar slim at top with EN VIVO + timestamp pill.
//   • Footer minimal — cruzar.app + "Gratis · En vivo".
//
// Format: 1080×1350 (4:5 portrait) — FB feed max-engagement aspect.
// Hit by /api/cron/fb-publish with cache-busting ?ts= so Graph API
// always pulls a fresh PNG.

export const runtime = 'edge'

const PORT_NAMES: Record<string, string> = {
  '230501': 'Hidalgo / McAllen',
  '230502': 'Pharr–Reynosa',
  '230503': 'Anzaldúas',
  '230901': 'Progreso',
  '230902': 'Donna',
  '535501': 'Brownsville Gateway',
  '535502': 'Brownsville Veterans',
  '535503': 'Los Tomates',
  '230401': 'Laredo I',
  '230402': 'Laredo II',
  '230301': 'Eagle Pass',
  '240201': 'El Paso / Juárez',
}

interface PortRow {
  portId: string
  vehicle?: number | null
  isClosed?: boolean
  noData?: boolean
}

type Level = 'low' | 'medium' | 'high' | 'unknown' | 'closed'

function levelOf(wait: number | null | undefined, isClosed: boolean): Level {
  if (isClosed) return 'closed'
  if (wait == null) return 'unknown'
  if (wait <= 20) return 'low'
  if (wait <= 45) return 'medium'
  return 'high'
}

function levelStyle(level: Level): { fg: string; bg: string; bgSoft: string; label: string; labelEs: string } {
  if (level === 'low')    return { fg: '#0a2e15', bg: '#22c55e', bgSoft: 'rgba(34,197,94,0.15)',  label: 'Fast',     labelEs: 'Rápido'   }
  if (level === 'medium') return { fg: '#3b1d00', bg: '#f59e0b', bgSoft: 'rgba(245,158,11,0.15)', label: 'Moderate', labelEs: 'Moderado' }
  if (level === 'high')   return { fg: '#3d0606', bg: '#ef4444', bgSoft: 'rgba(239,68,68,0.15)',  label: 'Slow',     labelEs: 'Lento'    }
  if (level === 'closed') return { fg: '#1a1a1a', bg: '#6b7280', bgSoft: 'rgba(107,114,128,0.18)', label: 'Closed',   labelEs: 'Cerrado'  }
  return                       { fg: '#1a1a1a', bg: '#6b7280', bgSoft: 'rgba(107,114,128,0.15)', label: 'No data',  labelEs: 'Sin datos' }
}

function fmtWait(wait: number | null | undefined): string {
  if (wait == null) return '—'
  if (wait === 0) return '<1'
  return String(wait)
}

export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get('region') || 'featured'
  const FEATURED_BY_REGION: Record<string, string[]> = {
    featured: ['230501', '230503', '230502', '535501', '535502', '230401'],
    rgv: ['230501', '230502', '230503', '230901', '230902'],
    brownsville: ['535501', '535502', '535503'],
    laredo: ['230401', '230402'],
  }
  const portIds = FEATURED_BY_REGION[region] || FEATURED_BY_REGION.featured

  let ports: PortRow[] = []
  try {
    const res = await fetch('https://cruzar.app/api/ports', { cache: 'no-store' })
    const json = await res.json()
    ports = (json.ports || []) as PortRow[]
  } catch {
    /* fall through with empty list — rows render as Sin datos */
  }

  const rows = portIds.map(portId => {
    const port = ports.find(p => p.portId === portId)
    const isClosed = port?.isClosed ?? false
    const wait = isClosed ? null : (port?.vehicle ?? null)
    const level = levelOf(wait, isClosed)
    return { portId, name: PORT_NAMES[portId] || portId, wait, level, isClosed }
  })

  const fastest = rows
    .filter(r => r.level === 'low' || r.level === 'medium')
    .sort((a, b) => (a.wait ?? 999) - (b.wait ?? 999))[0]
  const others = fastest ? rows.filter(r => r.portId !== fastest.portId) : rows

  const heroLevel = fastest?.level || 'unknown'
  const heroStyle = levelStyle(heroLevel)

  const now = new Date()
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago',
  })
  const dowStr = new Intl.DateTimeFormat('es-MX', { weekday: 'long', timeZone: 'America/Chicago' }).format(now)
  const dowCap = dowStr.charAt(0).toUpperCase() + dowStr.slice(1)

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1350,
          background: '#0a0f1c',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Brand bar — slim top strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '36px 56px 24px',
          }}
        >
          <span style={{ color: '#ffffff', fontSize: 56, fontWeight: 900, letterSpacing: -2.5, textTransform: 'lowercase' }}>
            cruzar
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'rgba(34,197,94,0.16)',
              border: '1.5px solid rgba(34,197,94,0.42)',
              borderRadius: 100,
              padding: '12px 22px',
            }}
          >
            <div style={{ width: 14, height: 14, background: '#4ade80', borderRadius: 7, display: 'flex' }} />
            <span style={{ color: '#4ade80', fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>EN VIVO</span>
          </div>
        </div>

        {/* HERO — fastest bridge right now, dominant visual block */}
        {fastest ? (
          <div
            style={{
              margin: '0 56px',
              background: heroStyle.bg,
              borderRadius: 32,
              padding: '36px 44px 40px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: `0 16px 48px ${heroStyle.bg}33`,
            }}
          >
            <span
              style={{
                color: heroStyle.fg,
                opacity: 0.78,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: 2.5,
                textTransform: 'uppercase',
                display: 'flex',
              }}
            >
              ✓ Más rápido ahorita
            </span>
            <span
              style={{
                color: heroStyle.fg,
                fontSize: 64,
                fontWeight: 900,
                letterSpacing: -2.4,
                marginTop: 8,
                lineHeight: 1.05,
                display: 'flex',
              }}
            >
              {fastest.name}
            </span>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, marginTop: 22 }}>
              <span
                style={{
                  color: heroStyle.fg,
                  fontSize: 240,
                  fontWeight: 900,
                  letterSpacing: -10,
                  lineHeight: 0.85,
                  display: 'flex',
                }}
              >
                {fmtWait(fastest.wait)}
              </span>
              <span
                style={{
                  color: heroStyle.fg,
                  fontSize: 56,
                  fontWeight: 800,
                  marginBottom: 20,
                  display: 'flex',
                  opacity: 0.85,
                }}
              >
                min
              </span>
            </div>
          </div>
        ) : (
          // No "fast" bridge — show a "todos lentos" or "sin datos" hero
          <div
            style={{
              margin: '0 56px',
              background: 'rgba(255,255,255,0.04)',
              border: '1.5px solid rgba(255,255,255,0.10)',
              borderRadius: 32,
              padding: '40px 44px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span style={{ color: '#94a3b8', fontSize: 22, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase', display: 'flex' }}>
              Estado de la frontera
            </span>
            <span style={{ color: '#ffffff', fontSize: 56, fontWeight: 900, marginTop: 12, lineHeight: 1.1, display: 'flex' }}>
              Todos los puentes están lentos ahorita
            </span>
          </div>
        )}

        {/* SECONDARY — date strip + other bridges as compact rows */}
        <div style={{ padding: '28px 56px 0', display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: '#64748b', fontSize: 20, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', display: 'flex' }}>
            Otros puentes · {dowCap} · {timeStr}
          </span>
        </div>

        <div style={{ padding: '14px 56px 0', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          {others.slice(0, 5).map(r => {
            const ls = levelStyle(r.level)
            return (
              <div
                key={r.portId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 20,
                  padding: '18px 22px',
                }}
              >
                <span style={{ color: '#ffffff', fontSize: 30, fontWeight: 700, letterSpacing: -0.5, display: 'flex' }}>
                  {r.name}
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                    background: ls.bgSoft,
                    borderRadius: 14,
                    padding: '8px 18px',
                    minWidth: 130,
                    justifyContent: 'flex-end',
                  }}
                >
                  <span style={{ color: ls.bg, fontSize: 38, fontWeight: 900, letterSpacing: -1.2, display: 'flex' }}>
                    {r.isClosed ? 'Cerrado' : fmtWait(r.wait)}
                  </span>
                  {!r.isClosed && r.wait != null && (
                    <span style={{ color: ls.bg, fontSize: 18, fontWeight: 700, opacity: 0.85, display: 'flex' }}>
                      min
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer — slim, brand + tagline */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '28px 56px 36px',
          }}
        >
          <span style={{ color: '#ffffff', fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>
            cruzar.app
          </span>
          <span style={{ color: '#64748b', fontSize: 20, fontWeight: 600 }}>
            Gratis · En vivo · 8 puentes
          </span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    },
  )
}
