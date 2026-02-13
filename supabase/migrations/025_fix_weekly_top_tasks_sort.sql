-- Fix Weekly Top Tasks Sorting and Timezone
-- 1. Updates Weekly start time to use Toronto Time (consistent with Daily)
-- 2. Adds NULL safety (COALESCE) to duration calculations to prevent NULLs from sorting to the top
-- 3. Explicitly sorts by duration descending with NULLS LAST

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
    -- Weekly: Start of week in Toronto Time (Monday 00:00 EST/EDT)
    start_time := date_trunc('week', now() AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto';
    
    RETURN QUERY
    SELECT 
      CASE 
          WHEN s.task_name IS NULL OR trim(s.task_name) = '' THEN 'Untitled'
          ELSE initcap(lower(trim(s.task_name))) 
      END AS t_name,
      SUM(
          CASE 
            WHEN s.status = 'completed' THEN COALESCE(s.duration_seconds, 0)
            WHEN s.status = 'paused' THEN COALESCE(s.accumulated_seconds, 0)
            WHEN s.status = 'active' THEN (COALESCE(s.accumulated_seconds, 0) + COALESCE(EXTRACT(EPOCH FROM (now() - s.last_resumed_at)), 0))
            ELSE 0
          END
      )::bigint AS seconds,
      NULL::timestamp with time zone as s_at
    FROM sessions s
    WHERE s.user_id = target_user_id
    AND s.started_at >= start_time
    AND s.mode NOT IN ('short-break', 'long-break')
    GROUP BY 1
    ORDER BY 2 DESC NULLS LAST -- Sort by 2nd column (seconds), ensure NULLs don't float to top
    LIMIT 3;
    
  ELSE
    -- Daily: Start of day in Toronto Time
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