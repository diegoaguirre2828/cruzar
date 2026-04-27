#!/usr/bin/env node

// Resize master screenshots (1290×2796, iPhone 6.7") to the two sizes
// App Store Connect actually slots on upload:
//   6.9" (iPhone 16 Pro Max) — 1320×2868 — the current required size
//   6.5" (iPhone 11 Pro Max) — 1284×2778 — still slotted on some records
//
// Apple rejects uploads that are off-by-pixel, so we generate both.
// The 6.7" masters stay in ios/screenshots/ as the source of truth
// (regenerating from cruzar.app via Playwright uses that dir).

import sharp from 'sharp'
import { mkdir, readdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SRC = resolve(ROOT, 'ios/screenshots')
const OUT_69 = resolve(ROOT, 'ios/screenshots-6_9')
const OUT_65 = resolve(ROOT, 'ios/screenshots-6_5')

const TARGETS = [
  { dir: OUT_69, label: '6.9', w: 1320, h: 2868 },
  { dir: OUT_65, label: '6.5', w: 1284, h: 2778 },
]

async function main() {
  const files = (await readdir(SRC)).filter(f => f.endsWith('.png'))
  if (!files.length) {
    console.error('No screenshots found at', SRC)
    process.exit(1)
  }

  for (const t of TARGETS) {
    await mkdir(t.dir, { recursive: true })
  }

  for (const f of files) {
    const src = resolve(SRC, f)
    for (const t of TARGETS) {
      await sharp(src)
        .resize(t.w, t.h, { fit: 'cover', kernel: 'lanczos3' })
        .png({ compressionLevel: 9 })
        .toFile(resolve(t.dir, f))
    }
    console.log(`wrote ${f}  →  6.9" and 6.5"`)
  }
  console.log(`\n6.9" (${TARGETS[0].w}×${TARGETS[0].h}): ${OUT_69}`)
  console.log(`6.5" (${TARGETS[1].w}×${TARGETS[1].h}): ${OUT_65}`)
}

main().catch(err => { console.error(err); process.exit(1) })
