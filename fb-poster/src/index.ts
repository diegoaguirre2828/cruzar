import 'dotenv/config'
import { chromium, type BrowserContext, type Page } from 'playwright'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { TARGET_GROUPS, type TargetGroup } from './groups.js'
import { buildCaption, pickVariantIndex, buildLiveData, type LiveData } from './captions.js'
import { ensureCookies } from './auto-login.js'

// Cruzar FB Group Auto-Poster
//
// Hardened Playwright automation that posts to FB groups via the
// Natividad Rivera alt session cookies. Runs on Railway ($5/mo) with
// persistent cookies so the FB session stays warm between runs.
//
// Schedule: invoked twice daily at pre-peak windows by Railway's cron
// or by a simple setInterval when RUN_ONCE is not set. Posts to all
// target groups with randomized delays, paraphrased captions, and
// CAPTCHA auto-abort.
//
// Environment variables: see .env.example

const ENABLED = process.env.FB_GROUP_AUTOMATION_ENABLED !== 'false'
const COOKIES_PATH = process.env.FB_COOKIES_PATH || './cookies.json'
const RUN_ONCE = process.env.RUN_ONCE === '1'

// Bootstrap cookies from env var if the file doesn't exist yet.
// FB_COOKIES_JSON = raw JSON string of the cookies array.
if (!existsSync(COOKIES_PATH) && process.env.FB_COOKIES_JSON) {
  writeFileSync(COOKIES_PATH, process.env.FB_COOKIES_JSON)
  console.log(`[BOOT] Wrote cookies from FB_COOKIES_JSON → ${COOKIES_PATH}`)
} else if (!existsSync(COOKIES_PATH) && process.env.FB_COOKIES_B64) {
  const decoded = Buffer.from(process.env.FB_COOKIES_B64, 'base64').toString('utf8')
  writeFileSync(COOKIES_PATH, decoded)
  console.log(`[BOOT] Wrote cookies from FB_COOKIES_B64 → ${COOKIES_PATH}`)
}

// Randomized delays (milliseconds)
const MIN_DELAY_BETWEEN_GROUPS = 45_000  // 45s
const MAX_DELAY_BETWEEN_GROUPS = 90_000  // 90s
const MIN_DELAY_BEFORE_TYPE = 8_000       // 8s (after navigating to group)
const MAX_DELAY_BEFORE_TYPE = 22_000      // 22s

function randBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// Rate limit: never post to the same group twice within 6 hours.
// In-memory map survives the process lifetime (Railway containers
// stay alive). Lost on cold start — acceptable, just means one
// extra post if Railway restarts mid-window.
const lastPostedAt = new Map<string, number>()
const MIN_GROUP_GAP_MS = 6 * 60 * 60 * 1000

function canPostToGroup(group: TargetGroup): boolean {
  const last = lastPostedAt.get(group.url) || 0
  return Date.now() - last >= MIN_GROUP_GAP_MS
}

function markPosted(group: TargetGroup): void {
  lastPostedAt.set(group.url, Date.now())
}

// CAPTCHA / challenge detection
function isChallenged(page: Page): boolean {
  const url = page.url()
  if (url.includes('checkpoint') || url.includes('captcha') || url.includes('login')) return true
  return false
}

async function alertOnChallenge(group: TargetGroup, url: string): Promise<void> {
  console.error(`[ABORT] Challenge detected on ${group.name}: ${url}`)
  const resendKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL || 'alerts@cruzar.app'
  const to = process.env.ALERT_EMAIL
  if (resendKey && to) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from,
          to,
          subject: '[Cruzar FB Poster] CHALLENGE DETECTED - automation paused',
          text: `The Natividad Rivera session hit a challenge/CAPTCHA on:\n\nGroup: ${group.name}\nURL: ${url}\n\nAutomation is paused. Log into the alt account manually, resolve the challenge, re-export cookies with capture-session.ts, and restart the Railway container.`,
        }),
      })
    } catch (e) {
      console.error('[ALERT] Failed to send email:', e)
    }
  }
}

async function postToGroup(
  context: BrowserContext,
  group: TargetGroup,
  caption: string,
): Promise<{ ok: boolean; reason?: string }> {
  let page: Page | null = null
  try {
    page = await context.newPage()

    // Navigate to the group
    await page.goto(group.url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await sleep(randBetween(2000, 5000))

    // Check for challenges
    if (isChallenged(page)) {
      await alertOnChallenge(group, page.url())
      return { ok: false, reason: 'challenged' }
    }

    // Check for "This content isn't available" — means we're not a
    // member or the group doesn't exist. Skip cleanly.
    const pageText = await page.textContent('body').catch(() => '') || ''
    if (pageText.includes("This content isn't available") || pageText.includes('Este contenido no está disponible')) {
      console.log(`[SKIP] Not a member of ${group.name} — "content not available"`)
      return { ok: false, reason: 'not_member' }
    }

    // Fake human behavior: scroll a bit, hover randomly
    await page.mouse.move(randBetween(100, 400), randBetween(200, 600))
    await sleep(randBetween(1500, 3000))
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * (0.3 + Math.random() * 0.5)))
    await sleep(randBetween(MIN_DELAY_BEFORE_TYPE, MAX_DELAY_BEFORE_TYPE))

    // Dismiss any overlays / popups / cookie banners that block clicks
    try {
      const closeButtons = await page.$$('[aria-label="Close"], [aria-label="Cerrar"], [aria-label="Not now"], [aria-label="Ahora no"]')
      for (const btn of closeButtons) {
        await btn.click({ force: true }).catch(() => {})
        await sleep(500)
      }
    } catch { /* no overlays */ }

    // Find and click the "Write something..." / "Escribe algo..." post box
    // Desktop FB group composer: the post prompt area that opens the modal.
    const postBoxLocator = page.locator([
      '[role="button"][aria-label*="Write something"]',
      '[role="button"][aria-label*="Escribe algo"]',
      '[role="button"][aria-label*="Create a public post"]',
      '[role="button"][aria-label*="Crea una publicaci"]',
      'div[role="textbox"][aria-label*="Write something"]',
      'div[role="textbox"][aria-label*="Escribe algo"]',
      'div[role="textbox"][contenteditable="true"]',
      // Generic fallback: any span containing the prompt text
      'span:text-matches("Write something|Escribe algo|mind|¿Qué")',
    ].join(', ')).first()

    if (!(await postBoxLocator.count())) {
      console.log(`[SKIP] Could not find post box in ${group.name}`)
      // Take a screenshot for debugging
      try { await page.screenshot({ path: `debug-${group.region}-${Date.now()}.png` }) } catch {}
      return { ok: false, reason: 'no_post_box' }
    }

    await postBoxLocator.click({ force: true })
    await sleep(randBetween(3000, 5000))

    // Find the actual text input (modal composer or inline editor)
    const textBox = page.locator('div[role="textbox"][contenteditable="true"]').first()
    if (!(await textBox.count())) {
      console.log(`[SKIP] Could not find text editor in ${group.name}`)
      try { await page.screenshot({ path: `debug-editor-${group.region}-${Date.now()}.png` }) } catch {}
      return { ok: false, reason: 'no_textbox' }
    }

    // Type the caption
    await textBox.click({ force: true })
    await sleep(500)
    const chunks = caption.match(/.{1,30}/gs) || [caption]
    for (const chunk of chunks) {
      await textBox.pressSequentially(chunk, { delay: randBetween(15, 45) })
      await sleep(randBetween(100, 400))
    }

    await sleep(randBetween(2000, 5000))

    // Submit the post. Try the button first, fall back to Ctrl+Enter.
    // Facebook's desktop composer uses Ctrl+Enter to submit — more
    // reliable than finding the button across different FB UI versions.
    const postBtnLocator = page.locator([
      '[aria-label="Post"][role="button"]',
      '[aria-label="Publicar"][role="button"]',
      'div[aria-label="Post"]',
      'div[aria-label="Publicar"]',
      'span:text-matches("^Post$|^Publicar$")',
      // Facebook sometimes nests the button text inside forms
      'form [type="submit"]',
    ].join(', ')).first()

    // Take a screenshot right before submitting to verify text was typed
    try { await page.screenshot({ path: `pre-post-${group.region}-${Date.now()}.png` }) } catch {}

    if (await postBtnLocator.count()) {
      await postBtnLocator.click({ force: true })
    } else {
      // Fallback: Ctrl+Enter submits the composer on desktop FB
      console.log(`[INFO] No Post button found, trying Ctrl+Enter in ${group.name}`)
      await textBox.press('Control+Enter')
    }

    // Wait for submission and verify — check if the composer closed
    await sleep(randBetween(4000, 7000))
    const composerStillOpen = await page.$('div[role="textbox"][contenteditable="true"]')
    if (composerStillOpen) {
      const remainingText = await composerStillOpen.textContent().catch(() => '')
      if (remainingText && remainingText.length > 10) {
        console.log(`[WARN] Composer still has text after submit in ${group.name} — post may not have sent`)
        try { await page.screenshot({ path: `post-failed-${group.region}-${Date.now()}.png` }) } catch {}
      }
    }
    await sleep(randBetween(3000, 6000))

    // Verify no challenge appeared after posting
    if (isChallenged(page)) {
      await alertOnChallenge(group, page.url())
      return { ok: false, reason: 'challenged_after_post' }
    }

    console.log(`[OK] Posted to ${group.name}`)
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[ERROR] ${group.name}: ${msg}`)
    return { ok: false, reason: msg }
  } finally {
    if (page) await page.close().catch(() => {})
  }
}

async function runPostingCycle(): Promise<void> {
  if (!ENABLED) {
    console.log('[PAUSED] FB_GROUP_AUTOMATION_ENABLED=false. Skipping.')
    return
  }

  if (!existsSync(COOKIES_PATH)) {
    console.error(`[ERROR] Cookies file not found: ${COOKIES_PATH}`)
    console.error('Run: npm run capture-session to create it.')
    return
  }

  console.log(`[START] Posting cycle at ${new Date().toISOString()}`)

  const cookies = JSON.parse(readFileSync(COOKIES_PATH, 'utf8'))
  const liveData = await buildLiveData('')
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  })

  // Desktop UA + viewport. The mobile UA triggers FB's mbasic DOM
  // which has MContainer overlays that block Playwright clicks.
  // Desktop FB has a standard composer with reliable selectors.
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'es-MX',
    timezoneId: 'America/Chicago',
  })
  await context.addCookies(cookies)

  // Shuffle group order each run so the posting sequence differs
  const shuffled = [...TARGET_GROUPS].sort(() => Math.random() - 0.5)
  let challenged = false
  let posted = 0
  let skipped = 0

  for (const group of shuffled) {
    if (challenged) break
    if (!canPostToGroup(group)) {
      console.log(`[RATE] Skipping ${group.name} (posted within 6h)`)
      skipped++
      continue
    }

    const variantIdx = pickVariantIndex(group.url)
    const caption = buildCaption(variantIdx, liveData)

    const result = await postToGroup(context, group, caption)
    if (result.ok) {
      markPosted(group)
      posted++
    } else if (result.reason?.includes('challenged')) {
      challenged = true
    } else {
      skipped++
    }

    // Delay between groups
    if (!challenged) {
      const delay = randBetween(MIN_DELAY_BETWEEN_GROUPS, MAX_DELAY_BETWEEN_GROUPS)
      console.log(`[WAIT] ${Math.round(delay / 1000)}s before next group`)
      await sleep(delay)
    }
  }

  // Save cookies back after the cycle (session may have been refreshed
  // by FB during the browsing — keeping the freshest version extends
  // the session lifetime without re-logging in).
  try {
    const freshCookies = await context.cookies()
    writeFileSync(COOKIES_PATH, JSON.stringify(freshCookies, null, 2))
  } catch {
    console.warn('[WARN] Could not save updated cookies')
  }

  await browser.close()
  console.log(`[DONE] Posted: ${posted}, Skipped: ${skipped}, Challenged: ${challenged}`)
}

// Entry point: RUN_ONCE=1 does a single cycle (for testing or cron triggers).
// Without RUN_ONCE, the process stays alive and runs on a schedule, which is
// how Railway containers work (always-on, container restart = cold start).
async function main() {
  console.log(`Cruzar FB Poster starting. ENABLED=${ENABLED}, RUN_ONCE=${RUN_ONCE}`)

  // Auto-login: ensure we have valid cookies before doing anything.
  // If no cookies exist and FB_EMAIL/FB_PASSWORD are set, logs in
  // automatically. If cookies exist, skips. If login requires 2FA,
  // emails Diego and proceeds with whatever cookies we have.
  const hasCookies = await ensureCookies()
  if (!hasCookies) {
    console.error('[FATAL] No valid cookies. Set FB_COOKIES_JSON or FB_EMAIL+FB_PASSWORD.')
    // Don't exit — keep the health check server alive so Railway
    // doesn't restart-loop, and wait for cookies to be provided.
  }

  if (RUN_ONCE) {
    await runPostingCycle()
    process.exit(0)
  }

  // Long-running mode for Railway: run on a schedule.
  // Pre-peak windows in CT (CDT = UTC-5):
  //   05:00-06:00 CT = 10:00-11:00 UTC
  //   16:00-17:00 CT = 21:00-22:00 UTC
  // Add initial jitter: random 0-30 min on first run.
  const initialJitter = randBetween(0, 30 * 60 * 1000)
  console.log(`[SCHEDULE] Initial jitter: ${Math.round(initialJitter / 60000)}m`)

  setTimeout(async () => {
    await runPostingCycle()

    // After first run, check every 30 minutes if we're in a posting window.
    // Also runs the comment bot and group scraper on their own schedules.
    let lastCommentRun = 0
    let lastScrapeRun = 0
    setInterval(async () => {
      const now = new Date()
      const utcHour = now.getUTCHours()

      // Poster: UTC 10 = 5am CT, UTC 21 = 4pm CT (CDT)
      const inPostWindow = utcHour === 10 || utcHour === 21
      if (inPostWindow) {
        await runPostingCycle()
      }

      // Comment bot: run every 4 hours (not tied to posting windows)
      const hoursSinceComment = (Date.now() - lastCommentRun) / (60 * 60 * 1000)
      if (hoursSinceComment >= 4) {
        lastCommentRun = Date.now()
        console.log('[SCHEDULE] Running comment bot...')
        try {
          const { execSync } = await import('child_process')
          execSync('node --import tsx src/comment-bot.ts', {
            cwd: process.cwd(),
            timeout: 10 * 60 * 1000,
            stdio: 'inherit',
          })
        } catch (e) {
          console.error('[COMMENT-BOT] Error:', e instanceof Error ? e.message : e)
        }
      }

      // Group scraper: run every 2 hours
      const hoursSinceScrape = (Date.now() - lastScrapeRun) / (60 * 60 * 1000)
      if (hoursSinceScrape >= 2) {
        lastScrapeRun = Date.now()
        console.log('[SCHEDULE] Running group scraper...')
        try {
          const { execSync } = await import('child_process')
          execSync('node --import tsx src/group-scraper.ts', {
            cwd: process.cwd(),
            timeout: 10 * 60 * 1000,
            stdio: 'inherit',
          })
        } catch (e) {
          console.error('[SCRAPER] Error:', e instanceof Error ? e.message : e)
        }
      }
    }, 30 * 60 * 1000)
  }, initialJitter)

  // Keep process alive for Railway
  if (process.env.PORT) {
    const port = parseInt(process.env.PORT, 10)
    const { createServer } = await import('http')
    createServer((_, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        status: ENABLED ? 'running' : 'paused',
        lastPosted: Object.fromEntries(
          [...lastPostedAt.entries()].map(([k, v]) => [k, new Date(v).toISOString()])
        ),
      }))
    }).listen(port, () => console.log(`Health check on :${port}`))
  }
}

main().catch((err) => {
  console.error('[FATAL]', err)
  process.exit(1)
})
