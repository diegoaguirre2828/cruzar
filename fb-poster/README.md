# Cruzar FB Group Auto-Poster

Automated Facebook group posting via Playwright browser automation.
Posts paraphrased captions with live wait time data to target border
crossing groups at pre-peak hours (5:30am and 4:30pm CT).

## Quick Start

### 1. Capture session cookies (one-time, 2 minutes)

```bash
cd fb-poster
npm install
npm run capture-session
```

A Chrome window opens. Log in as Natividad Rivera. Once you see the
News Feed, press Enter in the terminal. Cookies saved to `cookies.json`.

### 2. Test a single posting cycle locally

```bash
npm run run-once
```

Posts to all groups in `src/groups.ts` with randomized delays. Watch
the console for `[OK]` / `[SKIP]` / `[ABORT]` per group.

### 3. Deploy to Railway ($5/month)

1. Create a Railway account at https://railway.app
2. New project > Deploy from GitHub repo > select `cruzar`
3. In the service settings:
   - **Root Directory:** `fb-poster`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add environment variables (Settings > Variables):
   - `FB_GROUP_AUTOMATION_ENABLED` = `true`
   - `FB_COOKIES_PATH` = `/data/cookies.json`
   - `CRUZAR_API_URL` = `https://cruzar.app`
   - `ALERT_EMAIL` = your email
   - `RESEND_API_KEY` = (same as Vercel)
   - `RESEND_FROM_EMAIL` = `alerts@cruzar.app`
   - `PORT` = `3000`
5. Add a **Volume** mounted at `/data` (persists cookies across deploys)
6. Upload `cookies.json` to the volume via Railway CLI or the web shell

The container stays alive and posts at pre-peak windows automatically.

## Kill Switch

Set `FB_GROUP_AUTOMATION_ENABLED=false` in Railway variables. Takes
effect on the next posting cycle (within 30 minutes). No redeploy needed.

## Adding/Removing Groups

Edit `src/groups.ts`, commit, push. Railway auto-deploys from main.

## Re-capturing Cookies

If the alt account gets challenged or the session expires:
1. Run `npm run capture-session` locally
2. Upload the new `cookies.json` to the Railway volume
3. Restart the Railway container

## How Detection Hardening Works

| Layer | What it does |
|---|---|
| Timing jitter | Random 0-30 min delay before each cycle, 45-90s between groups |
| Caption rotation | 4 paraphrased variants, deterministic per group+day |
| Group shuffle | Random posting order each cycle |
| Rate limit | Never post to same group twice within 6 hours |
| Fake browsing | Random scroll, hover, mouse moves before typing |
| Realistic typing | Character-by-character at 15-45ms delay |
| Stealth mode | Disabled automation flags in Chromium launch args |
| Mobile UA | Posts appear to come from a Samsung Galaxy on Android 14 |
| Cookie refresh | Saves updated cookies after each cycle |
| CAPTCHA abort | Detects checkpoint/captcha URLs, pauses + emails alert |
