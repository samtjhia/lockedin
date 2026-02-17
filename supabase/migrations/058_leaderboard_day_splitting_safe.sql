-- Day-splitting for leaderboard/medals: prorate session time by calendar day (Toronto) so
-- sessions that span midnight count only the portion on each day. Replaces 057's start-date-only logic.
--
-- INVARIANTS (must hold or medal page breaks):
-- 1. Return one row per verified, non-hidden profile. Use: FROM profiles p LEFT JOIN session_stats.
-- 2. total_seconds is never null and is >= 0. Use COALESCE(..., 0) at final SELECT and in session_stats.
-- 3. Completed proration: exclude sessions that can't be prorated (null ended_at, or ended_at <= started_at).
--    Each term: coalesce( (duration_seconds * overlap_sec / nullif(wall_sec,0))::bigint, 0 ). Sum with coalesce(sum(...), 0).
-- 4. Live proration: when wall_sec <= 0 or null, contribute 0. Use coalesce(overlap_sec, 0).
-- 5. Same RETURNS TABLE and column names as 057 so get_leaderboard_medal_counts / get_user_medal_history keep working.
--
-- HOW TO VERIFY AFTER APPLYING:
--   SELECT * FROM get_leaderboard_for_date((now() AT TIME ZONE 'America/Toronto')::date - 1) LIMIT 5;
--   You should see one row per profile with total_seconds >= 0 (and some > 0 if there was activity that day).

CREATE OR REPLACE FUNCTION get_leaderboard_for_date(target_date date)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  is_verified boolean,
  current_status text,
  current_task text,
  total_seconds bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_time timestamp with time zone;
  end_time timestamp with time zone;
BEGIN
  start_time := (target_date || ' 00:00:00')::timestamp AT TIME ZONE 'America/Toronto';
  end_time := start_time + interval '1 day';

  RETURN QUERY
  WITH
  -- Completed: only sessions that overlap the day and can be prorated (have valid ended_at > started_at)
  completed_prorated AS (
    SELECT
      s.user_id,
      COALESCE(SUM(
        COALESCE(
          (COALESCE(s.duration_seconds, 0) * GREATEST(0, EXTRACT(EPOCH FROM (LEAST(s.ended_at, end_time) - GREATEST(s.started_at, start_time))))
           / NULLIF(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)), 0)
          )::bigint,
          0
        )
      ), 0)::bigint AS sec
    FROM sessions s
    WHERE s.started_at < end_time
      AND s.ended_at >= start_time
      AND s.ended_at IS NOT NULL
      AND s.started_at IS NOT NULL
      AND s.ended_at > s.started_at
      AND s.status = 'completed'
      AND s.mode NOT IN ('short-break', 'long-break')
    GROUP BY s.user_id
  ),
  live_one AS (
    SELECT DISTINCT ON (s.user_id) s.user_id,
      (CASE
        WHEN s.status = 'active' AND s.last_resumed_at IS NOT NULL THEN
          (COALESCE(s.accumulated_seconds, 0) + EXTRACT(EPOCH FROM (LEAST(now(), end_time) - s.last_resumed_at)))::bigint
        WHEN s.status = 'paused' THEN
          COALESCE(s.accumulated_seconds, 0)::bigint
        ELSE 0
      END) AS raw_sec,
      EXTRACT(EPOCH FROM (LEAST(now(), end_time) - GREATEST(s.started_at, start_time))) AS overlap_sec,
      EXTRACT(EPOCH FROM (now() - s.started_at)) AS wall_sec
    FROM sessions s
    WHERE s.started_at < end_time
      AND s.ended_at IS NULL
      AND s.status IN ('active', 'paused')
      AND s.mode NOT IN ('short-break', 'long-break')
    ORDER BY s.user_id, s.last_resumed_at DESC NULLS LAST
  ),
  live_prorated AS (
    SELECT
      user_id,
      (CASE
        WHEN wall_sec IS NOT NULL AND wall_sec > 0 THEN
          LEAST(
            (raw_sec * GREATEST(0, COALESCE(overlap_sec, 0)) / wall_sec)::bigint,
            EXTRACT(EPOCH FROM (end_time - start_time))::bigint
          )
        ELSE 0
      END) AS sec
    FROM live_one
  ),
  session_stats AS (
    SELECT
      COALESCE(c.user_id, l.user_id) AS user_id,
      COALESCE(c.sec, 0) + COALESCE(l.sec, 0) AS seconds
    FROM completed_prorated c
    FULL OUTER JOIN live_prorated l ON l.user_id = c.user_id
  )
  SELECT
    p.id AS user_id,
    p.username,
    p.avatar_url,
    p.is_verified,
    NULL::text AS current_status,
    NULL::text AS current_task,
    COALESCE(s.seconds, 0)::bigint AS total_seconds
  FROM public.profiles p
  LEFT JOIN session_stats s ON s.user_id = p.id
  WHERE p.is_verified = true
    AND p.hidden_at IS NULL
  ORDER BY COALESCE(s.seconds, 0) DESC, p.username ASC;
END;
$$;

CREATE OR REPLACE FUNCTION get_leaderboard_for_week(week_start date)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  is_verified boolean,
  current_status text,
  current_task text,
  total_seconds bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_time timestamp with time zone;
  end_time timestamp with time zone;
BEGIN
  start_time := (week_start || ' 00:00:00')::timestamp AT TIME ZONE 'America/Toronto';
  end_time := start_time + interval '1 week';

  RETURN QUERY
  WITH
  completed_prorated AS (
    SELECT
      s.user_id,
      COALESCE(SUM(
        COALESCE(
          (COALESCE(s.duration_seconds, 0) * GREATEST(0, EXTRACT(EPOCH FROM (LEAST(s.ended_at, end_time) - GREATEST(s.started_at, start_time))))
           / NULLIF(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)), 0)
          )::bigint,
          0
        )
      ), 0)::bigint AS sec
    FROM sessions s
    WHERE s.started_at < end_time
      AND s.ended_at >= start_time
      AND s.ended_at IS NOT NULL
      AND s.started_at IS NOT NULL
      AND s.ended_at > s.started_at
      AND s.status = 'completed'
      AND s.mode NOT IN ('short-break', 'long-break')
    GROUP BY s.user_id
  ),
  live_one AS (
    SELECT DISTINCT ON (s.user_id) s.user_id,
      (CASE
        WHEN s.status = 'active' AND s.last_resumed_at IS NOT NULL THEN
          (COALESCE(s.accumulated_seconds, 0) + EXTRACT(EPOCH FROM (LEAST(now(), end_time) - s.last_resumed_at)))::bigint
        WHEN s.status = 'paused' THEN
          COALESCE(s.accumulated_seconds, 0)::bigint
        ELSE 0
      END) AS raw_sec,
      EXTRACT(EPOCH FROM (LEAST(now(), end_time) - GREATEST(s.started_at, start_time))) AS overlap_sec,
      EXTRACT(EPOCH FROM (now() - s.started_at)) AS wall_sec
    FROM sessions s
    WHERE s.started_at < end_time
      AND s.ended_at IS NULL
      AND s.status IN ('active', 'paused')
      AND s.mode NOT IN ('short-break', 'long-break')
    ORDER BY s.user_id, s.last_resumed_at DESC NULLS LAST
  ),
  live_prorated AS (
    SELECT
      user_id,
      (CASE
        WHEN wall_sec IS NOT NULL AND wall_sec > 0 THEN
          LEAST(
            (raw_sec * GREATEST(0, COALESCE(overlap_sec, 0)) / wall_sec)::bigint,
            EXTRACT(EPOCH FROM (end_time - start_time))::bigint
          )
        ELSE 0
      END) AS sec
    FROM live_one
  ),
  session_stats AS (
    SELECT
      COALESCE(c.user_id, l.user_id) AS user_id,
      COALESCE(c.sec, 0) + COALESCE(l.sec, 0) AS seconds
    FROM completed_prorated c
    FULL OUTER JOIN live_prorated l ON l.user_id = c.user_id
  )
  SELECT
    p.id AS user_id,
    p.username,
    p.avatar_url,
    p.is_verified,
    NULL::text AS current_status,
    NULL::text AS current_task,
    COALESCE(s.seconds, 0)::bigint AS total_seconds
  FROM public.profiles p
  LEFT JOIN session_stats s ON s.user_id = p.id
  WHERE p.is_verified = true
    AND p.hidden_at IS NULL
  ORDER BY COALESCE(s.seconds, 0) DESC, p.username ASC;
END;
$$;
