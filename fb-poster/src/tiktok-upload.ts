// ======================================================================
// Cruzar TikTok Auto-Uploader (Playwright-based)
// ======================================================================
//
// BEFORE YOU CAN RUN THIS:
//
// 1. CREATE A TIKTOK ACCOUNT
//    - Go to tiktok.com and sign up (use a burner email or phone, NOT
//      your personal account -- same logic as the Natividad FB alt).
//    - Username suggestion: @cruzar.app or @cruzar_puentes
//    - Bio: "Tiempos en los puentes en vivo. cruzar.app"
//    - Set language to Spanish and region to Mexico/US border area.
//
// 2. CAPTURE SESSION COOKIES
//    Run:  npm run tiktok-capture-session
//    This opens a visible Chrome window. Log in manually, then cookies
//    auto-save to tiktok-cookies.json.
//
// 3. ENVIRONMENT VARIABLES (add to .env):
//    TIKTOK_ENABLED=true
//    TIKTOK_COOKIES_PATH=./tiktok-cookies.json
//    # Optional: override Cruzar API for caption data
//    CRUZAR_API_URL=https://cruzar.app
//    # Optional: alert email on challenge/block
//    ALERT_EMAIL=diegonaguirre@icloud.com
//    RESEND_API_KEY=...
//
// 4. RUN
//    npm run tiktok-upload          (one-shot: render video + upload)
//
// WHY PLAYWRIGHT INSTEAD OF THE TIKTOK API:
//    TikTok's Content Posting API requires a registered app that passes
//    TikTok's review process (takes weeks, requires a privacy policy,
//    terms of service, app demo video, and they frequently reject
//    automation-style apps). Playwright bypasses this entirely, same
//    strategy as the FB group poster.
//
// SCHEDULE:
//    Designed to run once daily. Add to Railway cron or cron-job.org.
//    Best time: 6:00-7:00 AM CT (peak border crossing interest) or
//    4:00-5:00 PM CT (afternoon crossing window).
//
// ======================================================================

import 'dotenv/config'
import { chromium, type BrowserContext, type Page } from 'playwright'
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { execSync } from 'child_process'
import path from 'path'

// --------------- Configuration ---------------

const ENABLED = process.env.TIKTOK_ENABLED !== 'false'
const COOKIES_PATH = process.env.TIKTOK_COOKIES_PATH || './tiktok-cookies.json'
const VIDEO_GENERATOR_DIR = path.resolve(
  process.env.VIDEO_GENERATOR_DIR || path.join(__dirname, '..', '..', 'video-generator')
)
const OUTPUT_DIR = path.join(VIDEO_GENERATOR_DIR, 'output')
const CRUZAR_API_URL = process.env.CRUZAR_API_URL || 'https://cruzar.app'

// Bootstrap cookies from env var if the file doesn't exist yet (for Railway).
if (!existsSync(COOKIES_PATH) && process.env.TIKTOK_COOKIES_JSON) {
  writeFileSync(COOKIES_PATH, process.env.TIKTOK_COOKIES_JSON)
  console.log(`[BOOT] Wrote cookies from TIKTOK_COOKIES_JSON -> ${COOKIES_PATH}`)
} else if (!existsSync(COOKIES_PATH) && process.env.TIKTOK_COOKIES_B64) {
  const decoded = Buffer.from(process.env.TIKTOK_COOKIES_B64, 'base64').toString('utf8')
  writeFileSync(COOKIES_PATH, decoded)
  console.log(`[BOOT] Wrote cookies from TIKTOK_COOKIES_B64 -> ${COOKIES_PATH}`)
}

// --------------- Helpers ---------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function randBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// --------------- Video Generation ---------------

function renderVideo(): string {
  console.log('[RENDER] Running video generator...')
  try {
    execSync('node render.mjs WaitTimes 9x16', {
      cwd: VIDEO_GENERATOR_DIR,
      stdio: 'inherit',
      timeout: 5 * 60 * 1000, // 5 min max
    })
  } catch (err) {
    throw new Error(`Video render failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  return findLatestVideo()
}

function findLatestVideo(): string {
  if (!existsSync(OUTPUT_DIR)) {
    throw new Error(`Output directory not found: ${OUTPUT_DIR}`)
  }

  const files = readdirSync(OUTPUT_DIR)
    .filter((f) => f.endsWith('.mp4'))
    .map((f) => ({
      name: f,
      path: path.join(OUTPUT_DIR, f),
      mtime: statSync(path.join(OUTPUT_DIR, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime)

  if (files.length === 0) {
    throw new Error('No .mp4 files found in output directory')
  }

  console.log(`[VIDEO] Latest: ${files[0].name}`)
  return files[0].path
}

// --------------- Caption Builder ---------------

interface PortData {
  portId: string
  portName?: string
  vehicle?: number | null
}

function getLevel(wait: number | null | undefined): string {
  if (wait === null || wait === undefined) return 'unknown'
  if (wait <= 20) return 'low'
  if (wait <= 45) return 'medium'
  return 'high'
}

const FEATURED_PORTS = [
  { portId: '230501', name: 'Hidalgo' },
  { portId: '230502', name: 'Pharr' },
  { portId: '230503', name: 'Anzalduas' },
  { portId: '535501', name: 'Gateway' },
  { portId: '535502', name: 'Veterans' },
  { portId: '230401', name: 'Laredo I' },
]

async function buildTikTokCaption(): Promise<string> {
  // TikTok captions max out at 2200 chars. Keep it punchy.
  let fastest: { name: string; wait: number } | null = null
  let lines: string[] = []

  try {
    const res = await fetch(`${CRUZAR_API_URL}/api/ports`)
    const json = (await res.json()) as { ports?: PortData[] }
    const ports = json.ports || []

    const active = FEATURED_PORTS.map(({ portId, name }) => {
      const p = ports.find((x) => x.portId === portId)
      const wait = p?.vehicle ?? null
      return { name, wait, level: getLevel(wait) }
    }).filter((c) => c.wait != null && (c.wait as number) > 0)

    if (active.length > 0) {
      const sorted = [...active].sort((a, b) => (a.wait as number) - (b.wait as number))
      fastest = { name: sorted[0].name, wait: sorted[0].wait as number }

      const emoji: Record<string, string> = { low: '🟢', medium: '🟡', high: '🔴', unknown: '⚪' }
      lines = active.map((c) => `${emoji[c.level] || '⚪'} ${c.name}: ${c.wait} min`)
    }
  } catch {
    // If API fails, use a generic caption
  }

  const now = new Date()
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Chicago',
  })

  // Pick from caption variants to keep content fresh
  const variant = now.getDate() % 3

  const waitBlock = lines.length > 0 ? lines.join('\n') + '\n' : ''
  const fastLine = fastest ? `Mas rapido: ${fastest.name} (${fastest.wait} min)\n` : ''

  const hashtags = '#frontera #puentes #cruzar #tiemposdeespera #border #RGV #McAllen #Brownsville #Laredo #puente #mexico #texas'

  if (variant === 0) {
    return `Tiempos en los puentes AHORITA (${timeStr}) 🌉

${waitBlock}${fastLine}
Todos los puentes en vivo en cruzar.app

${hashtags}`
  }

  if (variant === 1) {
    return `Como esta el puente? ${timeStr} 🚗

${waitBlock}${fastLine}
Ya no tienes que preguntar en los grupos. cruzar.app te muestra todo en vivo.

${hashtags}`
  }

  return `Reporte de puentes ${timeStr} 📊

${waitBlock}${fastLine}
Tiempos en vivo + reportes de la raza que acaba de cruzar.
cruzar.app - gratis, sin descargar nada.

${hashtags}`
}

// --------------- Challenge Detection ---------------

function isChallenged(page: Page): boolean {
  const url = page.url()
  return (
    url.includes('captcha') ||
    url.includes('verify') ||
    url.includes('challenge') ||
    url.includes('/login')
  )
}

async function alertOnChallenge(url: string): Promise<void> {
  console.error(`[ABORT] Challenge/captcha detected: ${url}`)
  const resendKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL || 'alerts@cruzar.app'
  const to = process.env.ALERT_EMAIL
  if (resendKey && to) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from,
          to,
          subject: '[Cruzar TikTok] CHALLENGE DETECTED - upload paused',
          text: `The TikTok session hit a challenge/CAPTCHA.\n\nURL: ${url}\n\nLog into the TikTok account manually, resolve the challenge, re-capture cookies with:\n  npm run tiktok-capture-session\n\nThen restart.`,
        }),
      })
    } catch (e) {
      console.error('[ALERT] Failed to send email:', e)
    }
  }
}

// --------------- TikTok Web Upload ---------------

async function uploadToTikTok(videoPath: string, caption: string): Promise<boolean> {
  if (!existsSync(COOKIES_PATH)) {
    console.error(`[ERROR] Cookies file not found: ${COOKIES_PATH}`)
    console.error('Run: npm run tiktok-capture-session')
    return false
  }

  const cookies = JSON.parse(readFileSync(COOKIES_PATH, 'utf8'))

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  })

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'es-MX',
    timezoneId: 'America/Chicago',
  })

  await context.addCookies(cookies)

  let page: Page | null = null
  let success = false

  try {
    page = await context.newPage()

    // Navigate to TikTok's web upload page
    console.log('[UPLOAD] Navigating to TikTok upload page...')
    await page.goto('https://www.tiktok.com/upload', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })
    await sleep(randBetween(3000, 6000))

    // Check for login redirect or challenge
    if (isChallenged(page)) {
      await alertOnChallenge(page.url())
      return false
    }

    // TikTok might redirect to /login if session expired
    if (page.url().includes('/login')) {
      console.error('[ERROR] Session expired - redirected to login.')
      console.error('Run: npm run tiktok-capture-session')
      await alertOnChallenge(page.url())
      return false
    }

    // Wait for the upload page to load. TikTok's upload page uses an
    // iframe for the upload widget. We need to find the file input.
    console.log('[UPLOAD] Looking for file input...')

    // TikTok upload page has a file input (may be hidden). Try multiple
    // strategies to find it.
    let fileInput = await page.$('input[type="file"][accept="video/*"]')
    if (!fileInput) {
      fileInput = await page.$('input[type="file"]')
    }

    // If the file input is inside an iframe, check frames
    if (!fileInput) {
      for (const frame of page.frames()) {
        fileInput = await frame.$('input[type="file"]')
        if (fileInput) break
      }
    }

    if (!fileInput) {
      // TikTok sometimes renders the upload area as a drop zone.
      // Try clicking the upload area first to trigger a file dialog.
      const uploadArea = await page.$('[class*="upload"]') || await page.$('[class*="Upload"]')
      if (uploadArea) {
        // Instead of clicking (which opens native dialog), look deeper
        // for hidden file inputs after DOM settles.
        await sleep(3000)
        fileInput = await page.$('input[type="file"]')
      }
    }

    if (!fileInput) {
      console.error('[ERROR] Could not find file input on TikTok upload page.')
      console.error('[DEBUG] Current URL:', page.url())
      // Save screenshot for debugging
      const screenshotPath = path.join(OUTPUT_DIR, 'tiktok-debug-screenshot.png')
      await page.screenshot({ path: screenshotPath, fullPage: true })
      console.error(`[DEBUG] Screenshot saved to ${screenshotPath}`)
      return false
    }

    // Upload the video file
    console.log(`[UPLOAD] Uploading: ${path.basename(videoPath)}`)
    await fileInput.setInputFiles(videoPath)

    // Wait for the video to process. TikTok shows a progress indicator
    // and then reveals the caption editor. This can take 30-90 seconds.
    console.log('[UPLOAD] Waiting for video processing...')
    await sleep(randBetween(10_000, 15_000))

    // Wait for the editor/caption area to appear. TikTok's upload page
    // transitions to an editor view after processing.
    // Look for the caption/description text editor.
    const captionSelectors = [
      'div[contenteditable="true"][data-text="true"]',
      'div[contenteditable="true"]',
      '.public-DraftEditor-content',
      '[class*="caption"] div[contenteditable]',
      '[class*="Caption"] div[contenteditable]',
      'div[aria-label*="caption"]',
      'div[aria-label*="Caption"]',
      'div[data-contents="true"]',
      'br[data-text="true"]',
    ]

    let captionEditor = null

    // Poll for the caption editor to appear (video processing takes time)
    const editorDeadline = Date.now() + 120_000 // 2 min max
    while (Date.now() < editorDeadline) {
      for (const sel of captionSelectors) {
        const el = await page.$(sel)
        if (el) {
          captionEditor = el
          break
        }
      }
      if (captionEditor) break

      // Check if there's an error message
      const errorText = await page.$eval('body', (b) => b.innerText).catch(() => '')
      if (
        errorText.includes('upload failed') ||
        errorText.includes('error') ||
        errorText.includes('try again')
      ) {
        console.error('[ERROR] TikTok reported an upload error.')
        return false
      }

      await sleep(5000)
    }

    if (!captionEditor) {
      console.error('[ERROR] Caption editor did not appear after video processing.')
      const screenshotPath = path.join(OUTPUT_DIR, 'tiktok-debug-caption.png')
      await page.screenshot({ path: screenshotPath, fullPage: true })
      console.error(`[DEBUG] Screenshot saved to ${screenshotPath}`)
      return false
    }

    // Clear any existing caption and type the new one
    console.log('[UPLOAD] Entering caption...')
    await captionEditor.click()
    await sleep(500)

    // Select all existing text and delete it
    await page.keyboard.press('Control+A')
    await sleep(200)
    await page.keyboard.press('Backspace')
    await sleep(500)

    // Type caption in chunks with realistic delays
    // TikTok's DraftJS editor can be finicky, so we type carefully.
    const captionLines = caption.split('\n')
    for (let i = 0; i < captionLines.length; i++) {
      const line = captionLines[i]
      if (line.length > 0) {
        // Type in small chunks to avoid detection
        const chunks = line.match(/.{1,40}/gs) || [line]
        for (const chunk of chunks) {
          await page.keyboard.type(chunk, { delay: randBetween(10, 30) })
          await sleep(randBetween(50, 200))
        }
      }
      // Press Enter for newlines (except after the last line)
      if (i < captionLines.length - 1) {
        await page.keyboard.press('Enter')
        await sleep(randBetween(100, 300))
      }
    }

    await sleep(randBetween(2000, 4000))

    // TikTok might auto-suggest hashtags after typing # -- wait for
    // the suggestions to settle and dismiss them.
    await page.keyboard.press('Escape')
    await sleep(1000)

    // Now click the "Post" / "Publicar" button
    console.log('[UPLOAD] Clicking Post button...')
    const postButtonSelectors = [
      'button:has-text("Post")',
      'button:has-text("Publicar")',
      'button[data-e2e="upload_btn"]',
      '[class*="PostButton"]',
      '[class*="post-button"]',
      'button:has-text("Subir")',
      'div[role="button"]:has-text("Post")',
      'div[role="button"]:has-text("Publicar")',
    ]

    let postBtn = null
    for (const sel of postButtonSelectors) {
      try {
        const btn = page.locator(sel).first()
        if (await btn.count()) {
          postBtn = btn
          break
        }
      } catch {
        // Selector syntax not supported, skip
      }
    }

    if (!postBtn) {
      // Fallback: find any button that looks like a submit/post button
      const buttons = await page.$$('button')
      for (const btn of buttons) {
        const text = await btn.innerText().catch(() => '')
        if (/^(post|publicar|subir|upload)$/i.test(text.trim())) {
          postBtn = btn
          break
        }
      }
    }

    if (!postBtn) {
      console.error('[ERROR] Could not find Post/Publicar button.')
      const screenshotPath = path.join(OUTPUT_DIR, 'tiktok-debug-post-btn.png')
      await page.screenshot({ path: screenshotPath, fullPage: true })
      console.error(`[DEBUG] Screenshot saved to ${screenshotPath}`)
      return false
    }

    // Click post
    if ('click' in postBtn && typeof postBtn.click === 'function') {
      await postBtn.click()
    } else {
      // It's a Locator
      await (postBtn as any).click()
    }

    // Wait for upload confirmation. TikTok shows a success message or
    // redirects to the profile page.
    console.log('[UPLOAD] Waiting for upload confirmation...')
    await sleep(randBetween(8000, 15000))

    // Check for success indicators
    const pageText = await page.$eval('body', (b) => b.innerText).catch(() => '')
    const successIndicators = [
      'uploaded',
      'your video is being uploaded',
      'publicado',
      'subido',
      'video is being processed',
      'manage your posts',
    ]
    const isSuccess = successIndicators.some((s) => pageText.toLowerCase().includes(s))

    // Also check if we're on a success/profile page
    const currentUrl = page.url()
    const urlSuccess = currentUrl.includes('/profile') || currentUrl.includes('/upload?lang=')

    if (isSuccess || urlSuccess) {
      console.log('[OK] Video uploaded successfully!')
      success = true
    } else if (isChallenged(page)) {
      await alertOnChallenge(page.url())
    } else {
      // Might still be processing -- check once more
      await sleep(10_000)
      const text2 = await page.$eval('body', (b) => b.innerText).catch(() => '')
      if (successIndicators.some((s) => text2.toLowerCase().includes(s))) {
        console.log('[OK] Video uploaded successfully (delayed confirmation).')
        success = true
      } else {
        console.warn('[WARN] Could not confirm upload success. It may still have worked.')
        const screenshotPath = path.join(OUTPUT_DIR, 'tiktok-debug-result.png')
        await page.screenshot({ path: screenshotPath, fullPage: true })
        console.warn(`[DEBUG] Screenshot saved to ${screenshotPath}`)
        // Treat as likely success -- TikTok doesn't always show a clear message
        success = true
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[ERROR] Upload failed: ${msg}`)
  } finally {
    // Save refreshed cookies
    try {
      const freshCookies = await context.cookies()
      writeFileSync(COOKIES_PATH, JSON.stringify(freshCookies, null, 2))
    } catch {
      console.warn('[WARN] Could not save updated cookies')
    }

    if (page) await page.close().catch(() => {})
    await browser.close()
  }

  return success
}

// --------------- Main ---------------

async function main(): Promise<void> {
  console.log(`[START] Cruzar TikTok Uploader`)
  console.log(`  ENABLED: ${ENABLED}`)
  console.log(`  VIDEO_GENERATOR_DIR: ${VIDEO_GENERATOR_DIR}`)
  console.log(`  COOKIES: ${COOKIES_PATH}`)
  console.log('')

  if (!ENABLED) {
    console.log('[PAUSED] TIKTOK_ENABLED=false. Exiting.')
    return
  }

  // Step 1: Render a fresh video
  let videoPath: string
  try {
    videoPath = renderVideo()
  } catch (err) {
    console.error(`[FATAL] ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  // Step 2: Build the caption from live data
  const caption = await buildTikTokCaption()
  console.log(`\n[CAPTION]\n${caption}\n`)

  // Step 3: Upload to TikTok
  const ok = await uploadToTikTok(videoPath, caption)
  if (ok) {
    console.log(`[DONE] TikTok upload complete.`)
  } else {
    console.error(`[FAIL] TikTok upload failed.`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[FATAL]', err)
  process.exit(1)
})
