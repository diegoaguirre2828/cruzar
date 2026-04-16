import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
config();

// Usage:
//   node render.mjs                            → WaitTimes, 9:16 (default)
//   node render.mjs WaitTimes                  → WaitTimes, 9:16
//   node render.mjs HookFbGroup 9x16 1x1 4x5   → HookFbGroup, 3 aspect ratios
//   node render.mjs all                        → all compositions, default aspect
//   node render.mjs ads 9x16 1x1               → all ad compositions, 2 aspects
//
// Env vars:
//   UPLOAD_BLOB=1                 → upload each output to Vercel Blob + POST /api/video/latest
//   BLOB_READ_WRITE_TOKEN         → Vercel Blob auth
//   CRUZAR_API_URL=https://...    → the endpoint to notify (defaults to production)
//   CRUZAR_API_KEY=...            → CRON_SECRET for /api/video/latest
//
// Output:
//   video-generator/output/<compositionId>-<aspect>-<date>-<time>.mp4

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ASPECT_RATIOS = {
  '9x16': { width: 1080, height: 1920, label: '9x16' },  // Reels, Stories, TikTok
  '1x1':  { width: 1080, height: 1080, label: '1x1' },   // Feed square
  '4x5':  { width: 1080, height: 1350, label: '4x5' },   // Feed mobile
  '16x9': { width: 1920, height: 1080, label: '16x9' },  // YouTube, landscape
};

const ORGANIC_COMPOSITIONS = ['WaitTimes'];
const AD_COMPOSITIONS = ['HookFbGroup', 'AlertDemo', 'SocialProof153'];
const ALL_COMPOSITIONS = [...ORGANIC_COMPOSITIONS, ...AD_COMPOSITIONS];

// Featured crossings for the daily organic video
const FEATURED = [
  { portId: '230501', name: 'Hidalgo · McAllen'     },
  { portId: '230502', name: 'Pharr · Reynosa'       },
  { portId: '230503', name: 'Anzaldúas'             },
  { portId: '535501', name: 'Gateway · Brownsville' },
  { portId: '535502', name: 'Veterans · Brownsville'},
  { portId: '230401', name: 'Laredo I'              },
];

function getLevel(wait) {
  if (wait === null || wait === undefined) return 'unknown';
  if (wait <= 20) return 'low';
  if (wait <= 45) return 'medium';
  return 'high';
}

async function fetchLiveProps(compositionId) {
  // Each composition needs its own input props. Fetch live data from
  // the production API so the video is always current.
  const apiBase = process.env.CRUZAR_API_URL || 'https://cruzar.app';

  if (compositionId === 'WaitTimes') {
    const [portsRes, statsRes] = await Promise.all([
      fetch(`${apiBase}/api/ports`).then((r) => r.json()).catch(() => ({ ports: [] })),
      fetch(`${apiBase}/api/stats/community`).then((r) => r.json()).catch(() => null),
    ]);
    const ports = portsRes.ports || [];
    const crossings = FEATURED.map(({ portId, name }) => {
      const port = ports.find((p) => p.portId === portId);
      const wait = port?.vehicle ?? null;
      const lanesOpen = port?.vehicleLanesOpen ?? null;
      return {
        portId,
        name,
        wait: wait ?? 0,
        level: getLevel(wait),
        lanesOpen,
      };
    });
    return {
      crossings,
      totalUsers: statsRes?.totalUsers ?? 153,
      promoRemaining: statsRes?.promoRemaining ?? 847,
      reportsLast24h: statsRes?.reportsLast24h ?? 16,
    };
  }

  if (compositionId === 'HookFbGroup') {
    const portsRes = await fetch(`${apiBase}/api/ports`).then((r) => r.json()).catch(() => ({ ports: [] }));
    const ports = portsRes.ports || [];
    // Pick the fastest RGV bridge right now for the "solution" scene
    const rgvIds = ['230501', '230502', '230503', '535501', '535502'];
    const fastest = rgvIds
      .map((id) => ports.find((p) => p.portId === id))
      .filter((p) => p && p.vehicle != null && p.vehicle >= 0)
      .sort((a, b) => a.vehicle - b.vehicle)[0];
    return {
      currentPortName: fastest
        ? (FEATURED.find((f) => f.portId === fastest.portId)?.name || fastest.portName)
        : 'Hidalgo · McAllen',
      currentWait: fastest?.vehicle ?? 18,
    };
  }

  if (compositionId === 'SocialProof153') {
    const statsRes = await fetch(`${apiBase}/api/stats/community`).then((r) => r.json()).catch(() => null);
    return {
      totalUsers: statsRes?.totalUsers ?? 153,
      reportsLast7d: statsRes?.reportsLast7d ?? 16,
      promoRemaining: statsRes?.promoRemaining ?? 847,
    };
  }

  if (compositionId === 'AlertDemo') {
    return {};
  }

  return {};
}

async function renderOne(bundleUrl, compositionId, aspect) {
  const { width, height, label } = ASPECT_RATIOS[aspect];
  const inputProps = await fetchLiveProps(compositionId);

  console.log(`\n🎬 Rendering ${compositionId} @ ${label} (${width}x${height})...`);

  const composition = await selectComposition({
    serveUrl: bundleUrl,
    id: compositionId,
    inputProps,
  });

  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toTimeString().slice(0, 5).replace(':', '-');
  const outputName = `${compositionId}-${label}-${date}-${time}.mp4`;
  const outputPath = path.join(__dirname, 'output', outputName);

  await renderMedia({
    composition: { ...composition, width, height },
    serveUrl: bundleUrl,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    imageFormat: 'jpeg',
    jpegQuality: 90,
    crf: 18,
    onProgress: ({ progress }) => {
      process.stdout.write(`\r   ${Math.round(progress * 100)}% `);
    },
  });

  console.log(` ✓`);
  return { outputPath, outputName, compositionId, aspect: label };
}

async function maybeUpload(results) {
  if (process.env.UPLOAD_BLOB !== '1') {
    console.log('\n(skipping upload — set UPLOAD_BLOB=1 to upload to Vercel Blob)');
    return;
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    console.error('❌ UPLOAD_BLOB=1 but BLOB_READ_WRITE_TOKEN not set');
    return;
  }

  const { put } = await import('@vercel/blob').catch(() => ({ put: null }));
  if (!put) {
    console.error('❌ @vercel/blob not installed in video-generator. Run: npm i @vercel/blob');
    return;
  }

  const { readFile } = await import('fs/promises');
  const apiBase = process.env.CRUZAR_API_URL || 'https://cruzar.app';
  const apiKey = process.env.CRUZAR_API_KEY;

  const uploaded = [];
  for (const r of results) {
    const data = await readFile(r.outputPath);
    const blob = await put(`videos/${r.outputName}`, data, {
      token: blobToken,
      contentType: 'video/mp4',
    });
    console.log(`☁️  Uploaded ${r.outputName} → ${blob.url}`);
    uploaded.push({ ...r, url: blob.url });
  }

  if (apiKey) {
    const notifyRes = await fetch(`${apiBase}/api/video/latest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ videos: uploaded, generatedAt: new Date().toISOString() }),
    });
    if (notifyRes.ok) {
      console.log(`📡 Notified ${apiBase}/api/video/latest`);
    } else {
      console.error(`❌ Failed to notify: ${notifyRes.status}`);
    }
  }
}

async function buildCaption(compositionId) {
  // Emitted alongside each render as a .txt file for Make.com to pick up.
  // Generated from live data so captions stay fresh.
  const apiBase = process.env.CRUZAR_API_URL || 'https://cruzar.app';

  if (compositionId !== 'WaitTimes') return null;

  const portsRes = await fetch(`${apiBase}/api/ports`).then((r) => r.json()).catch(() => ({ ports: [] }));
  const ports = portsRes.ports || [];
  const active = FEATURED
    .map(({ portId, name }) => {
      const p = ports.find((x) => x.portId === portId);
      return { name, wait: p?.vehicle ?? null, level: getLevel(p?.vehicle) };
    })
    .filter((c) => c.wait != null && c.wait > 0);

  const emoji = (level) => ({ low: '🟢', medium: '🟡', high: '🔴', unknown: '⚪' }[level] || '⚪');
  const lines = active.map((c) => `${emoji(c.level)} ${c.name}: ${c.wait} min`).join('\n');
  const fastest = active.find((c) => c.level === 'low');

  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago',
  });

  return `🌉 TIEMPOS EN LOS PUENTES — ${timeStr.toUpperCase()}

${lines}

${fastest ? `✅ Más rápido: ${fastest.name}` : ''}

Ve todos los puentes en vivo 👇
📱 cruzar.app

Gratis · En vivo · Sin grupos
🎁 Primeros 1,000 se llevan 3 meses de Pro gratis

#cruzar #frontera #tiemposdeespera #RGV #Brownsville #McAllen #Laredo #puente`;
}

async function main() {
  const args = process.argv.slice(2);

  // Resolve target list and aspect list from CLI args
  let targets = ['WaitTimes'];
  let aspects = ['9x16'];

  if (args.length > 0) {
    const first = args[0];
    if (first === 'all') targets = ALL_COMPOSITIONS;
    else if (first === 'ads') targets = AD_COMPOSITIONS;
    else if (first === 'organic') targets = ORGANIC_COMPOSITIONS;
    else if (ALL_COMPOSITIONS.includes(first)) targets = [first];
    else {
      console.error(`❌ Unknown composition: ${first}`);
      console.error(`   Valid: ${ALL_COMPOSITIONS.join(', ')}, all, ads, organic`);
      process.exit(1);
    }

    const aspectArgs = args.slice(1).filter((a) => ASPECT_RATIOS[a]);
    if (aspectArgs.length > 0) aspects = aspectArgs;
  }

  console.log(`🎯 Targets: ${targets.join(', ')}`);
  console.log(`📐 Aspects: ${aspects.join(', ')}`);

  await mkdir(path.join(__dirname, 'output'), { recursive: true });

  console.log('\n📦 Bundling...');
  const bundleUrl = await bundle({
    entryPoint: path.join(__dirname, 'src', 'index.ts'),
    webpackOverride: (c) => c,
  });

  const results = [];
  for (const compositionId of targets) {
    for (const aspect of aspects) {
      try {
        const r = await renderOne(bundleUrl, compositionId, aspect);
        results.push(r);
      } catch (err) {
        console.error(`\n❌ ${compositionId} @ ${aspect} failed: ${err.message}`);
      }
    }

    // Emit caption file alongside the organic video for Make.com
    if (compositionId === 'WaitTimes') {
      const caption = await buildCaption(compositionId);
      if (caption) {
        const date = new Date().toISOString().split('T')[0];
        const time = new Date().toTimeString().slice(0, 5).replace(':', '-');
        const captionPath = path.join(__dirname, 'output', `${compositionId}-${date}-${time}.txt`);
        await writeFile(captionPath, caption, 'utf8');
        console.log(`📝 Caption saved to ${captionPath}`);
      }
    }
  }

  await maybeUpload(results);

  console.log(`\n✅ Done — ${results.length} render(s)`);
  results.forEach((r) => console.log(`   ${r.outputPath}`));
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
