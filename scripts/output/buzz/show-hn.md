# Show HN · Hacker News

URL: https://news.ycombinator.com/submit

Best post time: Mon-Wed, 6:30-8:00am PT (11:30am-1pm UTC). Avoid weekends + holidays. Set a Monday alarm.

## Title (80 char max, lowercase "Show HN:")

Show HN: Cruzar – live US-Mexico border wait times, built for my region (RGV)

## URL

https://cruzar.app

## Text (optional — usually leave blank for Show HN unless there's context)

I'm 20, live in the Rio Grande Valley, and got tired of scrolling Facebook groups every morning to guess whether the bridge to Reynosa had cleared. CBP publishes wait times at https://bwt.cbp.gov/api/bwtnew but nobody consumer-facing was really using the feed well for my region.

Cruzar is the thing I wanted:

- Every US-MX crossing, live, refreshed every 15 minutes from the CBP API
- Community reports when people actually cross (time-stamped, optionally anonymized)
- Alerts: pick a bridge and a threshold, web push or email when the wait drops below it
- Map view, language toggle (ES/EN), exchange rates near each crossing
- A $19.99/mo dispatcher tier with a customer-facing tracking URL — pastes into WhatsApp, consignee sees live status + current border wait + ETA

Stack: Next.js 16 / Supabase / Vercel / cron-job.org → Vercel cron (migrated this week). A cron fetches CBP every 15 min. I'm solo, no VC, no team. The real competitor is a pile of FB groups and I'm trying to replace them one feature at a time.

Happy to take critique on the architecture or the positioning. The one non-obvious thing I'm proudest of: southbound reports. CBP only publishes northbound, so there's been no data source for anyone crossing INTO Mexico. Cruzar now accepts community reports with a direction flag, and the plan is that those become the only live feed for southbound travelers.
