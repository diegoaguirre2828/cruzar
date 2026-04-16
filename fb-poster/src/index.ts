import 'dotenv/config'
import { chromium, type BrowserContext, type Page } from 'playwright'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { TARGET_GROUPS, type TargetGroup } from './groups.js'
import { buildCaption, pickVariantIndex, buildLiveData, type LiveData } from './captions.js'

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
// This lets Railway (or any host) work without a persistent volume —
// just base64-encode cookies.json and set FB_COOKIES_B64.
if (!existsSync(COOKIES_PATH) && process.env.FB_COOKIES_B64) {
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

    // Fake human behavior: scroll a bit, hover randomly
    await page.mouse.move(randBetween(100, 400), randBetween(200, 600))
    await sleep(randBetween(1500, 3000))
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * (0.3 + Math.random() * 0.5)))
    await sleep(randBetween(MIN_DELAY_BEFORE_TYPE, MAX_DELAY_BEFORE_TYPE))

    // Find and click the "Write something..." / "Escribe algo..." post box
    // FB groups have multiple possible selectors depending on the UI version.
    const postBoxSelectors = [
      '[role="button"][aria-label*="Write"]',
      '[role="button"][aria-label*="Escrib"]',
      '[role="button"][aria-label*="write"]',
      'div[data-testid="post_message"]',
      '[aria-label*="Create a public post"]',
      '[aria-label*="Crea una publicaci"]',
      'div[role="textbox"]',
    ]

    let postBox = null
    for (const sel of postBoxSelectors) {
      postBox = await page.$(sel)
      if (postBox) break
    }

    if (!postBox) {
      // If we can't find the post box, try clicking "What's on your mind?" area
      const createPostArea = await page.$('div[class*="sjgh65i0"]') || await page.$('span:text-matches("Escri|Write|mind")')
      if (createPostArea) {
        await createPostArea.click()
        await sleep(3000)
        postBox = await page.$('div[role="textbox"]')
      }
    }

    if (!postBox) {
      console.log(`[SKIP] Could not find post box in ${group.name}`)
      return { ok: false, reason: 'no_post_box' }
    }

    // Click the post box to open the composer
    await postBox.click()
    await sleep(randBetween(2000, 4000))

    // Find the actual text input (might be a new modal or inline editor)
    const textBox = await page.$('div[role="textbox"][contenteditable="true"]')
    if (!textBox) {
      console.log(`[SKIP] Could not find text editor in ${group.name}`)
      return { ok: false, reason: 'no_textbox' }
    }

    // Type the caption with realistic human-like delays
    await textBox.click()
    await sleep(500)
    // Type character by character is too slow. Paste is more realistic for
    // someone posting pre-written content (which is what a real user with
    // a copy-paste habit looks like). Fill is fastest but doesn't trigger
    // all events. Using keyboard with a medium delay between chunks.
    const chunks = caption.match(/.{1,30}/gs) || [caption]
    for (const chunk of chunks) {
      await textBox.pressSequentially(chunk, { delay: randBetween(15, 45) })
      await sleep(randBetween(100, 400))
    }

    await sleep(randBetween(2000, 5000))

    // Click the "Post" / "Publicar" button
    const postBtnSelectors = [
      '[aria-label="Post"]',
      '[aria-label="Publicar"]',
      'div[aria-label="Post"][role="button"]',
      'div[aria-label="Publicar"][role="button"]',
    ]
    let postBtn = null
    for (const sel of postBtnSelectors) {
      postBtn = await page.$(sel)
      if (postBtn) break
    }

    if (!postBtn) {
      // Fallback: look for a button-like element with "Post" or "Publicar" text
      postBtn = await page.$('span:text-matches("^Post$|^Publicar$")')
    }

    if (!postBtn) {
      console.log(`[SKIP] Could not find Post button in ${group.name}`)
      return { ok: false, reason: 'no_post_btn' }
    }

    await postBtn.click()
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

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.280 Mobile Safari/537.36',
    viewport: { width: 412, height: 915 },
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
    setInterval(async () => {
      const now = new Date()
      const utcHour = now.getUTCHours()
      // UTC 10 = 5am CT, UTC 21 = 4pm CT (CDT)
      const inWindow = utcHour === 10 || utcHour === 21
      if (inWindow) {
        await runPostingCycle()
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
