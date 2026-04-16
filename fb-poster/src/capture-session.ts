import 'dotenv/config'
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'

// One-time session capture tool. Opens a VISIBLE Chrome window so
// Diego can log into Facebook as Natividad Rivera manually. Auto-
// detects login completion by watching for the `c_user` cookie
// (Facebook sets it on successful auth). No Enter key needed.
//
// Usage:
//   cd fb-poster
//   npm run capture-session

const COOKIES_PATH = process.env.FB_COOKIES_PATH || './cookies.json'

async function main() {
  console.log('Opening Chrome...')
  console.log('')
  console.log('Log in as NATIVIDAD RIVERA (the disposable alt).')
  console.log('Cookies will save automatically once login is detected.')
  console.log('')

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-first-run', '--no-default-browser-check'],
  })

  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    locale: 'es-MX',
  })

  const page = await context.newPage()
  await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' })

  // Poll for the `c_user` cookie — Facebook sets it on successful login.
  // Timeout after 5 minutes (plenty of time for manual login + 2FA).
  console.log('Waiting for login (up to 5 minutes)...')
  const deadline = Date.now() + 5 * 60 * 1000
  while (Date.now() < deadline) {
    const cookies = await context.cookies('https://www.facebook.com')
    const cUser = cookies.find((c) => c.name === 'c_user')
    if (cUser) {
      console.log(`\nLogin detected (c_user=${cUser.value}).`)
      break
    }
    await new Promise((r) => setTimeout(r, 1500))
  }

  const cookies = await context.cookies()
  if (!cookies.find((c) => c.name === 'c_user')) {
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
