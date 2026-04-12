import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FEATURED = [
  // McAllen / Hidalgo (top 2)
  { portId: '230501', name: 'Hidalgo · McAllen'     },
  { portId: '230502', name: 'Pharr · Reynosa'        },
  // Brownsville / Matamoros (top 2)
  { portId: '535501', name: 'Gateway · Brownsville'  },
  { portId: '535502', name: 'Veterans · Brownsville' },
  // Laredo / Nuevo Laredo (top 2)
  { portId: '230401', name: 'Laredo I'               },
  { portId: '230402', name: 'Laredo II'              },
  // Eagle Pass / Piedras Negras
  { portId: '230301', name: 'Eagle Pass'             },
  // El Paso / Juárez
  { portId: '240201', name: 'El Paso · Juárez'       },
];

function getLevel(wait) {
  if (wait === null || wait === undefined) return 'unknown';
  if (wait <= 20) return 'low';
  if (wait <= 45) return 'medium';
  return 'high';
}

function getLevelEmoji(level) {
  if (level === 'low') return '🟢';
  if (level === 'medium') return '🟡';
  return '🔴';
}

async function main() {
  // 1. Fetch live data
  console.log('📡 Fetching live wait times from Cruzar...');
  const res = await fetch('https://cruzar.app/api/ports');
  const { ports } = await res.json();

  const crossings = FEATURED.map(({ portId, name }) => {
    const port = ports.find((p) => p.portId === portId);
    const wait = port?.vehicle ?? null;
    return { portId, name, wait: wait ?? 0, level: getLevel(wait) };
  });

  console.log('\nCurrent waits:');
  crossings.forEach((c) => console.log(`  ${c.name}: ${c.wait} min (${c.level})`));

  // 2. Bundle and render
  await mkdir(path.join(__dirname, 'output'), { recursive: true });

  console.log('\n📦 Bundling...');
  const bundleUrl = await bundle({
    entryPoint: path.join(__dirname, 'src', 'index.ts'),
    webpackOverride: (config) => config,
  });

  const composition = await selectComposition({
    serveUrl: bundleUrl,
    id: 'WaitTimes',
    inputProps: { crossings },
  });

  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toTimeString().slice(0, 5).replace(':', '-');
  const outputPath = path.join(__dirname, 'output', `cruzar-${date}-${time}.mp4`);

  console.log('🎬 Rendering video...');
  await renderMedia({
    composition,
    serveUrl: bundleUrl,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: { crossings },
    browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    onProgress: ({ progress }) => {
      process.stdout.write(`\r   ${Math.round(progress * 100)}% complete`);
    },
  });

  // 3. Build caption
  const activeCrossings = crossings.filter(c => c.wait > 0);
  const waitLines = activeCrossings
    .map(c => `${getLevelEmoji(c.level)} ${c.name}: ${c.wait} min`)
    .join('\n');

  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago',
  });
  const dateStr = now.toLocaleDateString('es-MX', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago',
  });

  const fastest = activeCrossings.find(c => c.level === 'low');

  const caption = `🌉 TIEMPOS DE ESPERA — ${timeStr.toUpperCase()}
${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}

${waitLines}

${fastest ? `✅ Más rápido ahorita: ${fastest.name}` : ''}

Ver todos los puentes en tiempo real 👇
📱 cruzar.app

Reporta tu tiempo y ayuda a todos en la fila 🙌

#border #frontera #cruzar #espera #RGV #Brownsville #Laredo #McAllen #Hidalgo #puente #tiemposdeespera`;

  console.log('\n\n✅ Video saved to:', outputPath);
  console.log('\n━━━━━━━━━ COPIA ESTE TEXTO ━━━━━━━━━\n');
  console.log(caption);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
