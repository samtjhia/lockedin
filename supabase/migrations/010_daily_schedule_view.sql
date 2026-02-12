-- Update get_user_top_tasks to return started_at for daily chronological schedule
-- Weekly remains Top 3 Grouped

-- DROP FUNCTION first because we are changing the return signature
DROP FUNCTION IF EXISTS get_user_top_tasks(uuid, text);

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
    start_time := date_trunc('day', now());
    
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
    ORDER BY s.started_at ASC;
  END IF;
END;
$$;