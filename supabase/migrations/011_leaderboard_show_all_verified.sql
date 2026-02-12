-- Fix leaderboard to show ALL verified users regardless of time logged

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
  -- Determine start time based on period
  IF period = 'weekly' THEN
    start_time := date_trunc('week', now()); -- Starts Monday 00:00
  ELSE
    start_time := date_trunc('day', now()); -- Starts Today 00:00 (default)
  END IF;

  RETURN QUERY
  WITH session_stats AS (
    SELECT 
      s.user_id,
      SUM(
        CASE 
          -- For completed sessions, use stored duration
          WHEN s.status = 'completed' THEN s.duration_seconds
          -- For paused sessions, use accumulated seconds
          WHEN s.status = 'paused' THEN s.accumulated_seconds
          -- For active sessions, use accumulated + elapsed time since last resume
          WHEN s.status = 'active' THEN (s.accumulated_seconds + EXTRACT(EPOCH FROM (now() - s.last_resumed_at)))
          ELSE 0
        END
      )::bigint AS seconds
    FROM sessions s
    WHERE s.started_at >= start_time
    AND s.mode NOT IN ('short-break', 'long-break') -- Ensure no breaks count
    GROUP BY s.user_id
  )
  SELECT 
    p.id AS user_id,
    p.username,
    p.avatar_url,
    p.is_verified,
    p.current_status,
    p.current_task,
    COALESCE(ss.seconds, 0) AS total_seconds
  FROM profiles p
  LEFT JOIN session_stats ss ON p.id = ss.user_id
  WHERE p.is_verified = true -- ONLY VERIFIED
  -- REMOVED condition: AND (ss.seconds > 0 OR p.current_status = 'active')
  ORDER BY total_seconds DESC;
END;
$$;