-- Use America/Toronto for all weekly and monthly boundaries (match daily which is already Toronto).
-- 1. Leaderboard: weekly period → Monday 00:00 Toronto
-- 2. History stats: week/month containing target date → Toronto week and month
-- 3. User history stats (profile): same

-- 1. get_leaderboard: weekly start in Toronto
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
    -- Monday 00:00 America/Toronto
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

-- 2. get_history_stats: week and month boundaries in Toronto
CREATE OR REPLACE FUNCTION get_history_stats(target_date date)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    day_start timestamp with time zone;
    day_end timestamp with time zone;
    week_start timestamp with time zone;
    month_start timestamp with time zone;
    month_end timestamp with time zone;
    daily_seconds bigint;
    longest_session bigint;
    peak_hour int;
    weekly_seconds bigint;
    monthly_seconds bigint;
    monthly_peak_hour int;
    monthly_top_topics json;
    top_topics json;
    result json;
BEGIN
    day_start := (target_date || ' 00:00:00')::timestamp AT TIME ZONE 'America/Toronto';
    day_end := day_start + interval '1 day';
    -- Week (Monday) and month in Toronto
    week_start := date_trunc('week', day_start AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto';
    month_start := date_trunc('month', day_start AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto';
    month_end := month_start + interval '1 month';

    SELECT 
        COALESCE(SUM(CASE WHEN status = 'completed' THEN duration_seconds ELSE 0 END), 0),
        COALESCE(MAX(CASE WHEN status = 'completed' THEN duration_seconds ELSE 0 END), 0)
    INTO daily_seconds, longest_session
    FROM sessions
    WHERE user_id = auth.uid()
    AND started_at >= day_start AND started_at < day_end
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break');

    SELECT extract(hour from (started_at AT TIME ZONE 'America/Toronto'))::int
    INTO peak_hour
    FROM sessions
    WHERE user_id = auth.uid()
    AND started_at >= day_start AND started_at < day_end
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break')
    GROUP BY 1
    ORDER BY count(*) DESC
    LIMIT 1;

    SELECT json_agg(t) INTO top_topics
    FROM (
        SELECT 
            COALESCE(NULLIF(LOWER(TRIM(task_name)), ''), 'untitled') as name,
            SUM(duration_seconds) as duration
        FROM sessions
        WHERE user_id = auth.uid()
        AND started_at >= day_start AND started_at < day_end
        AND status = 'completed'
        AND mode NOT IN ('short-break', 'long-break')
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 5
    ) t;

    SELECT COALESCE(SUM(duration_seconds), 0) INTO weekly_seconds
    FROM sessions
    WHERE user_id = auth.uid()
    AND started_at >= week_start AND started_at < (week_start + interval '1 week')
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break');

    SELECT COALESCE(SUM(duration_seconds), 0) INTO monthly_seconds
    FROM sessions
    WHERE user_id = auth.uid()
    AND started_at >= month_start AND started_at < month_end
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break');

    SELECT extract(hour from (started_at AT TIME ZONE 'America/Toronto'))::int
    INTO monthly_peak_hour
    FROM sessions
    WHERE user_id = auth.uid()
    AND started_at >= month_start AND started_at < month_end
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break')
    GROUP BY 1
    ORDER BY count(*) DESC
    LIMIT 1;

    SELECT json_agg(t) INTO monthly_top_topics
    FROM (
        SELECT 
            COALESCE(NULLIF(LOWER(TRIM(task_name)), ''), 'untitled') as name,
            SUM(duration_seconds) as duration
        FROM sessions
        WHERE user_id = auth.uid()
        AND started_at >= month_start AND started_at < month_end
        AND status = 'completed'
        AND mode NOT IN ('short-break', 'long-break')
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 8
    ) t;

    result := json_build_object(
        'daily', json_build_object(
            'total_seconds', daily_seconds,
            'longest_session', longest_session,
            'peak_hour', peak_hour,
            'top_topics', COALESCE(top_topics, '[]'::json)
        ),
        'weekly', json_build_object('total_seconds', weekly_seconds),
        'monthly', json_build_object(
            'total_seconds', monthly_seconds,
            'peak_hour', monthly_peak_hour,
            'top_topics', COALESCE(monthly_top_topics, '[]'::json)
        )
    );
    RETURN result;
END;
$$;

-- 3. get_user_history_stats: week and month boundaries in Toronto
CREATE OR REPLACE FUNCTION get_user_history_stats(target_user_id uuid, target_date date)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    day_start timestamp with time zone;
    day_end timestamp with time zone;
    week_start timestamp with time zone;
    month_start timestamp with time zone;
    month_end timestamp with time zone;
    daily_seconds bigint;
    longest_session bigint;
    peak_hour int;
    weekly_seconds bigint;
    monthly_seconds bigint;
    monthly_peak_hour int;
    monthly_top_topics json;
    top_topics json;
    result json;
BEGIN
    day_start := (target_date || ' 00:00:00')::timestamp AT TIME ZONE 'America/Toronto';
    day_end := day_start + interval '1 day';
    week_start := date_trunc('week', day_start AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto';
    month_start := date_trunc('month', day_start AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto';
    month_end := month_start + interval '1 month';

    SELECT 
        COALESCE(SUM(CASE WHEN status = 'completed' THEN duration_seconds ELSE 0 END), 0),
        COALESCE(MAX(CASE WHEN status = 'completed' THEN duration_seconds ELSE 0 END), 0)
    INTO daily_seconds, longest_session
    FROM sessions
    WHERE user_id = target_user_id
    AND started_at >= day_start AND started_at < day_end
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break');

    SELECT extract(hour from (started_at AT TIME ZONE 'America/Toronto'))::int
    INTO peak_hour
    FROM sessions
    WHERE user_id = target_user_id
    AND started_at >= day_start AND started_at < day_end
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break')
    GROUP BY 1
    ORDER BY count(*) DESC
    LIMIT 1;

    SELECT json_agg(t) INTO top_topics
    FROM (
        SELECT 
            COALESCE(NULLIF(LOWER(TRIM(task_name)), ''), 'untitled') as name,
            SUM(duration_seconds) as duration
        FROM sessions
        WHERE user_id = target_user_id
        AND started_at >= day_start AND started_at < day_end
        AND status = 'completed'
        AND mode NOT IN ('short-break', 'long-break')
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 5
    ) t;

    SELECT COALESCE(SUM(duration_seconds), 0) INTO weekly_seconds
    FROM sessions
    WHERE user_id = target_user_id
    AND started_at >= week_start AND started_at < (week_start + interval '1 week')
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break');

    SELECT COALESCE(SUM(duration_seconds), 0) INTO monthly_seconds
    FROM sessions
    WHERE user_id = target_user_id
    AND started_at >= month_start AND started_at < month_end
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break');

    SELECT extract(hour from (started_at AT TIME ZONE 'America/Toronto'))::int
    INTO monthly_peak_hour
    FROM sessions
    WHERE user_id = target_user_id
    AND started_at >= month_start AND started_at < month_end
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break')
    GROUP BY 1
    ORDER BY count(*) DESC
    LIMIT 1;

    SELECT json_agg(t) INTO monthly_top_topics
    FROM (
        SELECT 
            COALESCE(NULLIF(LOWER(TRIM(task_name)), ''), 'untitled') as name,
            SUM(duration_seconds) as duration
        FROM sessions
        WHERE user_id = target_user_id
        AND started_at >= month_start AND started_at < month_end
        AND status = 'completed'
        AND mode NOT IN ('short-break', 'long-break')
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 8
    ) t;

    result := json_build_object(
        'daily', json_build_object(
            'total_seconds', daily_seconds,
            'longest_session', longest_session,
            'peak_hour', peak_hour,
            'top_topics', COALESCE(top_topics, '[]'::json)
        ),
        'weekly', json_build_object('total_seconds', weekly_seconds),
        'monthly', json_build_object(
            'total_seconds', monthly_seconds,
            'peak_hour', monthly_peak_hour,
            'top_topics', COALESCE(monthly_top_topics, '[]'::json)
        )
    );
    RETURN result;
END;
$$;
