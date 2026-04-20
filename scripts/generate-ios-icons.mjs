// Generate the full iOS icon set from public/logo-icon.svg.
// Run with: node scripts/generate-ios-icons.mjs
// Outputs to public/icons/ios/*.png
import sharp from 'sharp'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(__dirname, '..', 'public', 'logo-icon.svg')
const OUT_DIR = resolve(__dirname, '..', 'public', 'icons', 'ios')

// Apple icon sizes (px). Covers App Store + iPhone + iPad + Spotlight
// + Settings + Notification @1/2/3x. Xcode asset catalogs map these
// by pt + scale; we emit raw PNGs and let the Capacitor iOS project
// reference them via AppIcon.appiconset/Contents.json.
const SIZES = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024]

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const svg = await readFile(SRC)
  for (const size of SIZES) {
    const out = resolve(OUT_DIR, `icon-${size}.png`)
    await sharp(svg, { density: 512 })
      .resize(size, size, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
      .flatten({ background: { r: 15, g: 23, b: 42 } })
      .png({ compressionLevel: 9 })
      .toFile(out)
    console.log(`✓ ${size}×${size} → ${out}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
