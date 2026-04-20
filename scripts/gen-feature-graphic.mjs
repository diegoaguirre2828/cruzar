#!/usr/bin/env node
// Play Store feature graphic: 1024×500, dark navy bg, icon + wordmark + legend.
// Output: public/feature-graphic-1024x500.png

import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'

const W = 1024, H = 500
const BG = '#0f172a'
const iconBuf = readFileSync('public/icons/icon-512.png')

// Compose the text + legend as SVG overlay (crisp vector text + circles)
const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .title { font-family: -apple-system, 'Segoe UI', Helvetica, sans-serif; font-weight: 900; fill: white; }
    .sub   { font-family: -apple-system, 'Segoe UI', Helvetica, sans-serif; font-weight: 500; fill: rgba(255,255,255,0.72); }
    .badge { font-family: -apple-system, 'Segoe UI', Helvetica, sans-serif; font-weight: 700; fill: rgba(255,255,255,0.55); letter-spacing: 3px; }
  </style>

  <text x="380" y="175" class="title" font-size="115">CRUZAR</text>
  <text x="382" y="240" class="sub"   font-size="30">Tiempos de espera en vivo</text>
  <text x="382" y="278" class="sub"   font-size="30">Live US–Mexico border wait times</text>

  <!-- wait-time legend dots -->
  <circle cx="395" cy="355" r="13" fill="#22c55e"/>
  <text x="415" y="363" class="badge" font-size="22">RAPIDO</text>

  <circle cx="575" cy="355" r="13" fill="#f59e0b"/>
  <text x="595" y="363" class="badge" font-size="22">MODERADO</text>

  <circle cx="795" cy="355" r="13" fill="#ef4444"/>
  <text x="815" y="363" class="badge" font-size="22">LENTO</text>

  <!-- URL -->
  <text x="380" y="440" class="sub" font-size="26" font-weight="700" fill="#22c55e">cruzar.app</text>
</svg>
`

// Compose: dark bg → icon @ left (centered vertically) → text/legend SVG overlay
const iconResized = await sharp(iconBuf).resize(300, 300).toBuffer()

await sharp({
  create: { width: W, height: H, channels: 4, background: BG },
})
  .composite([
    { input: iconResized, top: 100, left: 50 },
    { input: Buffer.from(svg), top: 0, left: 0 },
  ])
  .png()
  .toFile('public/feature-graphic-1024x500.png')

console.log('✓ public/feature-graphic-1024x500.png ready (' + W + '×' + H + ', Play Store feature graphic)')
