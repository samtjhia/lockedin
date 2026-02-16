-- Leaderboard: use session status as source of truth for current_status when user has an active/paused session.
-- Fixes leaderboard showing "offline" after refresh while session is still active (e.g. leave beacon had set profile to offline).
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
  IF period = 'weekly' THEN
    start_time := date_trunc('week', now() AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto';
  ELSE
    start_time := date_trunc('day', now() AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto';
  END IF;

  RETURN QUERY
  WITH session_stats AS (
    SELECT 
      s.user_id,
      SUM(
        CASE 
          WHEN s.status = 'completed' THEN s.duration_seconds
          WHEN s.status = 'paused' THEN s.accumulated_seconds
          WHEN s.status = 'active' THEN (s.accumulated_seconds + EXTRACT(EPOCH FROM (now() - s.last_resumed_at)))
          ELSE 0
        END
      )::bigint AS seconds
    FROM sessions s
    WHERE s.started_at >= start_time
    AND s.mode NOT IN ('short-break', 'long-break')
    GROUP BY s.user_id
  ),
  open_session_status AS (
    SELECT DISTINCT ON (user_id) user_id, status
    FROM sessions
    WHERE status IN ('active', 'paused')
    ORDER BY user_id, last_resumed_at DESC NULLS LAST, started_at DESC
  )
  SELECT 
    p.id AS user_id,
    p.username,
    p.avatar_url,
    p.is_verified,
    COALESCE(os.status, p.current_status) AS current_status,
    p.current_task,
    COALESCE(l.seconds, 0) AS total_seconds
  FROM public.profiles p
  LEFT JOIN session_stats l ON l.user_id = p.id
  LEFT JOIN open_session_status os ON os.user_id = p.id
  WHERE p.is_verified = true
    AND p.hidden_at IS NULL
  ORDER BY 
    COALESCE(l.seconds, 0) DESC,
    p.username ASC;
END;
$$;
