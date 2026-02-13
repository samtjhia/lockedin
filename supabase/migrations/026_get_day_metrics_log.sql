-- Get detailed session logs for a specific date (Toronto Time)
CREATE OR REPLACE FUNCTION get_day_metrics_log(target_date date)
RETURNS TABLE (
  id uuid,
  task_name text,
  status text,
  mode text,
  duration_seconds int,
  started_at timestamp with time zone,
  ended_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_time timestamp with time zone;
  end_time timestamp with time zone;
BEGIN
  -- Convert input date to Toronto Start/End range
  start_time := (target_date || ' 00:00:00')::timestamp at time zone 'America/Toronto';
  end_time := start_time + interval '1 day';
  
  RETURN QUERY
  SELECT 
    s.id,
    COALESCE(NULLIF(trim(s.task_name), ''), 'Untitled') as task_name,
    s.status,
    s.mode,
    (
        CASE 
          WHEN s.status = 'completed' THEN s.duration_seconds
          WHEN s.status = 'paused' THEN s.accumulated_seconds
          WHEN s.status = 'active' THEN (s.accumulated_seconds + EXTRACT(EPOCH FROM (now() - s.last_resumed_at)))
          ELSE 0
        END
    )::int AS duration_seconds,
    s.started_at,
    s.ended_at
  FROM sessions s
  WHERE s.user_id = auth.uid()
  AND s.started_at >= start_time
  AND s.started_at < end_time
  AND s.status = 'completed' -- Only show completed sessions to match heatmap/calendar counts
  AND s.mode NOT IN ('short-break', 'long-break')
  ORDER BY s.started_at DESC;
END;
$$;