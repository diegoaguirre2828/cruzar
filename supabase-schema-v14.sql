-- v14: Multi-source crossing reports
--
-- Adds tracking of WHERE a report came from, so we can blend native Cruzar
-- user reports with reports parsed from Facebook community groups (and,
-- eventually, AI-vision reads of public webcams).
--
-- Run this in Supabase SQL editor.

alter table crossing_reports
  add column if not exists source varchar default 'cruzar';
-- values: 'cruzar' (native in-app report), 'fb_group' (parsed FB group post),
--         'camera'  (future AI-vision webcam read)

alter table crossing_reports
  add column if not exists source_meta jsonb;
-- optional payload describing the source — e.g. for fb_group:
-- { "group_name": "...", "original_text": "...", "posted_at": "...", "confidence": "high" }

create index if not exists idx_reports_source
  on crossing_reports (source);

-- Backfill any existing rows to 'cruzar' (safe default)
update crossing_reports set source = 'cruzar' where source is null;
