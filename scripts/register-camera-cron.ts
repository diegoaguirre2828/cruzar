/**
 * Register / re-register the analyze-bridge-cameras cron job at cron-job.org.
 * Existing job appears to have been disabled or deleted ~2026-04-21
 * (last camera_wait_readings row). Route itself is healthy.
 *
 * Usage:
 *   1. Get API key from https://console.cron-job.org/settings (API tab)
 *   2. CRONJOB_API_KEY=... npx tsx --env-file=.env.local scripts/register-camera-cron.ts
 *   3. Optionally pass --interval=15 (minutes between fires; default 30)
 */

const apiKey = process.env.CRONJOB_API_KEY;
if (!apiKey) {
  console.error("Set CRONJOB_API_KEY env var (or paste inline). Get from https://console.cron-job.org/settings");
  process.exit(1);
}
const cronSecret = process.env.CRON_SECRET;
if (!cronSecret) {
  console.error("CRON_SECRET missing from .env.local");
  process.exit(1);
}

// Parse --interval=N from argv
let intervalMin = 30;
for (const arg of process.argv.slice(2)) {
  const m = arg.match(/^--interval=(\d+)$/);
  if (m) intervalMin = parseInt(m[1], 10);
}
if (intervalMin < 5 || intervalMin > 60) {
  console.error("--interval must be 5..60 (minutes)");
  process.exit(1);
}

// cron-job.org schedule: minutes array fires at those exact minutes-of-hour
// every hour. For "every 15 min" → [0, 15, 30, 45]. For "every 30 min" → [0, 30].
const minutesOfHour: number[] = [];
for (let m = 0; m < 60; m += intervalMin) minutesOfHour.push(m);

const url = `https://cruzar.app/api/cron/analyze-bridge-cameras?secret=${cronSecret}`;
const title = `📹 Cruzar — Bridge Cameras (every ${intervalMin}min)`;

async function main(): Promise<void> {
  console.log(`Registering cron job:`);
  console.log(`  URL:      ${url.replace(cronSecret!, '***')}`);
  console.log(`  Title:    ${title}`);
  console.log(`  Schedule: ${minutesOfHour.join(', ')} past every hour, every day, UTC`);
  console.log(``);

  // List existing jobs first to avoid duplicates
  const listRes = await fetch("https://api.cron-job.org/jobs", {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (!listRes.ok) {
    console.error(`Failed to list jobs: HTTP ${listRes.status} ${await listRes.text()}`);
    process.exit(1);
  }
  const listData = (await listRes.json()) as { jobs: Array<{ jobId: number; title: string; url: string; enabled: boolean }> };
  const existing = (listData.jobs ?? []).find((j) =>
    j.url.includes("/api/cron/analyze-bridge-cameras")
  );
  if (existing) {
    console.log(`Found existing camera job: jobId=${existing.jobId} title="${existing.title}" enabled=${existing.enabled}`);
    console.log(`Updating it (enabled=true + new schedule)...`);
    const updateRes = await fetch(`https://api.cron-job.org/jobs/${existing.jobId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        job: {
          url,
          title,
          enabled: true,
          saveResponses: false,
          schedule: {
            timezone: "UTC",
            hours: [-1],
            minutes: minutesOfHour,
            mdays: [-1],
            months: [-1],
            wdays: [-1],
          },
        },
      }),
    });
    const text = await updateRes.text();
    if (!updateRes.ok) {
      console.error(`Update failed: HTTP ${updateRes.status} ${text}`);
      process.exit(1);
    }
    console.log(`✓ Updated job ${existing.jobId}, enabled + scheduled every ${intervalMin}min`);
    return;
  }

  // Create fresh
  console.log(`No existing camera job found — creating fresh...`);
  const createRes = await fetch("https://api.cron-job.org/jobs", {
    method: "PUT",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      job: {
        url,
        title,
        enabled: true,
        saveResponses: false,
        schedule: {
          timezone: "UTC",
          hours: [-1],
          minutes: minutesOfHour,
          mdays: [-1],
          months: [-1],
          wdays: [-1],
        },
      },
    }),
  });
  const text = await createRes.text();
  if (!createRes.ok) {
    console.error(`Create failed: HTTP ${createRes.status} ${text}`);
    process.exit(1);
  }
  const data = JSON.parse(text) as { jobId?: number };
  console.log(`✓ Created jobId=${data.jobId}, scheduled every ${intervalMin}min from now`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
