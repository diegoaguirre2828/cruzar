import 'dotenv/config'
import { chromium, type BrowserContext, type Page } from 'playwright'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { TARGET_GROUPS, type TargetGroup } from './groups.js'

// Cruzar FB Comment Bot
//
// Scans target FB groups for posts asking about wait times / border
// crossing conditions, and replies with a helpful comment pointing to
// cruzar.app with live data. Uses the same Natividad Rivera session
// cookies and stealth setup as the poster (index.ts).
//
// Rate limits:
//   - Max 3 comments per group per run
//   - Max 15 comments total per run
//   - Min 60s between comments
//   - 30-90s between groups
//   - 8-22s delay before typing
//
// Persistence: commented post URLs are saved to commented-posts.json
// so we never double-comment on the same post across runs.

const ENABLED = process.env.FB_GROUP_AUTOMATION_ENABLED !== 'false'
const COOKIES_PATH = process.env.FB_COOKIES_PATH || './cookies.json'

// Bootstrap cookies from env var if the file doesn't exist yet.
if (!existsSync(COOKIES_PATH) && process.env.FB_COOKIES_JSON) {
  writeFileSync(COOKIES_PATH, process.env.FB_COOKIES_JSON)
  console.log(`[BOOT] Wrote cookies from FB_COOKIES_JSON → ${COOKIES_PATH}`)
} else if (!existsSync(COOKIES_PATH) && process.env.FB_COOKIES_B64) {
  const decoded = Buffer.from(process.env.FB_COOKIES_B64, 'base64').toString('utf8')
  writeFileSync(COOKIES_PATH, decoded)
  console.log(`[BOOT] Wrote cookies from FB_COOKIES_B64 → ${COOKIES_PATH}`)
}

// ── Rate limits ──────────────────────────────────────────────────────
const MAX_COMMENTS_PER_GROUP = 3
const MAX_COMMENTS_TOTAL = 15
const MIN_DELAY_BETWEEN_COMMENTS_MS = 60_000 // 60s
const MIN_DELAY_BETWEEN_GROUPS = 30_000      // 30s
const MAX_DELAY_BETWEEN_GROUPS = 90_000      // 90s
const MIN_DELAY_BEFORE_TYPE = 8_000          // 8s
const MAX_DELAY_BEFORE_TYPE = 22_000         // 22s

// ── Keyword matching ─────────────────────────────────────────────────
// Posts containing any of these keywords (case-insensitive) are candidates
// for a helpful reply.
const KEYWORDS = [
  'wait time',
  'wait times',
  'border crossing',
  'bridge',
  'fila',
  'puente',
  'cuanto',
  'cuánto',
  'linea',
  'línea',
  'como esta',
  'cómo está',
  'como está',
  'cómo esta',
  'alguien cruzando',
  'alguien sabe',
  'alguien que vaya',
  'cuanto se hace',
  'cuánto se hace',
  'cuanto tardan',
  'cuánto tardan',
  'tiempo de espera',
  'esta la fila',
  'está la fila',
  'esta el puente',
  'está el puente',
  'hora de espera',
]

// ── Persistence: commented posts ─────────────────────────────────────
const COMMENTED_POSTS_PATH = './commented-posts.json'

function loadCommentedPosts(): Set<string> {
  try {
    if (existsSync(COMMENTED_POSTS_PATH)) {
      const data = JSON.parse(readFileSync(COMMENTED_POSTS_PATH, 'utf8'))
      // Prune entries older than 30 days to keep the file from growing forever
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
      const entries: Array<{ url: string; at: number }> = Array.isArray(data) ? data : []
      const recent = entries.filter((e) => e.at > thirtyDaysAgo)
      return new Set(recent.map((e) => e.url))
    }
  } catch {
    console.warn('[WARN] Could not load commented-posts.json, starting fresh')
  }
  return new Set()
}

function saveCommentedPosts(urls: Set<string>): void {
  const entries = [...urls].map((url) => ({ url, at: Date.now() }))
  writeFileSync(COMMENTED_POSTS_PATH, JSON.stringify(entries, null, 2))
}

// ── In-memory set for the current run (union of persisted + new) ─────
const commentedPosts = loadCommentedPosts()

// ── Helpers ──────────────────────────────────────────────────────────

function randBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function isChallenged(page: Page): boolean {
  const url = page.url()
  return url.includes('checkpoint') || url.includes('captcha') || url.includes('login')
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
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from,
          to,
          subject: '[Cruzar FB Comment Bot] CHALLENGE DETECTED - automation paused',
          text: `The Natividad Rivera session hit a challenge/CAPTCHA on:\n\nGroup: ${group.name}\nURL: ${url}\n\nAutomation is paused. Log into the alt account manually, resolve the challenge, re-export cookies with capture-session.ts, and restart the Railway container.`,
        }),
      })
    } catch (e) {
      console.error('[ALERT] Failed to send email:', e)
    }
  }
}

// ── Live data from cruzar.app ────────────────────────────────────────

interface PortData {
  portId: string
  portName?: string
  vehicle?: number | null
}

interface FastestBridge {
  name: string
  wait: number
}

async function fetchFastestBridge(): Promise<FastestBridge | null> {
  const apiBase = process.env.CRUZAR_API_URL || 'https://cruzar.app'
  try {
    const res = await fetch(`${apiBase}/api/ports`)
    const json = (await res.json()) as { ports?: PortData[] }
    const ports = (json.ports || [])
      .filter((p) => p.vehicle != null && (p.vehicle as number) >= 0)
      .sort((a, b) => (a.vehicle as number) - (b.vehicle as number))
    if (ports.length > 0) {
      const p = ports[0]
      return { name: p.portName || 'tu puente', wait: p.vehicle as number }
    }
  } catch {
    /* ignore — we'll use a generic comment */
  }
  return null
}

// ── Comment variants ─────────────────────────────────────────────────
// Each variant is a function so we can inject live data into some of them.

function pickComment(fastest: FastestBridge | null): string {
  const variants: string[] = [
    'Los tiempos en vivo de todos los puentes están en cruzar.app — se actualiza cada 15 min',
    fastest
      ? `Acabo de checar en cruzar.app, ${fastest.name} está en ${fastest.wait} min ahorita`
      : 'Acabo de checar en cruzar.app, ahí salen los tiempos de todos los puentes en vivo',
    'Pa no tener que preguntar cada vez, cruzar.app muestra los tiempos en vivo de todos los puentes gratis',
    'cruzar.app tiene los tiempos en vivo + reportes de la gente que va cruzando',
  ]
  return variants[randBetween(0, variants.length - 1)]
}

// ── Post scanning & commenting ───────────────────────────────────────

interface ScannedPost {
  /** Permalink or unique identifier for de-duplication */
  permalink: string
  /** The text content visible in the post */
  text: string
  /** Locator for the comment input area on this post */
  postElement: ReturnType<Page['locator']>
}

/**
 * Scan the visible feed for posts matching our keywords.
 * Returns up to `limit` candidate posts we haven't commented on yet.
 */
async function scanFeed(page: Page, limit: number): Promise<ScannedPost[]> {
  const results: ScannedPost[] = []

  // Scroll down a couple of times to load more posts
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8))
    await sleep(randBetween(1500, 3000))
  }

  // FB groups render posts inside div[role="article"] or div with data-ad-preview
  // We look for role="article" which wraps each group post.
  const articles = page.locator('div[role="article"]')
  const count = await articles.count()
  const postCount = Math.min(count, 10) // scan at most 10 posts

  console.log(`[SCAN] Found ${count} articles, scanning first ${postCount}`)

  for (let i = 0; i < postCount; i++) {
    if (results.length >= limit) break

    try {
      const article = articles.nth(i)
      const text = (await article.innerText({ timeout: 5000 })).toLowerCase()

      // Check if any keyword matches
      const matches = KEYWORDS.some((kw) => text.includes(kw))
      if (!matches) continue

      // Try to extract permalink from the timestamp link inside the article
      // FB posts have an <a> with href containing /groups/GROUP_ID/posts/POST_ID
      // or a timestamp link we can use as identifier.
      let permalink = ''
      const links = article.locator('a[href*="/posts/"], a[href*="/permalink/"]')
      const linkCount = await links.count()
      if (linkCount > 0) {
        const href = await links.first().getAttribute('href')
        if (href) {
          // Normalize: strip query params for dedup
          permalink = href.split('?')[0]
        }
      }

      // Fallback: use the first few words of text + index as a rough key
      if (!permalink) {
        permalink = `__text_${text.slice(0, 80).replace(/\s+/g, '_')}_${i}`
      }

      // Skip if already commented
      if (commentedPosts.has(permalink)) {
        console.log(`[SKIP] Already commented on: ${permalink.slice(0, 80)}...`)
        continue
      }

      results.push({ permalink, text: text.slice(0, 200), postElement: article })
    } catch {
      // Individual article parsing can fail if it's an ad or weird element
      continue
    }
  }

  return results
}

/**
 * Post a comment on a specific article in the feed.
 */
async function commentOnPost(
  page: Page,
  post: ScannedPost,
  commentText: string,
): Promise<boolean> {
  try {
    const article = post.postElement

    // Look for the "Comment" button within the article
    // FB has various selectors: aria-label "Comment", "Comentar", or a comment icon
    const commentBtnSelectors = [
      'div[aria-label="Leave a comment"], div[aria-label="Write a comment"]',
      'div[aria-label="Deja un comentario"], div[aria-label="Escribe un comentario"]',
      'div[aria-label="Comment"]',
      'div[aria-label="Comentar"]',
      'span:text-matches("^Comment$|^Comentar$")',
    ]

    let commentBtn = null
    for (const sel of commentBtnSelectors) {
      const btn = article.locator(sel).first()
      if ((await btn.count()) > 0) {
        commentBtn = btn
        break
      }
    }

    // Broader fallback: look for the comment action area (usually second action button)
    if (!commentBtn) {
      // The comment "button" in FB groups is often inside a form or near
      // the reactions area. Try clicking the area that expands the comment box.
      const actionBar = article.locator('[aria-label*="comment" i], [aria-label*="comentar" i]').first()
      if ((await actionBar.count()) > 0) {
        commentBtn = actionBar
      }
    }

    if (!commentBtn) {
      console.log(`[SKIP] No comment button found for post: ${post.permalink.slice(0, 60)}`)
      return false
    }

    // Click to open/focus comment box
    await commentBtn.click()
    await sleep(randBetween(MIN_DELAY_BEFORE_TYPE, MAX_DELAY_BEFORE_TYPE))

    // Find the comment textbox that should now be visible
    // It's usually a contenteditable div inside or near the article
    const commentBoxSelectors = [
      'div[role="textbox"][contenteditable="true"]',
      'div[aria-label*="Write a comment" i][contenteditable="true"]',
      'div[aria-label*="Escribe un comentario" i][contenteditable="true"]',
      'div[aria-label*="comment" i][contenteditable="true"]',
      'div[aria-label*="comentario" i][contenteditable="true"]',
    ]

    let commentBox = null
    // Search within the article first, then page-wide (the comment box
    // might be rendered outside the article DOM in some FB layouts)
    for (const sel of commentBoxSelectors) {
      const box = article.locator(sel).first()
      if ((await box.count()) > 0) {
        commentBox = box
        break
      }
    }

    if (!commentBox) {
      // Try page-wide — FB sometimes renders the active comment input
      // outside the article tree
      for (const sel of commentBoxSelectors) {
        const box = page.locator(sel).last()
        if ((await box.count()) > 0) {
          commentBox = box
          break
        }
      }
    }

    if (!commentBox) {
      console.log(`[SKIP] No comment textbox found for post: ${post.permalink.slice(0, 60)}`)
      return false
    }

    // Click and type
    await commentBox.click()
    await sleep(randBetween(500, 1500))

    // Type with realistic human delays
    const chunks = commentText.match(/.{1,25}/gs) || [commentText]
    for (const chunk of chunks) {
      await commentBox.pressSequentially(chunk, { delay: randBetween(20, 55) })
      await sleep(randBetween(100, 500))
    }

    await sleep(randBetween(1500, 3000))

    // Submit: press Enter to post the comment
    await commentBox.press('Enter')
    await sleep(randBetween(2000, 4000))

    // Verify no challenge appeared
    if (isChallenged(page)) {
      return false // caller will handle the challenge
    }

    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[ERROR] Failed to comment: ${msg}`)
    return false
  }
}

// ── Main cycle ───────────────────────────────────────────────────────

async function runCommentCycle(): Promise<void> {
  if (!ENABLED) {
    console.log('[PAUSED] FB_GROUP_AUTOMATION_ENABLED=false. Skipping.')
    return
  }

  if (!existsSync(COOKIES_PATH)) {
    console.error(`[ERROR] Cookies file not found: ${COOKIES_PATH}`)
    console.error('Run: npm run capture-session to create it.')
    return
  }

  console.log(`[START] Comment cycle at ${new Date().toISOString()}`)

  const cookies = JSON.parse(readFileSync(COOKIES_PATH, 'utf8'))
  const fastest = await fetchFastestBridge()
  console.log(
    fastest
      ? `[DATA] Fastest bridge: ${fastest.name} at ${fastest.wait} min`
      : '[DATA] Could not fetch live bridge data — using generic comments',
  )

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
      'Mozilla/5.0 (Linux; Android 14; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.280 Mobile Safari/537.36',
    viewport: { width: 412, height: 915 },
    locale: 'es-MX',
    timezoneId: 'America/Chicago',
  })
  await context.addCookies(cookies)

  // Shuffle group order each run
  const shuffled = [...TARGET_GROUPS].sort(() => Math.random() - 0.5)
  let challenged = false
  let totalComments = 0
  let lastCommentTime = 0

  for (const group of shuffled) {
    if (challenged) break
    if (totalComments >= MAX_COMMENTS_TOTAL) {
      console.log(`[LIMIT] Reached ${MAX_COMMENTS_TOTAL} total comments. Stopping.`)
      break
    }

    let page: Page | null = null
    let groupComments = 0

    try {
      page = await context.newPage()
      console.log(`[GROUP] Navigating to ${group.name}`)

      await page.goto(group.url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      await sleep(randBetween(2000, 5000))

      // Challenge check
      if (isChallenged(page)) {
        await alertOnChallenge(group, page.url())
        challenged = true
        break
      }

      // Fake human behavior: scroll, hover
      await page.mouse.move(randBetween(100, 400), randBetween(200, 600))
      await sleep(randBetween(1500, 3000))

      // Scan posts
      const candidates = await scanFeed(page, MAX_COMMENTS_PER_GROUP)
      console.log(`[SCAN] ${group.name}: ${candidates.length} matching posts found`)

      for (const post of candidates) {
        if (groupComments >= MAX_COMMENTS_PER_GROUP) break
        if (totalComments >= MAX_COMMENTS_TOTAL) break

        // Enforce minimum gap between comments
        const elapsed = Date.now() - lastCommentTime
        if (lastCommentTime > 0 && elapsed < MIN_DELAY_BETWEEN_COMMENTS_MS) {
          const waitMs = MIN_DELAY_BETWEEN_COMMENTS_MS - elapsed + randBetween(0, 5000)
          console.log(`[WAIT] ${Math.round(waitMs / 1000)}s until next comment (rate limit)`)
          await sleep(waitMs)
        }

        const comment = pickComment(fastest)
        console.log(`[REPLY] Attempting comment on: ${post.permalink.slice(0, 80)}`)
        console.log(`[REPLY] Text: ${comment}`)

        const success = await commentOnPost(page, post, comment)

        if (isChallenged(page)) {
          await alertOnChallenge(group, page.url())
          challenged = true
          break
        }

        if (success) {
          commentedPosts.add(post.permalink)
          groupComments++
          totalComments++
          lastCommentTime = Date.now()
          console.log(`[OK] Comment #${totalComments} posted in ${group.name}`)
        } else {
          console.log(`[SKIP] Could not comment on post in ${group.name}`)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[ERROR] ${group.name}: ${msg}`)
    } finally {
      if (page) await page.close().catch(() => {})
    }

    // Delay between groups
    if (!challenged && totalComments < MAX_COMMENTS_TOTAL) {
      const delay = randBetween(MIN_DELAY_BETWEEN_GROUPS, MAX_DELAY_BETWEEN_GROUPS)
      console.log(`[WAIT] ${Math.round(delay / 1000)}s before next group`)
      await sleep(delay)
    }
  }

  // Persist the commented posts set
  saveCommentedPosts(commentedPosts)
  console.log(`[SAVE] Saved ${commentedPosts.size} commented post URLs to ${COMMENTED_POSTS_PATH}`)

  // Save cookies back (session refresh)
  try {
    const freshCookies = await context.cookies()
    writeFileSync(COOKIES_PATH, JSON.stringify(freshCookies, null, 2))
  } catch {
    console.warn('[WARN] Could not save updated cookies')
  }

  await browser.close()
  console.log(`[DONE] Comments posted: ${totalComments}, Challenged: ${challenged}`)
}

// ── Entry point ──────────────────────────────────────────────────────

async function main() {
  console.log(`Cruzar FB Comment Bot starting. ENABLED=${ENABLED}`)
  await runCommentCycle()
  process.exit(0)
}

main().catch((err) => {
  console.error('[FATAL]', err)
  process.exit(1)
})
