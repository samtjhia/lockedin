-- Revert all day-splitting: leaderboard and heatmap back to "attribute by start date only" (pre-055).
-- Leaderboard: sessions count for the day/week they started. Heatmap: same, using duration_seconds.

-- 1. Leaderboard for date (start-date only)
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
  WITH live_one AS (
    SELECT DISTINCT ON (s.user_id) s.user_id,
      (CASE
        WHEN s.status = 'active' AND s.last_resumed_at IS NOT NULL THEN LEAST(
          (COALESCE(s.accumulated_seconds, 0) + EXTRACT(EPOCH FROM (end_time - s.last_resumed_at)))::bigint,
          EXTRACT(EPOCH FROM (end_time - start_time))::bigint
        )
        WHEN s.status = 'paused' THEN LEAST(COALESCE(s.accumulated_seconds, 0)::bigint, EXTRACT(EPOCH FROM (end_time - start_time))::bigint)
        ELSE 0
      END) AS sec
    FROM sessions s
    WHERE s.started_at >= start_time AND s.started_at < end_time
      AND s.mode NOT IN ('short-break', 'long-break')
      AND s.status IN ('active', 'paused')
    ORDER BY s.user_id, s.last_resumed_at DESC NULLS LAST
  ),
  completed_sum AS (
    SELECT s.user_id, SUM(COALESCE(s.duration_seconds, 0))::bigint AS sec
    FROM sessions s
    WHERE s.started_at >= start_time AND s.started_at < end_time
      AND s.mode NOT IN ('short-break', 'long-break')
      AND s.status = 'completed'
    GROUP BY s.user_id
  ),
  session_stats AS (
    SELECT COALESCE(c.user_id, l.user_id) AS user_id,
      COALESCE(c.sec, 0) + COALESCE(l.sec, 0) AS seconds
    FROM completed_sum c
    FULL OUTER JOIN live_one l ON l.user_id = c.user_id
  )
  SELECT 
    p.id AS user_id,
    p.username,
    p.avatar_url,
    p.is_verified,
    NULL::text AS current_status,
    NULL::text AS current_task,
    COALESCE(l.seconds, 0) AS total_seconds
  FROM public.profiles p
  LEFT JOIN session_stats l ON l.user_id = p.id
  WHERE p.is_verified = true
    AND p.hidden_at IS NULL
  ORDER BY 
    COALESCE(l.seconds, 0) DESC,
    p.username ASC;
END;
$$;

-- 2. Leaderboard for week (start-date only)
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
  WITH live_one AS (
    SELECT DISTINCT ON (s.user_id) s.user_id,
      (CASE
        WHEN s.status = 'active' AND s.last_resumed_at IS NOT NULL THEN LEAST(
          (COALESCE(s.accumulated_seconds, 0) + EXTRACT(EPOCH FROM (end_time - s.last_resumed_at)))::bigint,
          EXTRACT(EPOCH FROM (end_time - start_time))::bigint
        )
        WHEN s.status = 'paused' THEN LEAST(COALESCE(s.accumulated_seconds, 0)::bigint, EXTRACT(EPOCH FROM (end_time - start_time))::bigint)
        ELSE 0
      END) AS sec
    FROM sessions s
    WHERE s.started_at >= start_time AND s.started_at < end_time
      AND s.mode NOT IN ('short-break', 'long-break')
      AND s.status IN ('active', 'paused')
    ORDER BY s.user_id, s.last_resumed_at DESC NULLS LAST
  ),
  completed_sum AS (
    SELECT s.user_id, SUM(COALESCE(s.duration_seconds, 0))::bigint AS sec
    FROM sessions s
    WHERE s.started_at >= start_time AND s.started_at < end_time
      AND s.mode NOT IN ('short-break', 'long-break')
      AND s.status = 'completed'
    GROUP BY s.user_id
  ),
  session_stats AS (
    SELECT COALESCE(c.user_id, l.user_id) AS user_id,
      COALESCE(c.sec, 0) + COALESCE(l.sec, 0) AS seconds
    FROM completed_sum c
    FULL OUTER JOIN live_one l ON l.user_id = c.user_id
  )
  SELECT 
    p.id AS user_id,
    p.username,
    p.avatar_url,
    p.is_verified,
    NULL::text AS current_status,
    NULL::text AS current_task,
    COALESCE(l.seconds, 0) AS total_seconds
  FROM public.profiles p
  LEFT JOIN session_stats l ON l.user_id = p.id
  WHERE p.is_verified = true
    AND p.hidden_at IS NULL
  ORDER BY 
    COALESCE(l.seconds, 0) DESC,
    p.username ASC;
END;
$$;

-- 3. Heatmap: attribute by start date only (no proration), use duration_seconds
CREATE OR REPLACE FUNCTION get_heatmap_data(start_date timestamptz)
RETURNS TABLE (
  date text,
  count bigint,
  level int
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH daily_time AS (
    SELECT
      to_char(s.started_at AT TIME ZONE 'America/Toronto', 'YYYY-MM-DD') AS day_str,
      COALESCE(SUM(GREATEST(0, COALESCE(s.duration_seconds, 0)) / 60), 0)::bigint AS total_minutes
    FROM sessions s
    WHERE s.user_id = auth.uid()
      AND s.started_at >= start_date
      AND s.status = 'completed'
      AND s.mode NOT IN ('short-break', 'long-break')
    GROUP BY 1
  )
  SELECT
    dt.day_str AS date,
    dt.total_minutes AS count,
    CASE
      WHEN dt.total_minutes = 0 THEN 0
      WHEN dt.total_minutes <= 30 THEN 1
      WHEN dt.total_minutes <= 60 THEN 2
      WHEN dt.total_minutes <= 120 THEN 3
      ELSE 4
    END AS level
  FROM daily_time dt;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_heatmap_data(
  target_user_id uuid,
  start_date timestamptz
)
RETURNS TABLE (
  date text,
  count bigint,
  level int
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH daily_time AS (
    SELECT
      to_char(s.started_at AT TIME ZONE 'America/Toronto', 'YYYY-MM-DD') AS day_str,
      COALESCE(SUM(GREATEST(0, COALESCE(s.duration_seconds, 0)) / 60), 0)::bigint AS total_minutes
    FROM sessions s
    WHERE s.user_id = target_user_id
      AND s.started_at >= start_date
      AND s.status = 'completed'
      AND s.mode NOT IN ('short-break', 'long-break')
    GROUP BY 1
  )
  SELECT
    dt.day_str AS date,
    dt.total_minutes AS count,
    CASE
      WHEN dt.total_minutes = 0 THEN 0
      WHEN dt.total_minutes <= 30 THEN 1
      WHEN dt.total_minutes <= 60 THEN 2
      WHEN dt.total_minutes <= 120 THEN 3
      ELSE 4
    END AS level
  FROM daily_time dt;
END;
$$;
