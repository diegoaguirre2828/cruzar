import { config } from 'dotenv'
config({ path: '.env.local' })
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const token = process.env.SUPABASE_ACCESS_TOKEN
const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1]
const sql = `
SELECT
  -- v50 operator-express-intelligence
  (SELECT count(*) FROM information_schema.tables WHERE table_name='operator_validations') AS v50a_operator_table,
  (SELECT count(*) FROM information_schema.tables WHERE table_name='express_cert_applications') AS v50a_express_table,
  (SELECT count(*) FROM information_schema.tables WHERE table_name='intel_subscribers') AS v50a_intel_subs_table,
  (SELECT count(*) FROM information_schema.tables WHERE table_name='intel_events') AS v50a_intel_events_table,
  -- v50 social-posts-fb-publish
  (SELECT count(*) FROM information_schema.columns WHERE table_name='social_posts' AND column_name='fb_post_id') AS v50b_fb_col,
  (SELECT count(*) FROM information_schema.columns WHERE table_name='social_posts' AND column_name='image_kind') AS v50b_image_col,
  -- v51 auto-crossing-default-on
  (SELECT column_default FROM information_schema.columns WHERE table_name='profiles' AND column_name='auto_geofence_opt_in') AS v51a_default,
  -- v51 first-1000-on-signup-and-backfill (would have created some trigger or column on profiles)
  (SELECT count(*) FROM information_schema.columns WHERE table_name='profiles' AND column_name='first_1000_promo_at') AS v51b_promo_col,
  -- v52 intel-alerts
  (SELECT count(*) FROM information_schema.tables WHERE table_name='intel_alerts') AS v52_alerts_table,
  -- v53 favorite_port
  (SELECT count(*) FROM information_schema.columns WHERE table_name='profiles' AND column_name='favorite_port_id') AS v53_favorite_col;
`
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
})
console.log(await res.text())
