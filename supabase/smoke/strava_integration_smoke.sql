-- Strava integration smoke test
-- Run after applying migration 064 and configuring Strava env/routes.

-- 1) Schema sanity
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'strava_connections',
    'strava_sync_state',
    'strava_activity_imports',
    'strava_webhook_events'
  )
ORDER BY table_name;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'sessions'
  AND indexname = 'sessions_source_activity_unique_idx';

-- 2) Connected accounts
SELECT
  COUNT(*) AS total_connections,
  COUNT(*) FILTER (WHERE disconnected_at IS NULL) AS active_connections
FROM public.strava_connections;

-- 3) Sync state
SELECT
  user_id,
  sync_in_progress,
  last_synced_at,
  last_success_at,
  last_error_at,
  last_error_message
FROM public.strava_sync_state
ORDER BY updated_at DESC
LIMIT 20;

-- 4) Import ledger and dedupe health
SELECT COUNT(*) AS import_rows
FROM public.strava_activity_imports;

SELECT
  source,
  COUNT(*) AS session_count
FROM public.sessions
WHERE source IS NOT NULL
GROUP BY source
ORDER BY source;

-- 5) Health leaderboard includes imported sessions
SELECT COUNT(*) AS health_rows
FROM get_leaderboard('daily', 'health');
