-- Fix 1: Filter sessions by Verified Only
-- Fix 2: Leaderboard breaks logic is already in place ("and mode not in breaks") - we'll double check it works across all clauses.
-- New Feature: Add get_user_top_tasks RPC

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
  AND (ss.seconds > 0 OR p.current_status = 'active') -- Only show people with data or currently active
  ORDER BY total_seconds DESC;
END;
$$;

-- Function to get top 3 tasks for a user in a period
CREATE OR REPLACE FUNCTION get_user_top_tasks(target_user_id uuid, period text)
RETURNS TABLE (
  task_name text,
  total_seconds bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_time timestamp with time zone;
BEGIN
  IF period = 'weekly' THEN
    start_time := date_trunc('week', now());
  ELSE
    start_time := date_trunc('day', now());
  END IF;

  RETURN QUERY
  SELECT 
    s.task_name,
    SUM(
        CASE 
          WHEN s.status = 'completed' THEN s.duration_seconds
          WHEN s.status = 'paused' THEN s.accumulated_seconds
          WHEN s.status = 'active' THEN (s.accumulated_seconds + EXTRACT(EPOCH FROM (now() - s.last_resumed_at)))
          ELSE 0
        END
    )::bigint AS total
  FROM sessions s
  WHERE s.user_id = target_user_id
  AND s.started_at >= start_time
  AND s.mode NOT IN ('short-break', 'long-break')
  AND s.task_name IS NOT NULL
  GROUP BY s.task_name
  ORDER BY total DESC
  LIMIT 3;
END;
$$;
