# Show HN · Hacker News

URL: https://news.ycombinator.com/submit

Mon–Wed, 6:30–8:00am PT. No weekends.

## Title (≤80 chars)

Show HN: Cruzar – live US-Mexico border wait times

## URL

https://cruzar.app

## Text (optional — can leave blank)

Solo build from the Rio Grande Valley. CBP publishes wait times at https://bwt.cbp.gov/api/bwtnew but nothing consumer-facing was using the feed well for my region.

Cruzar pulls it every 15 min, adds community reports, alerts, bridge cameras where cities publish them, and a $19.99/mo dispatcher tier with a customer-facing tracking URL.

Stack: Next.js 16 / Supabase / Vercel / Stripe. Happy to take critique on architecture or positioning.

The non-obvious thing I'm proudest of: southbound community reports. CBP only publishes northbound, so there's been no live data for the half of the market crossing INTO Mexico. Direction flag + community reports = the only feed.
