-- Fix user top tasks query to handle empty strings and timezone issues
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
  -- Use UTC calculation but consider that users might expect 'today' to be relative to something. 
  -- For now, consistent server time (UTC) is safest.
  IF period = 'weekly' THEN
    start_time := date_trunc('week', now());
  ELSE
    start_time := date_trunc('day', now());
  END IF;

  RETURN QUERY
  SELECT 
    CASE 
        WHEN s.task_name IS NULL OR trim(s.task_name) = '' THEN 'Unspecified'
        ELSE s.task_name 
    END AS grouped_name,
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
  -- We now include NULL/empty tasks in the query but group them as "Unspecified"
  -- AND s.task_name IS NOT NULL 
  GROUP BY grouped_name
  HAVING SUM(
        CASE 
          WHEN s.status = 'completed' THEN s.duration_seconds
          WHEN s.status = 'paused' THEN s.accumulated_seconds
          WHEN s.status = 'active' THEN (s.accumulated_seconds + EXTRACT(EPOCH FROM (now() - s.last_resumed_at)))
          ELSE 0
        END
    ) > 0
  ORDER BY total DESC
  LIMIT 3;
END;
$$;