// Regenerates the Cruzar Facebook page profile picture + cover photo
// as PNG files in public/. Run from project root:
//
//   node scripts/gen-fb-assets.mjs
//
// Uses the REAL locked arch-bridge path from public/logo-icon.svg
// (Q curve for the arch, varying pillar heights) — not the Satori
// approximation — and rasterizes via sharp for pixel-perfect output.
// Produces:
//   public/fb-avatar.png  (720×720, square, upload as FB PFP)
//   public/fb-cover.png   (1640×624, upload as FB page cover)

import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// ─────────────────────────────────────────────────────────────
// Locked logo geometry — mirrors public/logo-icon.svg verbatim.
// Lives inside a 100×100 viewBox. Consumers wrap in <g transform="..."> to scale.
// ─────────────────────────────────────────────────────────────
const LOGO_MARK_INNER = `
  <rect x="14" y="68" width="72" height="3.5" rx="0.5" fill="#ffffff"/>
  <rect x="17" y="71.5" width="2" height="6" rx="0.5" fill="#ffffff"/>
  <rect x="81" y="71.5" width="2" height="6" rx="0.5" fill="#ffffff"/>
  <path d="M 17 68 Q 50 -16 83 68" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <line x1="22" y1="56" x2="22" y2="68" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="30" y1="41" x2="30" y2="68" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="40" y1="30" x2="40" y2="68" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="50" y1="26" x2="50" y2="68" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
  <line x1="60" y1="30" x2="60" y2="68" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="70" y1="41" x2="70" y2="68" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="78" y1="56" x2="78" y2="68" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
`

// ─────────────────────────────────────────────────────────────
// Avatar — 720×720
// Navy fill, bridge geometry scaled to fill ~75% of the canvas.
// FB crops the PFP circular on display, so we skip the rounded
// square border (the navy fill goes edge to edge) and let the
// bridge sit dead center.
// ─────────────────────────────────────────────────────────────
const AVATAR_W = 720
const AVATAR_H = 720
const avatarSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${AVATAR_W}" height="${AVATAR_H}" viewBox="0 0 ${AVATAR_W} ${AVATAR_H}"
     xmlns="http://www.w3.org/2000/svg">
  <rect width="${AVATAR_W}" height="${AVATAR_H}" fill="#0f172a"/>
  <g transform="translate(60, 60) scale(6)">
    ${LOGO_MARK_INNER}
  </g>
</svg>`

// ─────────────────────────────────────────────────────────────
// Cover — 1640×624 (2× the 820×312 FB desktop spec, retina)
// ─────────────────────────────────────────────────────────────
const COVER_W = 1640
const COVER_H = 624

const bridgeRows = [
  { name: 'Hidalgo / McAllen',      wait: 12, level: 'low' },
  { name: 'Pharr–Reynosa',          wait: 28, level: 'medium' },
  { name: 'Anzaldúas',              wait:  8, level: 'low' },
  { name: 'Progreso',               wait: 45, level: 'medium' },
  { name: 'Brownsville Gateway',    wait: 55, level: 'high' },
]

const LEVEL = {
  low:    { dot: '#22c55e', badgeBg: '#14532d', badgeText: '#4ade80' },
  medium: { dot: '#f59e0b', badgeBg: '#713f12', badgeText: '#fbbf24' },
  high:   { dot: '#ef4444', badgeBg: '#7f1d1d', badgeText: '#f87171' },
}

function bridgeRow(row, y) {
  const l = LEVEL[row.level]
  return `
    <g transform="translate(0, ${y})">
      <circle cx="12" cy="26" r="8" fill="${l.dot}"/>
      <text x="32" y="34" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="600" fill="#f1f5f9">${row.name}</text>
      <rect x="320" y="4" width="100" height="48" rx="24" fill="${l.badgeBg}"/>
      <text x="370" y="36" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="800" fill="${l.badgeText}" text-anchor="middle">${row.wait}m</text>
    </g>
  `
}

function featurePill(x, y, dotColor, label) {
  const w = 300
  return `
    <g transform="translate(${x}, ${y})">
      <rect width="${w}" height="62" rx="31" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
      <circle cx="32" cy="31" r="9" fill="${dotColor}"/>
      <text x="54" y="40" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="600" fill="#e2e8f0">${label}</text>
    </g>
  `
}

const coverSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${COVER_W}" height="${COVER_H}" viewBox="0 0 ${COVER_W} ${COVER_H}"
     xmlns="http://www.w3.org/2000/svg">

  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#080d1a"/>
    </linearGradient>
    <radialGradient id="glow" cx="30%" cy="30%" r="80%">
      <stop offset="0%"  stop-color="#2563eb" stop-opacity="0.20"/>
      <stop offset="60%" stop-color="#0f172a" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${COVER_W}" height="${COVER_H}" fill="url(#bg)"/>
  <rect width="${COVER_W}" height="${COVER_H}" fill="url(#glow)"/>

  <!-- ═══════ LEFT SIDE ═══════ -->

  <!-- Logo icon @ 1.4× (140×140) with rounded navy square -->
  <g transform="translate(72, 68) scale(1.4)">
    <rect width="100" height="100" rx="22" fill="#0f172a" stroke="rgba(255,255,255,0.12)" stroke-width="0.7"/>
    ${LOGO_MARK_INNER}
  </g>

  <!-- Wordmark -->
  <text x="240" y="186"
        font-family="Arial Black, Arial, Helvetica, sans-serif"
        font-size="148" font-weight="900" fill="#ffffff"
        letter-spacing="-5">cruzar</text>

  <!-- EN VIVO pulse badge -->
  <g transform="translate(840, 102)">
    <rect width="178" height="54" rx="27" fill="#16a34a"/>
    <circle cx="26" cy="27" r="8" fill="#ffffff"/>
    <circle cx="26" cy="27" r="14" fill="#ffffff" fill-opacity="0.25"/>
    <text x="46" y="36"
          font-family="Arial, Helvetica, sans-serif"
          font-size="22" font-weight="800" fill="#ffffff"
          letter-spacing="2">EN VIVO</text>
  </g>

  <!-- Primary tagline (Spanish) -->
  <text x="72" y="298"
        font-family="Arial, Helvetica, sans-serif"
        font-size="52" font-weight="800" fill="#f1f5f9"
        letter-spacing="-1.5">Tiempos de espera en vivo de la frontera</text>

  <!-- Secondary tagline (English) -->
  <text x="72" y="342"
        font-family="Arial, Helvetica, sans-serif"
        font-size="28" font-weight="500" fill="#94a3b8">
    Live US–Mexico border wait times · 53 puentes · Actualizado cada 15 min
  </text>

  <!-- Feature pills row -->
  ${featurePill(72,  390, '#22c55e', 'Todos los puentes')}
  ${featurePill(392, 390, '#f59e0b', 'Reportes en vivo')}
  ${featurePill(712, 390, '#3b82f6', 'Alertas al bajar')}

  <!-- Cities row -->
  <text x="72" y="510"
        font-family="Arial, Helvetica, sans-serif"
        font-size="28" font-weight="500" fill="#64748b">
    McAllen  ·  Brownsville  ·  Laredo  ·  El Paso  ·  Eagle Pass  ·  Del Rio
  </text>

  <!-- Wait level legend + cruzar.app -->
  <g transform="translate(72, 548)">
    <circle cx="10" cy="22" r="8" fill="#22c55e"/>
    <text x="28" y="30" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="600" fill="#94a3b8">Rápido</text>
    <circle cx="148" cy="22" r="8" fill="#f59e0b"/>
    <text x="166" y="30" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="600" fill="#94a3b8">Moderado</text>
    <circle cx="312" cy="22" r="8" fill="#ef4444"/>
    <text x="330" y="30" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="600" fill="#94a3b8">Lento</text>
  </g>

  <text x="1568" y="582"
        font-family="Arial, Helvetica, sans-serif"
        font-size="34" font-weight="800" fill="#e2e8f0"
        text-anchor="end" letter-spacing="-0.5">cruzar.app</text>

  <!-- ═══════ RIGHT SIDE — live preview panel ═══════ -->

  <g transform="translate(1080, 72)">
    <rect width="488" height="440" rx="26"
          fill="rgba(255,255,255,0.05)"
          stroke="rgba(255,255,255,0.14)" stroke-width="2"/>

    <!-- Panel header -->
    <text x="28" y="46"
          font-family="Arial, Helvetica, sans-serif"
          font-size="20" font-weight="700" fill="#64748b"
          letter-spacing="2.5">AHORITA EN LA FRONTERA</text>
    <line x1="28" y1="64" x2="460" y2="64" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>

    <!-- Bridge rows -->
    <g transform="translate(30, 84)">
      ${bridgeRow(bridgeRows[0],   0)}
      ${bridgeRow(bridgeRows[1],  64)}
      ${bridgeRow(bridgeRows[2], 128)}
      ${bridgeRow(bridgeRows[3], 192)}
      ${bridgeRow(bridgeRows[4], 256)}
    </g>

    <!-- Panel footer -->
    <text x="244" y="420"
          font-family="Arial, Helvetica, sans-serif"
          font-size="18" font-weight="500" fill="#64748b"
          text-anchor="middle">+ 48 puentes más en cruzar.app</text>
  </g>
</svg>`

// ─────────────────────────────────────────────────────────────
// Rasterize
// ─────────────────────────────────────────────────────────────
async function render(svg, outPath, w, h) {
  await sharp(Buffer.from(svg), { density: 300 })
    .resize(w, h)
    .png({ compressionLevel: 9 })
    .toFile(outPath)
  console.log(`  → ${path.relative(root, outPath)}  (${w}×${h})`)
}

console.log('Generating Facebook brand assets...')
await render(avatarSvg, path.join(root, 'public/fb-avatar.png'), AVATAR_W, AVATAR_H)
await render(coverSvg,  path.join(root, 'public/fb-cover.png'),  COVER_W,  COVER_H)
console.log('Done. Open public/fb-avatar.png and public/fb-cover.png to preview.')
