-- Soft delete / hide profile: when set, profile is excluded from leaderboard and discovery
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN public.profiles.hidden_at IS 'When set, profile is hidden from leaderboard and public listings. NULL = visible.';

-- Leaderboard: exclude hidden profiles
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
    start_time := date_trunc('week', now());
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
  )
  SELECT 
    p.id AS user_id,
    p.username,
    p.avatar_url,
    p.is_verified,
    p.current_status,
    p.current_task,
    COALESCE(l.seconds, 0) AS total_seconds
  FROM public.profiles p
  LEFT JOIN session_stats l ON l.user_id = p.id
  WHERE p.is_verified = true
    AND p.hidden_at IS NULL
  ORDER BY 
    COALESCE(l.seconds, 0) DESC,
    p.username ASC;
END;
$$;

-- My friends list: exclude hidden friends
CREATE OR REPLACE FUNCTION get_friends()
RETURNS TABLE (
    user_id uuid,
    username text,
    avatar_url text,
    current_status text,
    current_task text,
    last_active_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    current_pid uuid;
BEGIN
    current_pid := auth.uid();

    RETURN QUERY
    SELECT 
        p.id,
        p.username,
        p.avatar_url,
        p.current_status,
        p.current_task,
        p.updated_at
    FROM profiles p
    JOIN friendships f ON 
        (f.requester_id = current_pid AND f.recipient_id = p.id) OR
        (f.requester_id = p.id AND f.recipient_id = current_pid)
    WHERE f.status = 'accepted'
      AND p.hidden_at IS NULL
    ORDER BY 
        CASE 
            WHEN p.current_status = 'active' THEN 1
            WHEN p.current_status = 'paused' THEN 2
            WHEN p.current_status = 'online' THEN 3
            ELSE 4 
        END ASC,
        p.username ASC;
END;
$$;

-- User's friends (for profile page): exclude hidden
CREATE OR REPLACE FUNCTION get_user_friends(target_user_id uuid)
RETURNS TABLE (
    user_id uuid,
    username text,
    avatar_url text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.username,
        p.avatar_url
    FROM profiles p
    JOIN friendships f ON
        (f.requester_id = target_user_id AND f.recipient_id = p.id) OR
        (f.requester_id = p.id AND f.recipient_id = target_user_id)
    WHERE f.status = 'accepted'
      AND p.hidden_at IS NULL
    ORDER BY p.username ASC;
END;
$$;
