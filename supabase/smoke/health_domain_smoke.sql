-- Health domain smoke test
-- Run in Supabase SQL editor after applying migrations.

-- 1) Domain column sanity
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sessions'
  AND column_name = 'domain';

SELECT COUNT(*) AS null_domains
FROM public.sessions
WHERE domain IS NULL;

SELECT domain, COUNT(*) AS session_count
FROM public.sessions
GROUP BY domain
ORDER BY domain;

-- 2) Leaderboard entry counts by view
SELECT 'all' AS mode, COUNT(*) AS leaderboard_rows
FROM get_leaderboard('daily', 'all')
UNION ALL
SELECT 'study' AS mode, COUNT(*) AS leaderboard_rows
FROM get_leaderboard('daily', 'study')
UNION ALL
SELECT 'health' AS mode, COUNT(*) AS leaderboard_rows
FROM get_leaderboard('daily', 'health');

-- 3) Dashboard RPCs accept view_mode
SELECT jsonb_pretty(get_daily_metrics(current_date, 'all')::jsonb);
SELECT COUNT(*) AS day_log_rows FROM get_day_metrics_log(current_date, 'all');
SELECT COUNT(*) AS heatmap_rows FROM get_heatmap_data((now() - interval '365 days')::timestamptz, 'all');

-- 4) Profile + medals RPC signatures (replace UUID)
-- SELECT get_user_history_stats('00000000-0000-0000-0000-000000000000'::uuid, current_date, 'all');
-- SELECT COUNT(*) FROM get_user_top_tasks('00000000-0000-0000-0000-000000000000'::uuid, 'daily', 'all');
-- SELECT COUNT(*) FROM get_user_heatmap_data('00000000-0000-0000-0000-000000000000'::uuid, (now() - interval '365 days')::timestamptz, 'all');
-- SELECT COUNT(*) FROM get_leaderboard_medal_counts(NULL, 'all');
-- SELECT jsonb_array_length(get_leaderboard_timeline(2, 'all')::jsonb);
-- SELECT get_user_medal_history('00000000-0000-0000-0000-000000000000'::uuid, 2, 'all');
