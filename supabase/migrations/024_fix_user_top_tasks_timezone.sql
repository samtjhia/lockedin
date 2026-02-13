-- Fix get_user_top_tasks to use Toronto Time for Daily period
-- This ensures 'Today' covers the full day in EST, even after UTC midnight (7 PM EST)

CREATE OR REPLACE FUNCTION get_user_top_tasks(target_user_id uuid, period text)
RETURNS TABLE (
  task_name text,
  total_seconds bigint,
  started_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_time timestamp with time zone;
BEGIN
  IF period = 'weekly' THEN
    start_time := date_trunc('week', now());
    
    -- Weekly view: Grouped by task name, top 3
    RETURN QUERY
    SELECT 
      CASE 
          WHEN s.task_name IS NULL OR trim(s.task_name) = '' THEN 'Untitled'
          ELSE initcap(lower(trim(s.task_name))) 
      END AS t_name,
      SUM(
          CASE 
            WHEN s.status = 'completed' THEN s.duration_seconds
            WHEN s.status = 'paused' THEN s.accumulated_seconds
            WHEN s.status = 'active' THEN (s.accumulated_seconds + EXTRACT(EPOCH FROM (now() - s.last_resumed_at)))
            ELSE 0
          END
      )::bigint AS seconds,
      NULL::timestamp with time zone as s_at
    FROM sessions s
    WHERE s.user_id = target_user_id
    AND s.started_at >= start_time
    AND s.mode NOT IN ('short-break', 'long-break')
    GROUP BY 1
    ORDER BY seconds DESC
    LIMIT 3;
    
  ELSE
    -- Daily: Chronological List (Schedule)
    -- Fix: Use Toronto Time to determine start of day
    start_time := date_trunc('day', now() AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto';
    
    RETURN QUERY
    SELECT 
      COALESCE(NULLIF(trim(s.task_name), ''), 'Untitled') as t_name,
      (
          CASE 
            WHEN s.status = 'completed' THEN s.duration_seconds
            WHEN s.status = 'paused' THEN s.accumulated_seconds
            WHEN s.status = 'active' THEN (s.accumulated_seconds + EXTRACT(EPOCH FROM (now() - s.last_resumed_at)))
            ELSE 0
          END
      )::bigint AS seconds,
      s.started_at as s_at
    FROM sessions s
    WHERE s.user_id = target_user_id
    AND s.started_at >= start_time
    AND s.mode NOT IN ('short-break', 'long-break')
    ORDER BY s.started_at DESC;
    
  END IF;
END;
$$;
