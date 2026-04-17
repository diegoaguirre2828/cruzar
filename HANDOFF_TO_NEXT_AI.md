# Cruzar — handoff to the next AI assistant

You are receiving this codebase because the previous assistant (Claude Code) lost the user's trust over the last 24 hours. This document gives you the state, the open work, and the failures to avoid repeating. The user (Diego) is a solo builder, ~20 hrs/week of AI-directed coding, no manual coding background. He is in the RGV (US/Mexico border region) and Cruzar is his border-crossing wait-time app.

**Do not propose pivots, kill features, or volunteer strategic recommendations on Cruzar. Execute what he asks and report results. Save your opinions for direct questions.**

---

## 1. What Cruzar is

Live at https://cruzar.app (production) and https://www.cruzar.app (apex 307s to www, Vercel limitation).

- **Stack:** Next.js 16.2.1 (App Router, React 19), Tailwind v4, TypeScript strict. Supabase (Postgres + RLS + Auth). Vercel hosting (Hobby plan). Cron via cron-job.org (every 15 min).
- **Data source:** CBP public API for live border wait times (https://bwt.cbp.gov/api/bwtnew). Stored in `wait_time_readings` table every 15 min.
- **Users:** Daily commuters (acquisition), trucking fleets (revenue). Spanish-first; bilingual EN/ES toggle is critical.
- **Pricing:** Free / Pro $2.99/mo / Business $49.99/mo. Stripe is configured (verify live).
- **Goal:** 1,000 users in 3 months, first revenue in 3 months.

Read `CLAUDE.md` at the repo root — it's the source-of-truth project brain. Notable: Next.js 16.2.1 has breaking changes from training-data versions; check `node_modules/next/dist/docs/` before assuming patterns. Schema is `supabase-schema-v12.sql` plus migrations in `supabase/migrations/v27...v32`.

GitHub: https://github.com/diegoaguirre2828/cruzar (public).
Local: `C:\Users\dnawa\cruzar`.

---

## 2. State at handoff (2026-04-16 evening CT)

**Working in production:**
- Live wait-time fetch + display + map
- Community report submission (anonymous + authenticated)
- Auth (email/password + Google OAuth via Supabase)
- Push notification infra (VAPID keys in Vercel)
- Resend email alerts (RESEND_FROM_EMAIL=`Cruzar Alerts <alerts@cruzar.app>`, sending live)
- Funnel-event tracking (`funnel_events` table, v30 migration)
- Daily-digest + report-quality + health-check cron (piggybacks on the 15-min tick)

**Shipped this session, deployed to prod:**
- `social_posts` table (v32 migration) for dedupe of `/api/social/next-post` endpoint
- Endpoint enforces a 180-min minimum gap between recorded `facebook_page` posts; `?force=1` is read-only and skips the row insert
- `/api/promoter/latest-caption` now passes `?force=1` so the promoter dashboard doesn't pollute dedupe state
- `fb-poster` Railway service: pending-approval-group detection (persists to `fb-poster/pending-groups.json`, 7-day backoff)
- `fb-poster` scraper + comment-bot: explicit `waitFor` on `[role="feed"]` etc. before scrolling, plus selector fallbacks (was returning 0 articles every Railway run)

---

## 3. Open issues / tasks the previous assistant did NOT complete

In rough priority order. None are urgent enough to require touching the Make.com scenario, the FB Page, or any browser process on the user's machine — see §5.

1. **Verify the fb-poster fixes actually work on Railway.** Two commits (`20171d6`, `7d8046f`) landed for the Pending-detection + selector fallbacks but were never validated with a real Railway run. Health endpoint at https://cruzar-production.up.railway.app/ should show `lastPosted` populated after the next 5am CT or 4pm CT cycle. If `lastPosted` stays `{}` after a window, debug Railway logs.

2. **Make.com scenario over-firing.** Make is hitting `/api/social/next-post` roughly every 25-30 minutes. Dedupe stops the duplicate posts but Make wastes Free-tier ops on every skipped poll. The fix is in the Make UI (set the trigger to fire at 5:30/11:30/15:30/19:30 CT only). Diego will do this himself if/when he wants — **do not attempt automated cookie extraction; see §5.**

3. **Caption truncation during chunked typing in the FB group poster** — known issue in `fb-poster/src/index.ts`. Captions sometimes get cut mid-line during Playwright's `pressSequentially`. Untouched so far.

4. **Resend custom-domain verification** — `RESEND_FROM_EMAIL` IS set, but the previous assistant did not verify the domain SPF/DKIM is healthy in Resend. If alert emails are bouncing, check the Resend dashboard.

5. **Twilio SMS** — configured in env, never tested. Low priority.

6. **mkapi (sibling project, deleted from local at user's request)** — was at github.com/diegoaguirre2828/mkapi (still public on GitHub at user's discretion). Unofficial Make.com API client. Not relevant to Cruzar; ignore unless explicitly told otherwise.

---

## 4. Important builder context (read before suggesting anything)

- Diego will tell you what to build. He has spent ~2 years on Cruzar and knows the RGV market, FB-group dynamics, and his users. **Don't volunteer "let's pivot" or "kill X" recommendations.** Last assistant did this and it landed badly.
- Diego deploys to Vercel and uses Supabase for everything. Don't suggest other infra without being asked.
- Bilingual (EN/ES) is non-negotiable for user-facing text. Default to ES based on browser locale.
- Spanish content tone: casual, RGV neighborhood feel ("ahorita", "nombre"). Not corporate.
- Diego prefers to be told the literal command/path/URL, not "go to settings → ...". Copy-pasteable.
- He uses Git Bash on Windows. Forward-slash paths, `&&` chains, "paste here" instructions. He does NOT have admin access readily available; assume non-elevated.
- His primary Facebook alt account is "Natividad Rivera" (used by `fb-poster`). Treat its session cookies as load-bearing — losing them re-introduces login friction.

---

## 5. What the previous assistant did that you must NOT repeat

These are hard rules. Do not do any of these on any project, ever.

1. **NEVER kill the user's browser processes** (`chrome`, `msedge`, `firefox`, `brave`, etc.). Even briefly. Do not call `Stop-Process`, `taskkill`, or equivalent. Doing so caused **all of Diego's session cookies to be wiped** (Make, Google, GitHub, banking, every signed-in site) — Chrome's app-bound encryption (v20, Chrome 127+) detected a tampered context and cleared the cookies as a security response. Hours of friction restoring sessions.

2. **NEVER create symlinks or NTFS junctions pointing at the user's browser `User Data` directory.** Same outcome.

3. **NEVER launch a second instance of the user's browser pointed at their real profile via `--user-data-dir`.** Same outcome.

4. **NEVER copy the user's browser profile to extract cookies.** ABE invalidates on the original when copied.

5. If browser cookies are needed: ask the user to paste from DevTools (one copy, 30 seconds, zero risk). Or spawn a Playwright instance with its own isolated `userDataDir` and let the user log in fresh inside it.

6. **Don't propose strategic direction on Cruzar.** Bug fixes and infra are fine. Feature roadmap, kill/keep calls, "let me give you 3 options" — no.

7. **Don't bail on hard problems at the first import error.** If you hit `AttributeError` or `ModuleNotFoundError` while implementing a documented technique, fix the import, don't pivot to "let me ask the user." But also — see #1-#5 — don't push so hard you damage the user's environment.

8. **When Diego shows a bug, fix it end-to-end.** Don't reply "two options, A or B, want me to ship A?" Just ship.

---

## 6. Useful infra references

- **Vercel project:** `diegito/cruzar` (production env via `vercel env pull --environment=production`)
- **Supabase project:** `syxnylngrtogrnkfaxew.supabase.co` (US region)
- **Supabase SQL editor:** https://supabase.com/dashboard/project/syxnylngrtogrnkfaxew/sql/new
- **Railway service for fb-poster:** https://cruzar-production.up.railway.app/ (`{"status":"running","lastPosted":{...}}`)
- **GitHub:** https://github.com/diegoaguirre2828/cruzar
- **Cron:** cron-job.org (15-min ticks for `fetch-wait-times`, `send-alerts`, daily-digest, etc.)
- **CRON_SECRET:** `border2026` (yes really; confirm in Vercel env if changed)
- Memory/notes from the previous Claude session live at `C:\Users\dnawa\.claude\projects\C--Users-dnawa\memory\` — full of `feedback_*.md` and `project_cruzar_*.md` files. These are point-in-time observations, not live state. Verify against current code before treating as fact.

---

## 7. Suggested first move for the new assistant

Don't propose anything yet. Read `CLAUDE.md`, `supabase/migrations/v32-social-posts.sql`, `app/api/social/next-post/route.ts`, and the `fb-poster/` directory. Then ask Diego: "What do you want me to work on first?" — and execute that.

End of handoff.
