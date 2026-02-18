-- Live "Today" leaderboard: include sessions that overlap today and count only time that falls today.
-- So someone whose session started yesterday but is still active gets their time-from-midnight-to-now for today.
-- Only get_leaderboard(period) is changed; get_leaderboard_for_date / _for_week (medals/history) stay as-is.

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
  end_time timestamp with time zone;
BEGIN
  IF period = 'weekly' THEN
    start_time := date_trunc('week', now() AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto';
    end_time := start_time + interval '1 week';
  ELSE
    start_time := date_trunc('day', now() AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto';
    end_time := start_time + interval '1 day';
  END IF;

  RETURN QUERY
  WITH
  -- Completed: daily = overlap today + prorate; weekly = started this week + full duration
  completed_sum AS (
    SELECT s.user_id,
      CASE
        WHEN period = 'daily' THEN
          COALESCE(SUM(
            COALESCE(
              (COALESCE(s.duration_seconds, 0) * GREATEST(0, EXTRACT(EPOCH FROM (LEAST(s.ended_at, end_time) - GREATEST(s.started_at, start_time))))
               / NULLIF(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)), 0)
              )::bigint,
              0
            )
          ), 0)::bigint
        ELSE
          SUM(COALESCE(s.duration_seconds, 0))::bigint
      END AS sec
    FROM sessions s
    WHERE s.ended_at IS NOT NULL
      AND s.started_at IS NOT NULL
      AND s.ended_at > s.started_at
      AND s.status = 'completed'
      AND s.mode NOT IN ('short-break', 'long-break')
      AND (
        (period = 'daily' AND s.started_at < end_time AND s.ended_at >= start_time)
        OR (period = 'weekly' AND s.started_at >= start_time AND s.started_at < end_time)
      )
    GROUP BY s.user_id
  ),
  -- Active/paused: daily = overlap today and prorate; weekly = started in week, full count
  live_one AS (
    SELECT DISTINCT ON (s.user_id) s.user_id,
      (CASE
        WHEN s.status = 'active' AND s.last_resumed_at IS NOT NULL THEN (COALESCE(s.accumulated_seconds, 0) + EXTRACT(EPOCH FROM (now() - s.last_resumed_at)))::bigint
        WHEN s.status = 'paused' THEN COALESCE(s.accumulated_seconds, 0)::bigint
        ELSE 0
      END) AS raw_sec,
      EXTRACT(EPOCH FROM (LEAST(now(), end_time) - GREATEST(s.started_at, start_time))) AS overlap_sec,
      EXTRACT(EPOCH FROM (now() - s.started_at)) AS wall_sec
    FROM sessions s
    WHERE s.started_at < end_time
      AND s.ended_at IS NULL
      AND s.status IN ('active', 'paused')
      AND s.mode NOT IN ('short-break', 'long-break')
      AND (
        (period = 'weekly' AND s.started_at >= start_time)
        OR period = 'daily'
      )
    ORDER BY s.user_id, s.last_resumed_at DESC NULLS LAST
  ),
  live_prorated AS (
    SELECT user_id,
      CASE
        WHEN period = 'daily' AND wall_sec IS NOT NULL AND wall_sec > 0 THEN
          LEAST(
            (raw_sec * GREATEST(0, COALESCE(overlap_sec, 0)) / wall_sec)::bigint,
            EXTRACT(EPOCH FROM (end_time - start_time))::bigint
          )
        WHEN period = 'weekly' THEN raw_sec
        ELSE 0
      END AS sec
    FROM live_one
  ),
  session_stats AS (
    SELECT
      COALESCE(c.user_id, l.user_id) AS user_id,
      COALESCE(c.sec, 0) + COALESCE(l.sec, 0) AS seconds
    FROM completed_sum c
    FULL OUTER JOIN live_prorated l ON l.user_id = c.user_id
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
    COALESCE(s.seconds, 0)::bigint AS total_seconds
  FROM public.profiles p
  LEFT JOIN session_stats s ON s.user_id = p.id
  WHERE p.is_verified = true
    AND p.hidden_at IS NULL
  ORDER BY COALESCE(s.seconds, 0) DESC, p.username ASC;
END;
$$;
