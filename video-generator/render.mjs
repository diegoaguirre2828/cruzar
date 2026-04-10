import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { mkdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FEATURED = [
  { portId: '230501', name: 'Hidalgo / McAllen'    },
  { portId: '230502', name: 'Pharr–Reynosa'         },
  { portId: '230503', name: 'Anzaldúas'             },
  { portId: '230901', name: 'Progreso'              },
  { portId: '230902', name: 'Donna'                 },
  { portId: '535501', name: 'Brownsville Gateway'   },
  { portId: '535502', name: 'Brownsville Veterans'  },
  { portId: '535503', name: 'Los Tomates'           },
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

  // 4. Upload to Facebook Page
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const pageToken = process.env.FACEBOOK_PAGE_TOKEN;

  if (pageId && pageToken) {
    console.log('📤 Uploading video to Facebook Page...');
    try {
      const videoBuffer = await readFile(outputPath);
      const formData = new FormData();
      formData.append('access_token', pageToken);
      formData.append('description', caption);
      formData.append('source', new Blob([videoBuffer], { type: 'video/mp4' }), 'cruzar-waittimes.mp4');

      const fbRes = await fetch(`https://graph-video.facebook.com/v19.0/${pageId}/videos`, {
        method: 'POST',
        body: formData,
      });

      const fbData = await fbRes.json();
      if (fbData.id) {
        console.log('✅ Posted to Facebook! Video ID:', fbData.id);
      } else {
        console.error('❌ Facebook error:', JSON.stringify(fbData));
        process.exit(1);
      }
    } catch (err) {
      console.error('❌ Upload failed:', err.message);
      process.exit(1);
    }
  } else {
    console.log('ℹ️  No Facebook credentials — skipping upload (set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_TOKEN)');
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
