-- Leaderboard: use actual session duration (no display cap). Prevents inflation comes from punch-out cap (8h max active segment) and heatmap using duration_seconds.

-- 1. Live leaderboard
CREATE OR REPLACE FUNCTION get_leaderboard(period text)
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
BEGIN
  IF period = 'weekly' THEN
    start_time := date_trunc('week', now() AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto';
  ELSE
    start_time := date_trunc('day', now() AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto';
  END IF;

  RETURN QUERY
  WITH live_one AS (
    SELECT DISTINCT ON (s.user_id) s.user_id,
      (CASE
        WHEN s.status = 'active' AND s.last_resumed_at IS NOT NULL THEN (COALESCE(s.accumulated_seconds, 0) + EXTRACT(EPOCH FROM (now() - s.last_resumed_at)))::bigint
        WHEN s.status = 'paused' THEN COALESCE(s.accumulated_seconds, 0)::bigint
        ELSE 0
      END) AS sec
    FROM sessions s
    WHERE s.started_at >= start_time
      AND s.mode NOT IN ('short-break', 'long-break')
      AND s.status IN ('active', 'paused')
    ORDER BY s.user_id, s.last_resumed_at DESC NULLS LAST
  ),
  completed_sum AS (
    SELECT s.user_id, SUM(COALESCE(s.duration_seconds, 0))::bigint AS sec
    FROM sessions s
    WHERE s.started_at >= start_time
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
    COALESCE(
      (SELECT sess.status FROM sessions sess WHERE sess.user_id = p.id AND sess.status IN ('active', 'paused') ORDER BY sess.last_resumed_at DESC NULLS LAST LIMIT 1),
      p.current_status
    ) AS current_status,
    p.current_task,
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

-- 2. Leaderboard for date
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

-- 3. Leaderboard for week
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
