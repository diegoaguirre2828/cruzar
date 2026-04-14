import sharp from 'sharp';
import { writeFileSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Regenerates public/icons/icon-{192,512}.png from the SAME arch
// bridge geometry used by public/logo-icon.svg — the locked brand
// mark (navy rounded square, single curved arch over a deck with 7
// graduated pillars). Previously this script rendered a different
// GOLDEN GATE / suspension bridge design, so the PWA icon drifted
// out of sync with the in-app header, FB assets, OG image, etc.
// Run: node scripts/gen-icon.mjs

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Pull the canonical logo SVG straight from public/ so this script
// and the in-app <img src="/logo-icon.svg" /> can never disagree.
const logoSvg = readFileSync(path.join(root, 'public/logo-icon.svg'), 'utf8');

await sharp(Buffer.from(logoSvg), { density: 300 })
  .resize(512, 512)
  .png({ compressionLevel: 9 })
  .toFile(path.join(root, 'public/icons/icon-512.png'));

await sharp(Buffer.from(logoSvg), { density: 300 })
  .resize(192, 192)
  .png({ compressionLevel: 9 })
  .toFile(path.join(root, 'public/icons/icon-192.png'));

// Keep public/icons/icon.svg in lockstep too
writeFileSync(path.join(root, 'public/icons/icon.svg'), logoSvg);

console.log('PWA icons regenerated from public/logo-icon.svg');
