-- Update get_user_top_tasks to show ALL tasks for daily, but keep LIMIT 3 for weekly.

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
  limit_val int;
BEGIN
  IF period = 'weekly' THEN
    start_time := date_trunc('week', now());
    limit_val := 3;
  ELSE
    start_time := date_trunc('day', now());
    limit_val := NULL; -- No limit for daily (show all)
  END IF;

  RETURN QUERY
  SELECT 
    CASE 
        WHEN s.task_name IS NULL OR trim(s.task_name) = '' THEN 'Untitled'
        ELSE initcap(lower(trim(s.task_name))) 
    END AS clean_name,
    
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
  GROUP BY clean_name
  ORDER BY total DESC
  LIMIT limit_val;
END;
$$;