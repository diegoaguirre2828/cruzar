import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Vertical post format — fills FB feed without being weirdly tall
const W = 1080;
const H = 1350;

function escape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const HEADLINE_LINE_1 = 'Para los que ya están cansados de preguntar';
const HEADLINE_LINE_2 = 'y para los que ya están cansados de responder.';

// ─────────────────────────────────────────────────────────────
// Mock app card — looks like a port detail screen in cruzar.app
// ─────────────────────────────────────────────────────────────
function mockAppCard({ portName, subName, wait, level, alt, reportUser, reportMin, reportNote }) {
  // Card box: rounded, dark, looks like the app
  // Position: centered horizontally, sits below headline
  const cardX = 90;
  const cardY = 360;
  const cardW = 900;
  const cardH = 760;

  const levelColor = level === 'high' ? '#ef4444' : level === 'medium' ? '#f59e0b' : '#22c55e';
  const levelLabel = level === 'high' ? 'Lento' : level === 'medium' ? 'Moderado' : 'Rápido';

  // The "phone frame" / app card
  return `
  <!-- Drop shadow -->
  <rect x="${cardX + 8}" y="${cardY + 12}" width="${cardW}" height="${cardH}" rx="36" fill="#000000" opacity="0.35"/>

  <!-- Card -->
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="36" fill="#0f172a" stroke="rgba(255,255,255,0.10)" stroke-width="2"/>

  <!-- Top status bar (browser chrome hint) -->
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="56" rx="36" fill="#1e293b"/>
  <rect x="${cardX}" y="${cardY + 28}" width="${cardW}" height="28" fill="#1e293b"/>
  <circle cx="${cardX + 28}" cy="${cardY + 28}" r="7" fill="#ef4444"/>
  <circle cx="${cardX + 50}" cy="${cardY + 28}" r="7" fill="#f59e0b"/>
  <circle cx="${cardX + 72}" cy="${cardY + 28}" r="7" fill="#22c55e"/>
  <text x="${cardX + cardW/2}" y="${cardY + 36}" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="500" fill="rgba(255,255,255,0.55)" text-anchor="middle">cruzar.app/port/${portName.toLowerCase().replace(/[^a-z]/g, '')}</text>

  <!-- Back link -->
  <text x="${cardX + 40}" y="${cardY + 110}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500" fill="rgba(255,255,255,0.45)">← Todos los puentes</text>

  <!-- Port title -->
  <text x="${cardX + 40}" y="${cardY + 170}" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="900" fill="#ffffff">${escape(portName)}</text>
  <text x="${cardX + 40}" y="${cardY + 205}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500" fill="rgba(255,255,255,0.45)">${escape(subName)}</text>

  <!-- Big wait time block -->
  <rect x="${cardX + 40}" y="${cardY + 240}" width="${cardW - 80}" height="200" rx="22" fill="rgba(255,255,255,0.04)" stroke="${levelColor}" stroke-width="2" stroke-opacity="0.4"/>
  <rect x="${cardX + 40}" y="${cardY + 240}" width="10" height="200" rx="3" fill="${levelColor}"/>

  <text x="${cardX + 80}" y="${cardY + 295}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="rgba(255,255,255,0.55)" letter-spacing="2">CARROS · AHORITA</text>
  <text x="${cardX + 80}" y="${cardY + 395}" font-family="Arial, Helvetica, sans-serif" font-size="120" font-weight="900" fill="${levelColor}">${wait}</text>
  <text x="${cardX + 80 + (String(wait).length * 70)}" y="${cardY + 395}" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="600" fill="rgba(255,255,255,0.55)">min</text>
  <text x="${cardX + cardW - 60}" y="${cardY + 395}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800" fill="${levelColor}" text-anchor="end">● ${levelLabel}</text>

  <!-- Alternative bridge tip (the local-knowledge moment) -->
  ${alt ? `
  <rect x="${cardX + 40}" y="${cardY + 460}" width="${cardW - 80}" height="100" rx="18" fill="rgba(34,197,94,0.08)" stroke="rgba(34,197,94,0.35)" stroke-width="2"/>
  <text x="${cardX + 60}" y="${cardY + 498}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#22c55e" letter-spacing="1">💡  ALTERNATIVA MÁS RÁPIDA</text>
  <text x="${cardX + 60}" y="${cardY + 540}" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="600" fill="#ffffff">${escape(alt.name)} · solo ${alt.wait} min ahorita →</text>
  ` : ''}

  <!-- Community report -->
  <text x="${cardX + 40}" y="${cardY + 610}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="rgba(255,255,255,0.55)" letter-spacing="2">REPORTE DE LA COMUNIDAD</text>

  <rect x="${cardX + 40}" y="${cardY + 625}" width="${cardW - 80}" height="110" rx="18" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.10)" stroke-width="1.5"/>
  <circle cx="${cardX + 80}" cy="${cardY + 680}" r="26" fill="#22c55e" opacity="0.20"/>
  <text x="${cardX + 80}" y="${cardY + 690}" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="900" fill="#22c55e" text-anchor="middle">${reportUser.charAt(0).toUpperCase()}</text>
  <text x="${cardX + 120}" y="${cardY + 668}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#ffffff">${escape(reportUser)} <tspan font-weight="500" fill="rgba(255,255,255,0.45)">· hace ${reportMin} min</tspan></text>
  <text x="${cardX + 120}" y="${cardY + 705}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500" fill="rgba(255,255,255,0.78)">"${escape(reportNote)}"</text>
  `;
}

// ─────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────
function footer() {
  return `
  <text x="${W/2}" y="${H - 130}" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="900" fill="#ffffff" text-anchor="middle">cruzar.app</text>
  <text x="${W/2}" y="${H - 90}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500" fill="rgba(255,255,255,0.55)" text-anchor="middle">Tiempos en vivo · Reportes de la comunidad · Gratis</text>

  <!-- Disclosure watermark — small but legible, prevents 'this is fake' callouts -->
  <text x="${W/2}" y="${H - 40}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="500" fill="rgba(255,255,255,0.40)" text-anchor="middle">📸 vista de la app · los números cambian en vivo</text>
  `;
}

// ─────────────────────────────────────────────────────────────
// Compose one mockup
// ─────────────────────────────────────────────────────────────
function compose({ portName, subName, wait, level, alt, reportUser, reportMin, reportNote, slug }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0a0f1e"/>
        <stop offset="100%" stop-color="#16213d"/>
      </linearGradient>
    </defs>

    <rect width="${W}" height="${H}" fill="url(#bg)"/>

    <!-- Headline -->
    <text x="${W/2}" y="160" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700" fill="#ffffff" text-anchor="middle">${escape(HEADLINE_LINE_1)}</text>
    <text x="${W/2}" y="220" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700" fill="rgba(255,255,255,0.65)" text-anchor="middle">${escape(HEADLINE_LINE_2)}</text>

    <text x="${W/2}" y="290" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="500" fill="rgba(34,197,94,0.85)" text-anchor="middle">— Cruzar · tiempos en vivo de los puentes</text>

    ${mockAppCard({ portName, subName, wait, level, alt, reportUser, reportMin, reportNote })}

    ${footer()}
  </svg>`;
  return svg;
}

// ─────────────────────────────────────────────────────────────
// Variants — one per regional FB group market
// ─────────────────────────────────────────────────────────────
const variants = [
  {
    slug: 'mcallen',
    portName: 'Hidalgo · McAllen',
    subName: 'Lerdo / Reynosa',
    wait: 75,
    level: 'high',
    alt: { name: 'Anzaldúas', wait: 12 },
    reportUser: 'Maria L.',
    reportMin: 8,
    reportNote: 'Acabo de cruzar, fila larga pero está moviéndose',
  },
  {
    slug: 'brownsville',
    portName: 'Gateway International',
    subName: 'Brownsville / Matamoros',
    wait: 55,
    level: 'high',
    alt: { name: 'Veterans International', wait: 15 },
    reportUser: 'Carlos R.',
    reportMin: 5,
    reportNote: 'Yo le di vuelta y me fui al Veterans, súper rápido',
  },
  {
    slug: 'midvalley',
    portName: 'Donna · Río Bravo',
    subName: 'Donna / Río Bravo',
    wait: 8,
    level: 'low',
    alt: { name: 'Progreso', wait: 5 },
    reportUser: 'Jaime P.',
    reportMin: 12,
    reportNote: 'Vacío, pasé sin parar. Mejor que ir hasta McAllen',
  },
];

const outDir = path.join(root, 'video-generator', 'output');
await mkdir(outDir, { recursive: true });

const date = new Date().toISOString().split('T')[0];
const time = new Date().toTimeString().slice(0, 5).replace(':', '-');

for (const v of variants) {
  const svg = compose(v);
  const outPath = path.join(outDir, `cruzar-mock-${v.slug}-${date}-${time}.png`);
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log('Saved:', outPath);
}
