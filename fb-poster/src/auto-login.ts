import 'dotenv/config'
import { chromium } from 'playwright'
import { existsSync, writeFileSync, readFileSync } from 'fs'

// Automatic Facebook login + cookie capture. Runs headless on Railway.
//
// Uses FB_EMAIL + FB_PASSWORD env vars to log in as Natividad Rivera.
// On success, writes fresh cookies to cookies.json so the poster,
// comment bot, and scraper can all use them.
//
// The poster already refreshes cookies after every cycle (saves the
// session-refreshed cookies back to disk). This script is the
// BOOTSTRAP — it runs when cookies.json doesn't exist or has expired.
//
// Set these env vars on Railway:
//   FB_EMAIL=natividad's email
//   FB_PASSWORD=natividad's password
//   FB_COOKIES_PATH=./cookies.json (default)
//
// If FB requires 2FA or a challenge, the script aborts and emails
// the alert address. Diego then needs to manually resolve the challenge
// and re-export cookies once via the browser extension method.

const COOKIES_PATH = process.env.FB_COOKIES_PATH || './cookies.json'
const FB_EMAIL = process.env.FB_EMAIL || ''
const FB_PASSWORD = process.env.FB_PASSWORD || ''

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function ensureCookies(): Promise<boolean> {
  // If cookies exist and have a c_user, assume they're still valid.
  // The posting cycle will refresh them after each run.
  if (existsSync(COOKIES_PATH)) {
    try {
      const cookies = JSON.parse(readFileSync(COOKIES_PATH, 'utf8'))
      const cUser = cookies.find((c: { name: string }) => c.name === 'c_user')
      if (cUser) {
        console.log(`[AUTO-LOGIN] Cookies exist with c_user=${cUser.value}, skipping login`)
        return true
      }
    } catch { /* corrupted file, re-login */ }
  }

  // Bootstrap from FB_COOKIES_JSON env var if available
  if (process.env.FB_COOKIES_JSON) {
    try {
      writeFileSync(COOKIES_PATH, process.env.FB_COOKIES_JSON)
      const cookies = JSON.parse(process.env.FB_COOKIES_JSON)
      const cUser = cookies.find((c: { name: string }) => c.name === 'c_user')
      if (cUser) {
        console.log(`[AUTO-LOGIN] Bootstrapped from FB_COOKIES_JSON, c_user=${cUser.value}`)
        return true
      }
    } catch { /* bad JSON, try login */ }
  }

  // No cookies — try automatic login
  if (!FB_EMAIL || !FB_PASSWORD) {
    console.error('[AUTO-LOGIN] No cookies and no FB_EMAIL/FB_PASSWORD set. Cannot login.')
    return false
  }

  console.log(`[AUTO-LOGIN] No valid cookies found. Logging in as ${FB_EMAIL}...`)

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  })

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'es-MX',
      timezoneId: 'America/Chicago',
    })

    const page = await context.newPage()
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' })
    await sleep(3000)

    // Fill login form
    const emailInput = page.locator('#email, input[name="email"]').first()
    const passInput = page.locator('#pass, input[name="pass"]').first()

    if (!(await emailInput.count()) || !(await passInput.count())) {
      console.error('[AUTO-LOGIN] Could not find login form fields')
      await page.screenshot({ path: 'debug-autologin-noform.png' })
      return false
    }

    await emailInput.fill(FB_EMAIL)
    await sleep(1000)
    await passInput.fill(FB_PASSWORD)
    await sleep(1000)

    // Click login button
    const loginBtn = page.locator('button[name="login"], button[type="submit"], [data-testid="royal_login_button"]').first()
    if (await loginBtn.count()) {
      await loginBtn.click()
    } else {
      await passInput.press('Enter')
    }

    await sleep(5000)

    // Check for challenges
    const url = page.url()
    if (url.includes('checkpoint') || url.includes('captcha') || url.includes('two_step_verification')) {
      console.error('[AUTO-LOGIN] 2FA or challenge detected. Manual intervention needed.')
      await page.screenshot({ path: 'debug-autologin-challenge.png' })
      // Send alert email
      await sendAlert('Facebook login requires 2FA/challenge. Manual cookie export needed.')
      return false
    }

    // Wait for c_user cookie
    let attempts = 0
    while (attempts < 10) {
      const cookies = await context.cookies('https://www.facebook.com')
      const cUser = cookies.find((c) => c.name === 'c_user')
      if (cUser) {
        const allCookies = await context.cookies()
        writeFileSync(COOKIES_PATH, JSON.stringify(allCookies, null, 2))
        console.log(`[AUTO-LOGIN] Success! Saved ${allCookies.length} cookies (c_user=${cUser.value})`)
        await browser.close()
        return true
      }
      await sleep(2000)
      attempts++
    }

    console.error('[AUTO-LOGIN] Login appeared to succeed but no c_user cookie found')
    await page.screenshot({ path: 'debug-autologin-nocuser.png' })
    return false
  } catch (err) {
    console.error('[AUTO-LOGIN] Error:', err instanceof Error ? err.message : err)
    return false
  } finally {
    await browser.close().catch(() => {})
  }
}

async function sendAlert(message: string) {
  const resendKey = process.env.RESEND_API_KEY
  const to = process.env.ALERT_EMAIL
  if (!resendKey || !to) return

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'alerts@cruzar.app',
        to,
        subject: '[Cruzar] FB Auto-Login Alert',
        text: message,
      }),
    })
  } catch { /* best effort */ }
}

// Run standalone
if (process.argv[1]?.includes('auto-login')) {
  ensureCookies().then((ok) => {
    process.exit(ok ? 0 : 1)
  })
}
