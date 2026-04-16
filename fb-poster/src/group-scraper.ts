import 'dotenv/config'
import { chromium, type BrowserContext, type Page } from 'playwright'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { TARGET_GROUPS, type TargetGroup } from './groups.js'

// Cruzar FB Group Scraper
//
// Reads posts from target FB groups to extract community-reported
// border data: wait times, lane mentions (SENTRI, Ready, commercial),
// X-ray alerts, random inspections, closures, etc.
//
// The extracted data is POSTed to cruzar.app/api/reports as community
// crossing reports, building Cruzar's historical dataset from the
// same FB groups that are its competition.
//
// This is READ-ONLY — it never posts, comments, or interacts.
// Much lower ban risk than the poster or comment bot.
//
// Schedule: runs every 2 hours on Railway alongside the poster.

const ENABLED = process.env.FB_GROUP_AUTOMATION_ENABLED !== 'false'
const COOKIES_PATH = process.env.FB_COOKIES_PATH || './cookies.json'
const CRUZAR_API = process.env.CRUZAR_API_URL || 'https://www.cruzar.app'
const CRON_SECRET = process.env.CRON_SECRET || ''
const SCRAPED_PATH = './scraped-posts.json'

// Bootstrap cookies
if (!existsSync(COOKIES_PATH) && process.env.FB_COOKIES_JSON) {
  writeFileSync(COOKIES_PATH, process.env.FB_COOKIES_JSON)
} else if (!existsSync(COOKIES_PATH) && process.env.FB_COOKIES_B64) {
  writeFileSync(COOKIES_PATH, Buffer.from(process.env.FB_COOKIES_B64, 'base64').toString('utf8'))
}

function randBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ── Already-scraped tracker ─────────────────────────────────────────
interface ScrapedEntry { url: string; ts: number }
function loadScraped(): Map<string, number> {
  try {
    if (!existsSync(SCRAPED_PATH)) return new Map()
    const arr: ScrapedEntry[] = JSON.parse(readFileSync(SCRAPED_PATH, 'utf8'))
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000 // 7 days
    return new Map(arr.filter((e) => e.ts > cutoff).map((e) => [e.url, e.ts]))
  } catch { return new Map() }
}
function saveScraped(map: Map<string, number>): void {
  const arr: ScrapedEntry[] = [...map.entries()].map(([url, ts]) => ({ url, ts }))
  writeFileSync(SCRAPED_PATH, JSON.stringify(arr, null, 2))
}

// ── Bridge name → portId mapping ────────────────────────────────────
// Matches keywords in post text to CBP port IDs so we can attribute
// the extracted data to the correct bridge.
const BRIDGE_PATTERNS: Array<{ pattern: RegExp; portId: string; name: string }> = [
  // RGV
  { pattern: /hidalgo|mcallen/i, portId: '230501', name: 'Hidalgo' },
  { pattern: /pharr|reynosa.*pharr|pharr.*reynosa/i, portId: '230502', name: 'Pharr' },
  { pattern: /anzald[uú]as/i, portId: '230503', name: 'Anzaldúas' },
  { pattern: /progreso/i, portId: '230901', name: 'Progreso' },
  { pattern: /donna/i, portId: '230902', name: 'Donna' },
  // Brownsville
  { pattern: /puente\s*viejo|gateway.*international|b\s*&\s*m|puente\s*1/i, portId: '535501', name: 'Gateway' },
  { pattern: /veterans|puente\s*nuevo|puente\s*2/i, portId: '535502', name: 'Veterans' },
  { pattern: /los\s*tomates/i, portId: '535503', name: 'Los Tomates' },
  // Laredo
  { pattern: /puente\s*1.*laredo|laredo\s*1|gateway.*americas/i, portId: '230401', name: 'Laredo I' },
  { pattern: /world\s*trade|puente\s*4|laredo.*comercial/i, portId: '230402', name: 'World Trade' },
  { pattern: /colombia|solidaridad|puente\s*3/i, portId: '230403', name: 'Colombia' },
  { pattern: /juarez.*lincoln|puente\s*2.*laredo|laredo\s*2/i, portId: '230404', name: 'Juárez-Lincoln' },
  // Eagle Pass
  { pattern: /eagle\s*pass|piedras\s*negras/i, portId: '240102', name: 'Eagle Pass' },
  // El Paso
  { pattern: /bota|bridge.*americas/i, portId: '240201', name: 'BOTA' },
  { pattern: /paso\s*del\s*norte|pdn|santa\s*fe/i, portId: '240204', name: 'PDN' },
  { pattern: /ysleta|zaragoza/i, portId: '240221', name: 'Zaragoza' },
  // San Ysidro / Tijuana
  { pattern: /san\s*ysidro|la\s*l[ií]nea/i, portId: '250401', name: 'San Ysidro' },
  { pattern: /otay/i, portId: '250501', name: 'Otay Mesa' },
]

// ── Data extraction from post text ──────────────────────────────────
interface ExtractedReport {
  portId: string
  bridgeName: string
  waitMinutes: number | null
  laneType: string | null  // 'sentri', 'ready', 'commercial', 'pedestrian', null=standard
  xray: boolean
  randomCheck: boolean
  closed: boolean
  rawText: string
}

function extractReports(text: string, groupRegion: string): ExtractedReport[] {
  const reports: ExtractedReport[] = []
  const lower = text.toLowerCase()

  // Find which bridge(s) the post mentions
  const matchedBridges = BRIDGE_PATTERNS.filter((b) => b.pattern.test(text))

  // If no bridge matched, try to infer from the group's region
  if (matchedBridges.length === 0) return reports

  // Extract wait time — look for patterns like "45 min", "1 hora", "2 hours"
  let waitMinutes: number | null = null
  const minMatch = lower.match(/(\d{1,3})\s*(?:min(?:utos?)?|minutes?)/)
  const hrMatch = lower.match(/(\d{1,2})\s*(?:hora|hour|hr)s?/)
  if (minMatch) waitMinutes = parseInt(minMatch[1], 10)
  else if (hrMatch) waitMinutes = parseInt(hrMatch[1], 10) * 60

  // Detect lane type
  let laneType: string | null = null
  if (/sentri/i.test(text)) laneType = 'sentri'
  else if (/ready\s*lane/i.test(text)) laneType = 'ready'
  else if (/comercial|commercial|carga|truck|freight/i.test(text)) laneType = 'commercial'
  else if (/peat[oó]n|pedestri|a\s*pie|walking/i.test(text)) laneType = 'pedestrian'

  // Detect special conditions
  const xray = /x[\s-]*ray|rayos?\s*x|scanner|esc[aá]ner/i.test(text)
  const randomCheck = /random|aleatorio|revisi[oó]n|inspecci[oó]n|secondary/i.test(text)
  const closed = /cerrado|closed|cerr[oó]/i.test(text)

  // Only create a report if we have at least SOME useful data
  if (waitMinutes != null || xray || randomCheck || closed || laneType) {
    for (const bridge of matchedBridges) {
      reports.push({
        portId: bridge.portId,
        bridgeName: bridge.name,
        waitMinutes,
        laneType,
        xray,
        randomCheck,
        closed,
        rawText: text.slice(0, 500),
      })
    }
  }

  return reports
}

// ── Submit extracted data to Cruzar API ─────────────────────────────
async function submitReport(report: ExtractedReport): Promise<boolean> {
  try {
    const description = [
      report.xray ? '⚠️ X-ray reported' : '',
      report.randomCheck ? '🔍 Random inspection' : '',
      report.closed ? '🚫 Bridge reported closed' : '',
      report.laneType ? `Lane: ${report.laneType}` : '',
      `(scraped from FB group)`,
    ].filter(Boolean).join(' · ')

    const res = await fetch(`${CRUZAR_API}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        port_id: report.portId,
        wait_minutes: report.waitMinutes,
        report_type: report.xray ? 'xray' : report.closed ? 'closure' : 'wait_time',
        description,
        source: 'fb_scraper',
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ── Main scraping logic ─────────────────────────────────────────────
async function scrapeGroup(
  context: BrowserContext,
  group: TargetGroup,
  scraped: Map<string, number>,
): Promise<{ extracted: number; submitted: number }> {
  let page: Page | null = null
  let extracted = 0
  let submitted = 0

  try {
    page = await context.newPage()
    await page.goto(group.url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await sleep(randBetween(3000, 6000))

    // Check for challenges
    const url = page.url()
    if (url.includes('checkpoint') || url.includes('captcha') || url.includes('login')) {
      console.log(`[CHALLENGE] ${group.name} — skipping`)
      return { extracted: 0, submitted: 0 }
    }

    // Not a member check
    const bodyText = await page.textContent('body').catch(() => '') || ''
    if (bodyText.includes("This content isn't available") || bodyText.includes('Este contenido no está disponible')) {
      console.log(`[SKIP] Not a member of ${group.name}`)
      return { extracted: 0, submitted: 0 }
    }

    // Wait for FB to render the group feed before scrolling. Without
    // this we race the lazy-loader and end up with 0 articles. Try the
    // feed wrapper first (most reliable), fall back to any post-like
    // node, and just press on if both time out.
    const feedReady = await page.locator('[role="feed"], [data-pagelet*="GroupFeed"], div[role="article"]')
      .first()
      .waitFor({ state: 'attached', timeout: 15_000 })
      .then(() => true)
      .catch(() => false)
    if (!feedReady) {
      console.log(`[SKIP] No feed/articles rendered for ${group.name} after 15s`)
      try { await page.screenshot({ path: `scrape-noload-${group.region}-${Date.now()}.png` }) } catch {}
      return { extracted: 0, submitted: 0 }
    }

    // Scroll to load more posts
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.5))
      await sleep(randBetween(2000, 4000))
    }

    // Grab post text. Try role="article" first (modern desktop FB),
    // then a few fallbacks for DOM variants we've seen.
    let articles = await page.$$('div[role="article"]')
    if (articles.length === 0) articles = await page.$$('[data-pagelet*="GroupFeed"] > div > div')
    if (articles.length === 0) articles = await page.$$('[role="feed"] > div')
    console.log(`[SCAN] ${group.name}: ${articles.length} articles found`)
    const postsToProcess = articles.slice(0, 15) // Max 15 posts per group

    for (const article of postsToProcess) {
      try {
        const text = await article.innerText()
        if (!text || text.length < 10) continue

        // Get a permalink-ish identifier
        const links = await article.$$('a[href*="/posts/"], a[href*="/permalink/"], a[href*="story_fbid"]')
        let postUrl = ''
        for (const link of links) {
          const href = await link.getAttribute('href')
          if (href) { postUrl = href.split('?')[0]; break }
        }
        if (!postUrl) {
          // Use a hash of the first 100 chars as fallback ID
          postUrl = `hash_${text.slice(0, 100).replace(/\s+/g, '_').slice(0, 60)}`
        }

        // Skip already-scraped
        if (scraped.has(postUrl)) continue

        const reports = extractReports(text, group.region)
        if (reports.length === 0) continue

        scraped.set(postUrl, Date.now())
        extracted += reports.length

        for (const report of reports) {
          const ok = await submitReport(report)
          if (ok) {
            submitted++
            console.log(`[REPORT] ${report.bridgeName}: ${report.waitMinutes ?? '?'} min ${report.laneType || 'standard'} ${report.xray ? '(X-RAY)' : ''} ${report.randomCheck ? '(RANDOM)' : ''}`)
          }
        }
      } catch {
        // Skip individual post errors
      }
    }
  } catch (err) {
    console.error(`[ERROR] ${group.name}: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    if (page) await page.close().catch(() => {})
  }

  return { extracted, submitted }
}

async function main() {
  if (!ENABLED) {
    console.log('[PAUSED] FB_GROUP_AUTOMATION_ENABLED=false')
    return
  }
  if (!existsSync(COOKIES_PATH)) {
    console.error(`[ERROR] No cookies at ${COOKIES_PATH}`)
    return
  }

  console.log(`[START] Group scraper at ${new Date().toISOString()}`)

  const cookies = JSON.parse(readFileSync(COOKIES_PATH, 'utf8'))
  const scraped = loadScraped()

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run'],
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'es-MX',
    timezoneId: 'America/Chicago',
  })
  await context.addCookies(cookies)

  const shuffled = [...TARGET_GROUPS].sort(() => Math.random() - 0.5)
  let totalExtracted = 0
  let totalSubmitted = 0

  for (const group of shuffled) {
    const { extracted, submitted } = await scrapeGroup(context, group, scraped)
    totalExtracted += extracted
    totalSubmitted += submitted
    console.log(`[GROUP] ${group.name}: ${extracted} extracted, ${submitted} submitted`)

    // Delay between groups
    await sleep(randBetween(15_000, 30_000))
  }

  // Save updated cookies
  try {
    const freshCookies = await context.cookies()
    writeFileSync(COOKIES_PATH, JSON.stringify(freshCookies, null, 2))
  } catch { /* non-critical */ }

  saveScraped(scraped)
  await browser.close()

  console.log(`[DONE] Extracted: ${totalExtracted}, Submitted: ${totalSubmitted}`)
}

main().catch((err) => {
  console.error('[FATAL]', err)
  process.exit(1)
})
