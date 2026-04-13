import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const W = 1080;
const H = 1920;

function escape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─────────────────────────────────────────────────────────────
// Shared chrome — header gradient bg + footer
// ─────────────────────────────────────────────────────────────
function bgDefs() {
  return `
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1a2744"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>`;
}

// Footer: cruzar.app + soft community report nudge
function footer() {
  return `
  <line x1="60" y1="${H - 240}" x2="${W - 60}" y2="${H - 240}" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>

  <text x="${W/2}" y="${H - 170}" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="900" fill="#ffffff" text-anchor="middle">cruzar.app</text>
  <text x="${W/2}" y="${H - 122}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="500" fill="rgba(255,255,255,0.55)" text-anchor="middle">Tiempos en vivo de TODOS los puentes</text>

  <text x="${W/2}" y="${H - 70}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500" fill="rgba(34,197,94,0.85)" text-anchor="middle">🙌 Cuando cruces, comparte tu tiempo en la app</text>
  <text x="${W/2}" y="${H - 40}" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="500" fill="rgba(255,255,255,0.40)" text-anchor="middle">Así nos ayudamos todos en el valle</text>`;
}

// ─────────────────────────────────────────────────────────────
// Template: bridge guide (tier list)
// ─────────────────────────────────────────────────────────────
function templateGuide() {
  const bridges = [
    { name: 'Anzaldúas',            sub: 'McAllen / Reynosa',       tag: 'EL SECRETO',          tagColor: '#22c55e', note: 'Casi siempre el más rápido del valle. Úsalo si Hidalgo está lleno.' },
    { name: 'Pharr · Reynosa',      sub: 'McAllen',                 tag: 'COMERCIAL',           tagColor: '#f59e0b', note: 'Bueno temprano. Evita de 2pm a 5pm cuando entra el comercial.' },
    { name: 'Hidalgo · McAllen',    sub: 'McAllen',                 tag: 'EL POPULAR',          tagColor: '#f59e0b', note: 'El más usado. Rápido si tienes SENTRI, lento en horas pico.' },
    { name: 'Progreso',             sub: 'Weslaco / N. Progreso',   tag: 'PARA EVITAR EL PLEITO', tagColor: '#22c55e', note: 'Lejos de McAllen pero casi siempre vacío. Vale la vuelta.' },
    { name: 'Donna',                sub: 'Donna / Río Bravo',       tag: 'EL CHIQUITO',         tagColor: '#22c55e', note: 'Pequeño y rápido. Pocas filas. Bueno para los del centro del valle.' },
    { name: 'Gateway · Brownsville',sub: 'Brownsville / Matamoros', tag: 'EL DE BROWNSVILLE',   tagColor: '#f59e0b', note: 'El principal de Brownsville. Pico fuerte en mañanas y tardes.' },
    { name: 'Veterans · Brownsville',sub: 'Brownsville',            tag: 'LA ALTERNATIVA',      tagColor: '#22c55e', note: 'Si Gateway está lleno, este suele estar 30-60 min más rápido.' },
  ];

  const cardStartY = 360;
  const cardHeight = 180;
  const cardGap = 14;

  const cards = bridges.map((b, i) => {
    const y = cardStartY + i * (cardHeight + cardGap);
    return `
    <g transform="translate(60, ${y})">
      <rect width="960" height="${cardHeight}" rx="22" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.10)" stroke-width="1.5"/>
      <rect width="10" height="${cardHeight}" rx="3" fill="${b.tagColor}"/>
      <text x="40" y="48" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="900" fill="#ffffff">${escape(b.name)}</text>
      <text x="40" y="78" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500" fill="rgba(255,255,255,0.5)">${escape(b.sub)}</text>
      <rect x="40" y="96" width="${b.tag.length * 14 + 28}" height="34" rx="17" fill="${b.tagColor}" opacity="0.18"/>
      <text x="${40 + 14}" y="120" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="800" fill="${b.tagColor}" letter-spacing="1">${escape(b.tag)}</text>
      <text x="40" y="160" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500" fill="rgba(255,255,255,0.78)">${escape(b.note)}</text>
    </g>`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bgDefs()}

    <text x="${W/2}" y="130" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700" fill="rgba(255,255,255,0.45)" text-anchor="middle" letter-spacing="6">CRUZAR · GUÍA RGV</text>
    <text x="${W/2}" y="220" font-family="Arial, Helvetica, sans-serif" font-size="78" font-weight="900" fill="#ffffff" text-anchor="middle">¿CUÁL PUENTE</text>
    <text x="${W/2}" y="300" font-family="Arial, Helvetica, sans-serif" font-size="78" font-weight="900" fill="#22c55e" text-anchor="middle">USAR HOY?</text>

    ${cards}
    ${footer()}
  </svg>`;
}

// ─────────────────────────────────────────────────────────────
// Template: 5 mistakes that waste your time
// ─────────────────────────────────────────────────────────────
function templateMistakes() {
  const items = [
    { num: '1', title: 'Cruzar entre 2 y 5 PM',         note: 'Es la hora pico de regreso. Espera hasta después de las 6 si puedes.' },
    { num: '2', title: 'Solo confiar en un puente',     note: 'Si Hidalgo está lleno, Anzaldúas suele estar 40 min más rápido.' },
    { num: '3', title: 'Olvidar tener placa al frente', note: 'CBP te puede regresar a la fila. Pónsela antes de llegar al puente.' },
    { num: '4', title: 'No checar antes de salir',      note: 'En 10 segundos puedes ver los tiempos en vivo y elegir el mejor.' },
    { num: '5', title: 'Ir un viernes en la tarde',     note: 'El peor combo de la semana. Si tienes que ir, sal antes de mediodía.' },
  ];

  const cardStartY = 380;
  const cardHeight = 200;
  const cardGap = 18;

  const cards = items.map((it, i) => {
    const y = cardStartY + i * (cardHeight + cardGap);
    return `
    <g transform="translate(60, ${y})">
      <rect width="960" height="${cardHeight}" rx="24" fill="rgba(239,68,68,0.06)" stroke="rgba(239,68,68,0.25)" stroke-width="2"/>
      <circle cx="80" cy="${cardHeight/2}" r="46" fill="#ef4444"/>
      <text x="80" y="${cardHeight/2 + 22}" font-family="Arial, Helvetica, sans-serif" font-size="60" font-weight="900" fill="#ffffff" text-anchor="middle">${it.num}</text>
      <text x="160" y="76" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="900" fill="#ffffff">${escape(it.title)}</text>
      <text x="160" y="130" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="500" fill="rgba(255,255,255,0.72)">${escape(it.note)}</text>
    </g>`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bgDefs()}

    <text x="${W/2}" y="130" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700" fill="rgba(255,255,255,0.45)" text-anchor="middle" letter-spacing="6">CRUZAR · TIPS</text>
    <text x="${W/2}" y="220" font-family="Arial, Helvetica, sans-serif" font-size="74" font-weight="900" fill="#ffffff" text-anchor="middle">5 ERRORES</text>
    <text x="${W/2}" y="300" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="700" fill="#ef4444" text-anchor="middle">que te quitan HORAS en la frontera</text>

    ${cards}
    ${footer()}
  </svg>`;
}

// ─────────────────────────────────────────────────────────────
// Template: best & worst hours by day
// ─────────────────────────────────────────────────────────────
function templateHours() {
  const days = [
    { day: 'LUN', best: '5–7am',  worst: '12–2pm',  bestColor: '#22c55e', worstColor: '#ef4444' },
    { day: 'MAR', best: '5–7am',  worst: '11am–1pm', bestColor: '#22c55e', worstColor: '#f59e0b' },
    { day: 'MIÉ', best: '5–7am',  worst: '12–2pm',  bestColor: '#22c55e', worstColor: '#f59e0b' },
    { day: 'JUE', best: '5–8am',  worst: '1–3pm',   bestColor: '#22c55e', worstColor: '#ef4444' },
    { day: 'VIE', best: 'Antes 7am', worst: '11am–6pm', bestColor: '#f59e0b', worstColor: '#ef4444' },
    { day: 'SÁB', best: '6–9am',  worst: '11am–4pm', bestColor: '#22c55e', worstColor: '#ef4444' },
    { day: 'DOM', best: '6–10am', worst: '3–8pm',   bestColor: '#22c55e', worstColor: '#ef4444' },
  ];

  const rowStartY = 400;
  const rowHeight = 150;
  const rowGap = 12;

  const rows = days.map((d, i) => {
    const y = rowStartY + i * (rowHeight + rowGap);
    return `
    <g transform="translate(60, ${y})">
      <rect width="960" height="${rowHeight}" rx="20" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.10)" stroke-width="1.5"/>

      <text x="50" y="92" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="900" fill="#ffffff">${d.day}</text>

      <g transform="translate(220, 28)">
        <text x="0" y="28" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="800" fill="${d.bestColor}" letter-spacing="1">MEJOR</text>
        <text x="0" y="78" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="900" fill="#ffffff">${escape(d.best)}</text>
      </g>

      <g transform="translate(580, 28)">
        <text x="0" y="28" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="800" fill="${d.worstColor}" letter-spacing="1">EVITAR</text>
        <text x="0" y="78" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="900" fill="#ffffff">${escape(d.worst)}</text>
      </g>
    </g>`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bgDefs()}

    <text x="${W/2}" y="130" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700" fill="rgba(255,255,255,0.45)" text-anchor="middle" letter-spacing="6">CRUZAR · HORARIOS</text>
    <text x="${W/2}" y="220" font-family="Arial, Helvetica, sans-serif" font-size="74" font-weight="900" fill="#ffffff" text-anchor="middle">MEJORES HORAS</text>
    <text x="${W/2}" y="300" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="700" fill="#22c55e" text-anchor="middle">para cruzar — por día</text>
    <text x="${W/2}" y="350" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500" fill="rgba(255,255,255,0.45)" text-anchor="middle">basado en los patrones del valle</text>

    ${rows}
    ${footer()}
  </svg>`;
}

// ─────────────────────────────────────────────────────────────
// Template: SENTRI explainer
// ─────────────────────────────────────────────────────────────
function templateSentri() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bgDefs()}

    <text x="${W/2}" y="130" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700" fill="rgba(255,255,255,0.45)" text-anchor="middle" letter-spacing="6">CRUZAR · SENTRI</text>
    <text x="${W/2}" y="230" font-family="Arial, Helvetica, sans-serif" font-size="78" font-weight="900" fill="#ffffff" text-anchor="middle">¿VALE LA PENA</text>
    <text x="${W/2}" y="310" font-family="Arial, Helvetica, sans-serif" font-size="78" font-weight="900" fill="#22c55e" text-anchor="middle">SENTRI?</text>

    <!-- Comparison block -->
    <g transform="translate(60, 420)">
      <!-- Regular -->
      <rect width="960" height="240" rx="24" fill="rgba(239,68,68,0.06)" stroke="rgba(239,68,68,0.30)" stroke-width="2"/>
      <text x="40" y="60" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800" fill="#ef4444" letter-spacing="2">SIN SENTRI</text>
      <text x="40" y="130" font-family="Arial, Helvetica, sans-serif" font-size="86" font-weight="900" fill="#ffffff">45–120 min</text>
      <text x="40" y="180" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="500" fill="rgba(255,255,255,0.72)">Promedio en horas pico (Lun-Vie)</text>
      <text x="40" y="215" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="500" fill="rgba(255,255,255,0.50)">Aún más en viernes y domingo</text>
    </g>

    <g transform="translate(60, 700)">
      <!-- SENTRI -->
      <rect width="960" height="240" rx="24" fill="rgba(34,197,94,0.06)" stroke="rgba(34,197,94,0.35)" stroke-width="2"/>
      <text x="40" y="60" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800" fill="#22c55e" letter-spacing="2">CON SENTRI</text>
      <text x="40" y="130" font-family="Arial, Helvetica, sans-serif" font-size="86" font-weight="900" fill="#ffffff">5–15 min</text>
      <text x="40" y="180" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="500" fill="rgba(255,255,255,0.72)">Carril dedicado, casi siempre vacío</text>
      <text x="40" y="215" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="500" fill="rgba(255,255,255,0.50)">Te ahorra ~1.5 horas en cada cruce</text>
    </g>

    <!-- Cost breakdown -->
    <g transform="translate(60, 1000)">
      <rect width="960" height="320" rx="24" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
      <text x="40" y="60" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800" fill="rgba(255,255,255,0.55)" letter-spacing="2">EL COSTO REAL</text>

      <text x="40" y="120" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="600" fill="#ffffff">💵  $122.25 cada 5 años</text>
      <text x="40" y="160" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500" fill="rgba(255,255,255,0.55)">≈ $24 al año · $2 al mes</text>

      <text x="40" y="220" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="600" fill="#ffffff">📋  Cita en consulado + huellas</text>
      <text x="40" y="260" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500" fill="rgba(255,255,255,0.55)">Tarda 2-4 meses en aprobarse</text>

      <text x="40" y="305" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#22c55e">→ Si cruzas ≥2 veces por semana, se paga sola</text>
    </g>

    ${footer()}
  </svg>`;
}

// ─────────────────────────────────────────────────────────────
// CLI dispatcher
// ─────────────────────────────────────────────────────────────
const TEMPLATES = {
  guide:    { name: 'guide',    render: templateGuide },
  mistakes: { name: 'mistakes', render: templateMistakes },
  hours:    { name: 'hours',    render: templateHours },
  sentri:   { name: 'sentri',   render: templateSentri },
};

const arg = process.argv[2] || 'all';
const targets = arg === 'all' ? Object.keys(TEMPLATES) : [arg];

const outDir = path.join(root, 'video-generator', 'output');
await mkdir(outDir, { recursive: true });

const date = new Date().toISOString().split('T')[0];
const time = new Date().toTimeString().slice(0, 5).replace(':', '-');

for (const key of targets) {
  const tmpl = TEMPLATES[key];
  if (!tmpl) {
    console.error(`Unknown template: ${key}. Options: ${Object.keys(TEMPLATES).join(', ')}, all`);
    process.exit(1);
  }
  const svg = tmpl.render();
  const outPath = path.join(outDir, `cruzar-${tmpl.name}-${date}-${time}.png`);
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log('Saved:', outPath);
}
