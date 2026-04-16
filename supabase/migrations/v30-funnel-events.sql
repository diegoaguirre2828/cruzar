-- Lightweight funnel event tracking.
-- Tracks anonymous page events so we can measure signup drop-off.
-- No PII stored — just event name, page, referrer, and a session fingerprint.
CREATE TABLE IF NOT EXISTS funnel_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event text NOT NULL,            -- 'signup_page_view', 'signup_method_click', 'signup_complete', etc.
  page text,                      -- URL path
  referrer text,                  -- document.referrer
  session_id text,                -- random ID stored in sessionStorage (not a user ID)
  meta jsonb DEFAULT '{}'::jsonb, -- extra data (method clicked, error, etc.)
  created_at timestamptz DEFAULT now()
);

-- Index for quick daily funnel queries
CREATE INDEX IF NOT EXISTS idx_funnel_events_event_created
  ON funnel_events (event, created_at DESC);

-- Public insert, admin-only read
ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert funnel events"
  ON funnel_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Only service role can read funnel events"
  ON funnel_events FOR SELECT
  USING (auth.role() = 'service_role');
