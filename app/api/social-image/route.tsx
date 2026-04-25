import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

// Live wait-time card for FB Page photo posts. Generated server-side
// (Edge runtime, no headless browser needed) and consumed by
// /api/cron/fb-publish as the `url` parameter to Graph API /photos.
//
// Why a route, not a static OG: the static /opengraph-image is locked
// to evergreen brand copy because FB caches OG aggressively. This
// route is hit fresh by the publisher (every post fetches a new
// timestamp via ?ts=) and the resulting PNG is what gets uploaded as
// the photo asset to the Page — there is no FB OG cache layer in that
// path because the URL is unique per post.
//
// Format: 1080×1350 (4:5 portrait) — FB's max-engagement aspect ratio
// for in-feed photos. Square 1080 also works but portrait wins reach.

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

function levelColor(wait: number | null | undefined): { bg: string; fg: string; label: string } {
  if (wait == null) return { bg: 'rgba(107,114,128,0.18)', fg: '#9ca3af', label: 'Sin datos' }
  if (wait <= 20) return { bg: 'rgba(34,197,94,0.16)', fg: '#4ade80', label: 'Rápido' }
  if (wait <= 45) return { bg: 'rgba(245,158,11,0.16)', fg: '#fbbf24', label: 'Moderado' }
  return { bg: 'rgba(239,68,68,0.16)', fg: '#f87171', label: 'Lento' }
}

function fmtWait(wait: number | null | undefined): string {
  if (wait == null) return '—'
  if (wait === 0) return '<1'
  return String(wait)
}

export async function GET(req: NextRequest) {
  // Optional region filter for future variants. Default = featured RGV+
  // Brownsville+Laredo set, which matches /api/social/next-post FEATURED.
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
    // Fall through with empty list — image will render "Sin datos" rows
  }

  const rows = portIds.map(portId => {
    const port = ports.find(p => p.portId === portId)
    const wait = port?.isClosed ? null : (port?.vehicle ?? null)
    return { portId, name: PORT_NAMES[portId] || portId, wait, isClosed: port?.isClosed ?? false }
  })

  const fastest = rows
    .filter(r => r.wait != null && r.wait >= 0 && !r.isClosed)
    .sort((a, b) => (a.wait! - b.wait!))[0]

  const now = new Date()
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Chicago',
  })
  const dowStr = new Intl.DateTimeFormat('es-MX', { weekday: 'long', timeZone: 'America/Chicago' }).format(now)
  const dowCap = dowStr.charAt(0).toUpperCase() + dowStr.slice(1)

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1350,
          background: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          padding: '64px 56px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Header: brand + timestamp pill */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 64,
                height: 64,
                background: '#0f172a',
                borderRadius: 16,
                display: 'flex',
                border: '2px solid rgba(255,255,255,0.16)',
                position: 'relative',
              }}
            >
              <div style={{ position: 'absolute', left: 9, right: 9, top: 44, height: 3, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
              <div style={{ position: 'absolute', left: 11, top: 47, width: 1.5, height: 6, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
              <div style={{ position: 'absolute', right: 11, top: 47, width: 1.5, height: 6, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
              <div style={{ position: 'absolute', left: 14, top: 36, width: 1.5, height: 8, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
              <div style={{ position: 'absolute', left: 19, top: 26, width: 1.5, height: 18, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
              <div style={{ position: 'absolute', left: 25, top: 19, width: 1.5, height: 25, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
              <div style={{ position: 'absolute', left: 31, top: 16, width: 2, height: 28, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
              <div style={{ position: 'absolute', left: 38, top: 19, width: 1.5, height: 25, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
              <div style={{ position: 'absolute', left: 44, top: 26, width: 1.5, height: 18, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
              <div style={{ position: 'absolute', left: 49, top: 36, width: 1.5, height: 8, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
            </div>
            <span style={{ color: '#ffffff', fontSize: 56, fontWeight: 800, letterSpacing: -2, textTransform: 'lowercase' }}>
              cruzar
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(34,197,94,0.16)',
              border: '1px solid rgba(34,197,94,0.32)',
              borderRadius: 100,
              padding: '12px 20px',
            }}
          >
            <div style={{ width: 12, height: 12, background: '#4ade80', borderRadius: 6, display: 'flex' }} />
            <span style={{ color: '#4ade80', fontSize: 22, fontWeight: 700 }}>EN VIVO</span>
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 36, marginBottom: 8 }}>
          <div style={{ color: '#ffffff', fontSize: 64, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05, display: 'flex' }}>
            Tiempos en los puentes
          </div>
          <div style={{ color: '#94a3b8', fontSize: 30, fontWeight: 500, marginTop: 8, display: 'flex' }}>
            {dowCap} · {timeStr}
          </div>
        </div>

        {/* Bridge rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 36, flex: 1 }}>
          {rows.map(r => {
            const lc = levelColor(r.isClosed ? null : r.wait)
            return (
              <div
                key={r.portId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderLeft: `6px solid ${lc.fg}`,
                  borderRadius: 18,
                  padding: '24px 28px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: '#ffffff', fontSize: 32, fontWeight: 700, letterSpacing: -0.5 }}>
                    {r.name}
                  </span>
                  <span style={{ color: lc.fg, fontSize: 18, fontWeight: 600, marginTop: 4 }}>
                    {r.isClosed ? 'Cerrado' : lc.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ color: '#ffffff', fontSize: 56, fontWeight: 800, letterSpacing: -2 }}>
                    {r.isClosed ? '—' : fmtWait(r.wait)}
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: 22, fontWeight: 600 }}>
                    {r.isClosed ? '' : 'min'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Fastest pill + footer */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 28 }}>
          {fastest && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                background: 'rgba(34,197,94,0.12)',
                border: '1px solid rgba(34,197,94,0.28)',
                borderRadius: 18,
                padding: '20px 28px',
                marginBottom: 24,
              }}
            >
              <span style={{ fontSize: 36, display: 'flex' }}>✅</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: '#94a3b8', fontSize: 18, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Más rápido ahorita
                </span>
                <span style={{ color: '#ffffff', fontSize: 30, fontWeight: 700 }}>
                  {fastest.name} · {fmtWait(fastest.wait)} min
                </span>
              </div>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 22,
              borderTop: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <span style={{ color: '#ffffff', fontSize: 28, fontWeight: 700 }}>
              cruzar.app
            </span>
            <span style={{ color: '#94a3b8', fontSize: 20, fontWeight: 500 }}>
              Gratis · En vivo · Sin grupos
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      headers: {
        // Tight cache so Graph API always pulls a fresh PNG when the
        // publisher hits this route. Anything longer risks the image
        // being re-served stale to a second post in the same window.
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    },
  )
}
