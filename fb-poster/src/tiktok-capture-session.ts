import 'dotenv/config'
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'

// One-time TikTok session capture tool. Opens a visible Chrome window
// so Diego can log into TikTok manually. Auto-detects login by
// watching for TikTok session cookies.
//
// Usage:
//   cd fb-poster
//   npm run tiktok-capture-session

const COOKIES_PATH = process.env.TIKTOK_COOKIES_PATH || './tiktok-cookies.json'

async function main() {
  console.log('Opening Chrome...')
  console.log('')
  console.log('Log in to your TikTok account (the one you want to post from).')
  console.log('Cookies will save automatically once login is detected.')
  console.log('')

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-first-run', '--no-default-browser-check'],
  })

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'es-MX',
  })

  const page = await context.newPage()
  await page.goto('https://www.tiktok.com/login', { waitUntil: 'domcontentloaded' })

  // Poll for TikTok session cookies. TikTok sets several cookies on
  // login; the most reliable indicators are:
  //   - sessionid (the actual session token)
  //   - sid_tt (session ID variant)
  //   - passport_csrf_token
  // We check for sessionid or sid_tt as login confirmation.
  console.log('Waiting for login (up to 5 minutes)...')
  const deadline = Date.now() + 5 * 60 * 1000
  while (Date.now() < deadline) {
    const cookies = await context.cookies('https://www.tiktok.com')
    const sessionCookie = cookies.find(
      (c) => c.name === 'sessionid' || c.name === 'sid_tt' || c.name === 'sessionid_ss'
    )
    if (sessionCookie) {
      console.log(`\nLogin detected (${sessionCookie.name} found).`)
      break
    }
    await new Promise((r) => setTimeout(r, 1500))
  }

  const cookies = await context.cookies()
  const hasSession = cookies.find(
    (c) => c.name === 'sessionid' || c.name === 'sid_tt' || c.name === 'sessionid_ss'
  )

  if (!hasSession) {
    console.error('Timed out waiting for login. No cookies saved.')
    await browser.close()
    process.exit(1)
  }

  writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2))
  console.log(`Saved ${cookies.length} cookies to ${COOKIES_PATH}`)
  console.log('Done! You can close this window.')

  await browser.close()
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
