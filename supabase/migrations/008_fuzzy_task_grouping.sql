-- Improved Top Tasks query with "Fuzzy Matching" (Case/Whitespace normalization)
-- and proper handling of legacy unnamed sessions.

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
    -- "Fuzzy Match": Normalize case and trim whitespace.
    -- Coalesce empty names to 'Untitled' so they don't disappear.
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
  LIMIT 3;
END;
$$;