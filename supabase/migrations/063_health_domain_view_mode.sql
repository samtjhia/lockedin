-- Add a first-class session domain and support All/Study/Health analytics filtering.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS domain text;

UPDATE public.sessions
SET domain = 'study'
WHERE domain IS NULL;

ALTER TABLE public.sessions
  ALTER COLUMN domain SET DEFAULT 'study';

ALTER TABLE public.sessions
  ALTER COLUMN domain SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sessions_domain_check'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_domain_check
      CHECK (domain IN ('study', 'health'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS sessions_user_started_at_domain_idx
  ON public.sessions (user_id, started_at DESC, domain);

CREATE INDEX IF NOT EXISTS sessions_started_at_domain_status_idx
  ON public.sessions (started_at, domain, status);

CREATE OR REPLACE FUNCTION public.session_matches_view_mode(session_domain text, view_mode text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(coalesce(view_mode, 'all'))
    WHEN 'study' THEN coalesce(session_domain, 'study') = 'study'
    WHEN 'health' THEN coalesce(session_domain, 'study') = 'health'
    ELSE TRUE
  END;
$$;

DROP FUNCTION IF EXISTS get_leaderboard(text);
DROP FUNCTION IF EXISTS get_leaderboard(text, text);
CREATE OR REPLACE FUNCTION get_leaderboard(period text, view_mode text DEFAULT 'all')
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
  end_time timestamp with time zone;
BEGIN
  IF period = 'weekly' THEN
    start_time := date_trunc('week', now() AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto';
    end_time := start_time + interval '1 week';
  ELSE
    start_time := date_trunc('day', now() AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto';
    end_time := start_time + interval '1 day';
  END IF;

  RETURN QUERY
  WITH live_one AS (
    SELECT DISTINCT ON (s.user_id) s.user_id,
      (CASE
        WHEN s.status = 'active' AND s.last_resumed_at IS NOT NULL THEN LEAST(
          (COALESCE(s.accumulated_seconds, 0) + EXTRACT(EPOCH FROM (now() - s.last_resumed_at)))::bigint,
          EXTRACT(EPOCH FROM (end_time - start_time))::bigint
        )
        WHEN s.status = 'paused' THEN COALESCE(s.accumulated_seconds, 0)::bigint
        ELSE 0
      END) AS sec
    FROM sessions s
    WHERE s.started_at >= start_time
      AND s.started_at < end_time
      AND s.mode NOT IN ('short-break', 'long-break')
      AND s.status IN ('active', 'paused')
      AND public.session_matches_view_mode(s.domain, view_mode)
    ORDER BY s.user_id, s.last_resumed_at DESC NULLS LAST
  ),
  completed_sum AS (
    SELECT s.user_id, SUM(COALESCE(s.duration_seconds, 0))::bigint AS sec
    FROM sessions s
    WHERE s.started_at >= start_time
      AND s.started_at < end_time
      AND s.mode NOT IN ('short-break', 'long-break')
      AND s.status = 'completed'
      AND public.session_matches_view_mode(s.domain, view_mode)
    GROUP BY s.user_id
  ),
  session_stats AS (
    SELECT COALESCE(c.user_id, l.user_id) AS user_id,
      COALESCE(c.sec, 0) + COALESCE(l.sec, 0) AS seconds
    FROM completed_sum c
    FULL OUTER JOIN live_one l ON l.user_id = c.user_id
  )
  SELECT
    p.id AS user_id,
    p.username,
    p.avatar_url,
    p.is_verified,
    COALESCE(
      (
        SELECT sess.status
        FROM sessions sess
        WHERE sess.user_id = p.id
          AND sess.status IN ('active', 'paused')
          AND public.session_matches_view_mode(sess.domain, view_mode)
        ORDER BY sess.last_resumed_at DESC NULLS LAST
        LIMIT 1
      ),
      CASE WHEN lower(coalesce(view_mode, 'all')) = 'all' THEN p.current_status ELSE NULL END
    ) AS current_status,
    COALESCE(
      (
        SELECT sess.task_name
        FROM sessions sess
        WHERE sess.user_id = p.id
          AND sess.status IN ('active', 'paused')
          AND public.session_matches_view_mode(sess.domain, view_mode)
        ORDER BY sess.last_resumed_at DESC NULLS LAST
        LIMIT 1
      ),
      CASE WHEN lower(coalesce(view_mode, 'all')) = 'all' THEN p.current_task ELSE NULL END
    ) AS current_task,
    COALESCE(s.seconds, 0)::bigint AS total_seconds
  FROM public.profiles p
  LEFT JOIN session_stats s ON s.user_id = p.id
  WHERE p.is_verified = true
    AND p.hidden_at IS NULL
  ORDER BY COALESCE(s.seconds, 0) DESC, p.username ASC;
END;
$$;

-- Drop dependent wrappers before replacing date/week leaderboard functions.
DROP FUNCTION IF EXISTS get_leaderboard_medal_counts(integer);
DROP FUNCTION IF EXISTS get_leaderboard_medal_counts(integer, text);
DROP FUNCTION IF EXISTS get_leaderboard_timeline(integer);
DROP FUNCTION IF EXISTS get_leaderboard_timeline(integer, text);
DROP FUNCTION IF EXISTS get_user_medal_history(uuid, integer);
DROP FUNCTION IF EXISTS get_user_medal_history(uuid, integer, text);

DROP FUNCTION IF EXISTS get_leaderboard_for_date(date);
DROP FUNCTION IF EXISTS get_leaderboard_for_date(date, text);
CREATE OR REPLACE FUNCTION get_leaderboard_for_date(target_date date, view_mode text DEFAULT 'all')
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
  end_time timestamp with time zone;
BEGIN
  start_time := (target_date || ' 00:00:00')::timestamp AT TIME ZONE 'America/Toronto';
  end_time := start_time + interval '1 day';

  RETURN QUERY
  WITH live_one AS (
    SELECT DISTINCT ON (s.user_id) s.user_id,
      (CASE
        WHEN s.status = 'active' AND s.last_resumed_at IS NOT NULL THEN LEAST(
          (COALESCE(s.accumulated_seconds, 0) + EXTRACT(EPOCH FROM (end_time - s.last_resumed_at)))::bigint,
          EXTRACT(EPOCH FROM (end_time - start_time))::bigint
        )
        WHEN s.status = 'paused' THEN LEAST(COALESCE(s.accumulated_seconds, 0)::bigint, EXTRACT(EPOCH FROM (end_time - start_time))::bigint)
        ELSE 0
      END) AS sec
    FROM sessions s
    WHERE s.started_at >= start_time
      AND s.started_at < end_time
      AND s.mode NOT IN ('short-break', 'long-break')
      AND s.status IN ('active', 'paused')
      AND public.session_matches_view_mode(s.domain, view_mode)
    ORDER BY s.user_id, s.last_resumed_at DESC NULLS LAST
  ),
  completed_sum AS (
    SELECT s.user_id, SUM(COALESCE(s.duration_seconds, 0))::bigint AS sec
    FROM sessions s
    WHERE s.started_at >= start_time
      AND s.started_at < end_time
      AND s.mode NOT IN ('short-break', 'long-break')
      AND s.status = 'completed'
      AND public.session_matches_view_mode(s.domain, view_mode)
    GROUP BY s.user_id
  ),
  session_stats AS (
    SELECT COALESCE(c.user_id, l.user_id) AS user_id,
      COALESCE(c.sec, 0) + COALESCE(l.sec, 0) AS seconds
    FROM completed_sum c
    FULL OUTER JOIN live_one l ON l.user_id = c.user_id
  )
  SELECT
    p.id AS user_id,
    p.username,
    p.avatar_url,
    p.is_verified,
    NULL::text AS current_status,
    NULL::text AS current_task,
    COALESCE(l.seconds, 0) AS total_seconds
  FROM public.profiles p
  LEFT JOIN session_stats l ON l.user_id = p.id
  WHERE p.is_verified = true
    AND p.hidden_at IS NULL
  ORDER BY COALESCE(l.seconds, 0) DESC, p.username ASC;
END;
$$;

DROP FUNCTION IF EXISTS get_leaderboard_for_week(date);
DROP FUNCTION IF EXISTS get_leaderboard_for_week(date, text);
CREATE OR REPLACE FUNCTION get_leaderboard_for_week(week_start date, view_mode text DEFAULT 'all')
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
  end_time timestamp with time zone;
BEGIN
  start_time := (week_start || ' 00:00:00')::timestamp AT TIME ZONE 'America/Toronto';
  end_time := start_time + interval '1 week';

  RETURN QUERY
  WITH live_one AS (
    SELECT DISTINCT ON (s.user_id) s.user_id,
      (CASE
        WHEN s.status = 'active' AND s.last_resumed_at IS NOT NULL THEN LEAST(
          (COALESCE(s.accumulated_seconds, 0) + EXTRACT(EPOCH FROM (end_time - s.last_resumed_at)))::bigint,
          EXTRACT(EPOCH FROM (end_time - start_time))::bigint
        )
        WHEN s.status = 'paused' THEN LEAST(COALESCE(s.accumulated_seconds, 0)::bigint, EXTRACT(EPOCH FROM (end_time - start_time))::bigint)
        ELSE 0
      END) AS sec
    FROM sessions s
    WHERE s.started_at >= start_time
      AND s.started_at < end_time
      AND s.mode NOT IN ('short-break', 'long-break')
      AND s.status IN ('active', 'paused')
      AND public.session_matches_view_mode(s.domain, view_mode)
    ORDER BY s.user_id, s.last_resumed_at DESC NULLS LAST
  ),
  completed_sum AS (
    SELECT s.user_id, SUM(COALESCE(s.duration_seconds, 0))::bigint AS sec
    FROM sessions s
    WHERE s.started_at >= start_time
      AND s.started_at < end_time
      AND s.mode NOT IN ('short-break', 'long-break')
      AND s.status = 'completed'
      AND public.session_matches_view_mode(s.domain, view_mode)
    GROUP BY s.user_id
  ),
  session_stats AS (
    SELECT COALESCE(c.user_id, l.user_id) AS user_id,
      COALESCE(c.sec, 0) + COALESCE(l.sec, 0) AS seconds
    FROM completed_sum c
    FULL OUTER JOIN live_one l ON l.user_id = c.user_id
  )
  SELECT
    p.id AS user_id,
    p.username,
    p.avatar_url,
    p.is_verified,
    NULL::text AS current_status,
    NULL::text AS current_task,
    COALESCE(l.seconds, 0) AS total_seconds
  FROM public.profiles p
  LEFT JOIN session_stats l ON l.user_id = p.id
  WHERE p.is_verified = true
    AND p.hidden_at IS NULL
  ORDER BY COALESCE(l.seconds, 0) DESC, p.username ASC;
END;
$$;

DROP FUNCTION IF EXISTS get_heatmap_data(timestamptz);
DROP FUNCTION IF EXISTS get_heatmap_data(timestamptz, text);
CREATE OR REPLACE FUNCTION get_heatmap_data(start_date timestamptz, view_mode text DEFAULT 'all')
RETURNS TABLE (
  date text,
  count bigint,
  level int
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH daily_time AS (
    SELECT
      to_char(s.started_at AT TIME ZONE 'America/Toronto', 'YYYY-MM-DD') AS day_str,
      COALESCE(SUM(GREATEST(0, COALESCE(s.duration_seconds, 0)) / 60), 0)::bigint AS total_minutes
    FROM sessions s
    WHERE s.user_id = auth.uid()
      AND s.started_at >= start_date
      AND s.status = 'completed'
      AND s.mode NOT IN ('short-break', 'long-break')
      AND public.session_matches_view_mode(s.domain, view_mode)
    GROUP BY 1
  )
  SELECT
    dt.day_str AS date,
    dt.total_minutes AS count,
    CASE
      WHEN dt.total_minutes = 0 THEN 0
      WHEN dt.total_minutes <= 30 THEN 1
      WHEN dt.total_minutes <= 60 THEN 2
      WHEN dt.total_minutes <= 120 THEN 3
      ELSE 4
    END AS level
  FROM daily_time dt;
END;
$$;

DROP FUNCTION IF EXISTS get_user_heatmap_data(uuid, timestamptz);
DROP FUNCTION IF EXISTS get_user_heatmap_data(uuid, timestamptz, text);
CREATE OR REPLACE FUNCTION get_user_heatmap_data(
  target_user_id uuid,
  start_date timestamptz,
  view_mode text DEFAULT 'all'
)
RETURNS TABLE (
  date text,
  count bigint,
  level int
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH daily_time AS (
    SELECT
      to_char(s.started_at AT TIME ZONE 'America/Toronto', 'YYYY-MM-DD') AS day_str,
      COALESCE(SUM(GREATEST(0, COALESCE(s.duration_seconds, 0)) / 60), 0)::bigint AS total_minutes
    FROM sessions s
    WHERE s.user_id = target_user_id
      AND s.started_at >= start_date
      AND s.status = 'completed'
      AND s.mode NOT IN ('short-break', 'long-break')
      AND public.session_matches_view_mode(s.domain, view_mode)
    GROUP BY 1
  )
  SELECT
    dt.day_str AS date,
    dt.total_minutes AS count,
    CASE
      WHEN dt.total_minutes = 0 THEN 0
      WHEN dt.total_minutes <= 30 THEN 1
      WHEN dt.total_minutes <= 60 THEN 2
      WHEN dt.total_minutes <= 120 THEN 3
      ELSE 4
    END AS level
  FROM daily_time dt;
END;
$$;

DROP FUNCTION IF EXISTS get_daily_metrics(date);
DROP FUNCTION IF EXISTS get_daily_metrics(date, text);
CREATE OR REPLACE FUNCTION get_daily_metrics(
  target_date date DEFAULT current_date,
  view_mode text DEFAULT 'all'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  hourly_data json;
  topic_data json;
  start_of_day timestamp with time zone;
  end_of_day timestamp with time zone;
BEGIN
  start_of_day := (target_date || ' 00:00:00')::timestamp AT TIME ZONE 'America/Toronto';
  end_of_day := start_of_day + interval '1 day';

  SELECT json_agg(h) INTO hourly_data
  FROM (
    SELECT
      extract(hour FROM (started_at AT TIME ZONE 'America/Toronto')) AS hour,
      round(sum(coalesce(duration_seconds, 0))::numeric / 60, 2) AS minutes
    FROM sessions
    WHERE user_id = auth.uid()
      AND started_at >= start_of_day
      AND started_at < end_of_day
      AND status = 'completed'
      AND mode NOT IN ('short-break', 'long-break')
      AND public.session_matches_view_mode(domain, view_mode)
    GROUP BY 1
    ORDER BY 1
  ) h;

  SELECT json_agg(t) INTO topic_data
  FROM (
    SELECT
      CASE
        WHEN task_name IS NULL OR trim(task_name) = '' THEN 'Untitled'
        ELSE initcap(lower(trim(task_name)))
      END AS topic,
      count(*) AS sessions_count,
      round(sum(coalesce(duration_seconds, 0))::numeric / 60, 2) AS total_minutes
    FROM sessions
    WHERE user_id = auth.uid()
      AND started_at >= start_of_day
      AND started_at < end_of_day
      AND status = 'completed'
      AND mode NOT IN ('short-break', 'long-break')
      AND public.session_matches_view_mode(domain, view_mode)
    GROUP BY 1
    ORDER BY 3 DESC
    LIMIT 5
  ) t;

  RETURN json_build_object(
    'hourly', coalesce(hourly_data, '[]'::json),
    'topics', coalesce(topic_data, '[]'::json)
  );
END;
$$;

DROP FUNCTION IF EXISTS get_day_metrics_log(date);
DROP FUNCTION IF EXISTS get_day_metrics_log(date, text);
CREATE OR REPLACE FUNCTION get_day_metrics_log(target_date date, view_mode text DEFAULT 'all')
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
  start_time := (target_date || ' 00:00:00')::timestamp AT TIME ZONE 'America/Toronto';
  end_time := start_time + interval '1 day';

  RETURN QUERY
  SELECT
    s.id,
    COALESCE(NULLIF(trim(s.task_name), ''), 'Untitled') AS task_name,
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
    AND s.status = 'completed'
    AND s.mode NOT IN ('short-break', 'long-break')
    AND public.session_matches_view_mode(s.domain, view_mode)
  ORDER BY s.started_at DESC;
END;
$$;

DROP FUNCTION IF EXISTS get_user_top_tasks(uuid, text);
DROP FUNCTION IF EXISTS get_user_top_tasks(uuid, text, text);
CREATE OR REPLACE FUNCTION get_user_top_tasks(target_user_id uuid, period text, view_mode text DEFAULT 'all')
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
      NULL::timestamp with time zone AS s_at
    FROM sessions s
    WHERE s.user_id = target_user_id
      AND s.started_at >= start_time
      AND s.mode NOT IN ('short-break', 'long-break')
      AND public.session_matches_view_mode(s.domain, view_mode)
    GROUP BY 1
    ORDER BY 2 DESC NULLS LAST
    LIMIT 3;
  ELSE
    start_time := date_trunc('day', now() AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto';

    RETURN QUERY
    SELECT
      COALESCE(NULLIF(trim(s.task_name), ''), 'Untitled') AS t_name,
      (
        CASE
          WHEN s.status = 'completed' THEN s.duration_seconds
          WHEN s.status = 'paused' THEN s.accumulated_seconds
          WHEN s.status = 'active' THEN (s.accumulated_seconds + EXTRACT(EPOCH FROM (now() - s.last_resumed_at)))
          ELSE 0
        END
      )::bigint AS seconds,
      s.started_at AS s_at
    FROM sessions s
    WHERE s.user_id = target_user_id
      AND s.started_at >= start_time
      AND s.mode NOT IN ('short-break', 'long-break')
      AND public.session_matches_view_mode(s.domain, view_mode)
    ORDER BY s.started_at DESC;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS get_history_stats(date);
DROP FUNCTION IF EXISTS get_history_stats(date, text);
CREATE OR REPLACE FUNCTION get_history_stats(target_date date, view_mode text DEFAULT 'all')
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
  WHERE user_id = auth.uid()
    AND started_at >= day_start
    AND started_at < day_end
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break')
    AND public.session_matches_view_mode(domain, view_mode);

  SELECT extract(hour FROM (started_at AT TIME ZONE 'America/Toronto'))::int
  INTO peak_hour
  FROM sessions
  WHERE user_id = auth.uid()
    AND started_at >= day_start
    AND started_at < day_end
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break')
    AND public.session_matches_view_mode(domain, view_mode)
  GROUP BY 1
  ORDER BY count(*) DESC
  LIMIT 1;

  SELECT json_agg(t) INTO top_topics
  FROM (
    SELECT
      COALESCE(NULLIF(LOWER(TRIM(task_name)), ''), 'untitled') AS name,
      SUM(duration_seconds) AS duration
    FROM sessions
    WHERE user_id = auth.uid()
      AND started_at >= day_start
      AND started_at < day_end
      AND status = 'completed'
      AND mode NOT IN ('short-break', 'long-break')
      AND public.session_matches_view_mode(domain, view_mode)
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 5
  ) t;

  SELECT COALESCE(SUM(duration_seconds), 0)
  INTO weekly_seconds
  FROM sessions
  WHERE user_id = auth.uid()
    AND started_at >= week_start
    AND started_at < (week_start + interval '1 week')
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break')
    AND public.session_matches_view_mode(domain, view_mode);

  SELECT COALESCE(SUM(duration_seconds), 0)
  INTO monthly_seconds
  FROM sessions
  WHERE user_id = auth.uid()
    AND started_at >= month_start
    AND started_at < month_end
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break')
    AND public.session_matches_view_mode(domain, view_mode);

  SELECT extract(hour FROM (started_at AT TIME ZONE 'America/Toronto'))::int
  INTO monthly_peak_hour
  FROM sessions
  WHERE user_id = auth.uid()
    AND started_at >= month_start
    AND started_at < month_end
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break')
    AND public.session_matches_view_mode(domain, view_mode)
  GROUP BY 1
  ORDER BY count(*) DESC
  LIMIT 1;

  SELECT json_agg(t) INTO monthly_top_topics
  FROM (
    SELECT
      COALESCE(NULLIF(LOWER(TRIM(task_name)), ''), 'untitled') AS name,
      SUM(duration_seconds) AS duration
    FROM sessions
    WHERE user_id = auth.uid()
      AND started_at >= month_start
      AND started_at < month_end
      AND status = 'completed'
      AND mode NOT IN ('short-break', 'long-break')
      AND public.session_matches_view_mode(domain, view_mode)
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

DROP FUNCTION IF EXISTS get_user_history_stats(uuid, date);
DROP FUNCTION IF EXISTS get_user_history_stats(uuid, date, text);
CREATE OR REPLACE FUNCTION get_user_history_stats(target_user_id uuid, target_date date, view_mode text DEFAULT 'all')
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
    AND started_at >= day_start
    AND started_at < day_end
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break')
    AND public.session_matches_view_mode(domain, view_mode);

  SELECT extract(hour FROM (started_at AT TIME ZONE 'America/Toronto'))::int
  INTO peak_hour
  FROM sessions
  WHERE user_id = target_user_id
    AND started_at >= day_start
    AND started_at < day_end
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break')
    AND public.session_matches_view_mode(domain, view_mode)
  GROUP BY 1
  ORDER BY count(*) DESC
  LIMIT 1;

  SELECT json_agg(t) INTO top_topics
  FROM (
    SELECT
      COALESCE(NULLIF(LOWER(TRIM(task_name)), ''), 'untitled') AS name,
      SUM(duration_seconds) AS duration
    FROM sessions
    WHERE user_id = target_user_id
      AND started_at >= day_start
      AND started_at < day_end
      AND status = 'completed'
      AND mode NOT IN ('short-break', 'long-break')
      AND public.session_matches_view_mode(domain, view_mode)
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 5
  ) t;

  SELECT COALESCE(SUM(duration_seconds), 0)
  INTO weekly_seconds
  FROM sessions
  WHERE user_id = target_user_id
    AND started_at >= week_start
    AND started_at < (week_start + interval '1 week')
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break')
    AND public.session_matches_view_mode(domain, view_mode);

  SELECT COALESCE(SUM(duration_seconds), 0)
  INTO monthly_seconds
  FROM sessions
  WHERE user_id = target_user_id
    AND started_at >= month_start
    AND started_at < month_end
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break')
    AND public.session_matches_view_mode(domain, view_mode);

  SELECT extract(hour FROM (started_at AT TIME ZONE 'America/Toronto'))::int
  INTO monthly_peak_hour
  FROM sessions
  WHERE user_id = target_user_id
    AND started_at >= month_start
    AND started_at < month_end
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break')
    AND public.session_matches_view_mode(domain, view_mode)
  GROUP BY 1
  ORDER BY count(*) DESC
  LIMIT 1;

  SELECT json_agg(t) INTO monthly_top_topics
  FROM (
    SELECT
      COALESCE(NULLIF(LOWER(TRIM(task_name)), ''), 'untitled') AS name,
      SUM(duration_seconds) AS duration
    FROM sessions
    WHERE user_id = target_user_id
      AND started_at >= month_start
      AND started_at < month_end
      AND status = 'completed'
      AND mode NOT IN ('short-break', 'long-break')
      AND public.session_matches_view_mode(domain, view_mode)
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

DROP FUNCTION IF EXISTS get_leaderboard_medal_counts(integer);
DROP FUNCTION IF EXISTS get_leaderboard_medal_counts(integer, text);
CREATE OR REPLACE FUNCTION get_leaderboard_medal_counts(weeks_back int DEFAULT NULL, view_mode text DEFAULT 'all')
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  gold_daily bigint,
  silver_daily bigint,
  bronze_daily bigint,
  gold_weekly bigint,
  silver_weekly bigint,
  bronze_weekly bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH bounds AS (
    SELECT
      COALESCE(
        CASE
          WHEN weeks_back IS NULL THEN (
            SELECT (date_trunc('week', MIN(s.started_at AT TIME ZONE 'America/Toronto')) AT TIME ZONE 'America/Toronto')::date
            FROM sessions s
            WHERE s.mode NOT IN ('short-break', 'long-break')
              AND public.session_matches_view_mode(s.domain, view_mode)
          )
          ELSE (date_trunc('week', (now() AT TIME ZONE 'America/Toronto') - (weeks_back || ' weeks')::interval) AT TIME ZONE 'America/Toronto')::date
        END,
        (date_trunc('week', now() AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto')::date
      ) AS start_week,
      (now() AT TIME ZONE 'America/Toronto')::date AS today
  ),
  date_range AS (
    SELECT generate_series(
      (SELECT start_week FROM bounds),
      (SELECT today FROM bounds) - 1,
      '1 day'::interval
    )::date AS d
  ),
  week_range AS (
    SELECT generate_series(
      (SELECT start_week FROM bounds),
      (date_trunc('week', (now() AT TIME ZONE 'America/Toronto') - '1 week'::interval) AT TIME ZONE 'America/Toronto')::date,
      '7 days'::interval
    )::date AS w
  ),
  daily_ranked AS (
    SELECT
      dr.d,
      lb.user_id AS uid,
      row_number() OVER (PARTITION BY dr.d ORDER BY lb.total_seconds DESC, lb.username ASC) AS rn
    FROM date_range dr
    CROSS JOIN LATERAL (SELECT * FROM get_leaderboard_for_date(dr.d, view_mode)) lb
    WHERE lb.total_seconds > 0
  ),
  daily_medals AS (
    SELECT
      uid,
      SUM(CASE WHEN rn = 1 THEN 1 ELSE 0 END)::bigint AS g,
      SUM(CASE WHEN rn = 2 THEN 1 ELSE 0 END)::bigint AS s,
      SUM(CASE WHEN rn = 3 THEN 1 ELSE 0 END)::bigint AS b
    FROM daily_ranked
    WHERE rn <= 3
    GROUP BY uid
  ),
  weekly_ranked AS (
    SELECT
      wr.w,
      lb.user_id AS uid,
      row_number() OVER (PARTITION BY wr.w ORDER BY lb.total_seconds DESC, lb.username ASC) AS rn
    FROM week_range wr
    CROSS JOIN LATERAL (SELECT * FROM get_leaderboard_for_week(wr.w, view_mode)) lb
    WHERE lb.total_seconds > 0
  ),
  weekly_medals AS (
    SELECT
      uid,
      SUM(CASE WHEN rn = 1 THEN 1 ELSE 0 END)::bigint AS g,
      SUM(CASE WHEN rn = 2 THEN 1 ELSE 0 END)::bigint AS s,
      SUM(CASE WHEN rn = 3 THEN 1 ELSE 0 END)::bigint AS b
    FROM weekly_ranked
    WHERE rn <= 3
    GROUP BY uid
  )
  SELECT
    p.id AS user_id,
    p.username,
    p.avatar_url,
    COALESCE(dm.g, 0) AS gold_daily,
    COALESCE(dm.s, 0) AS silver_daily,
    COALESCE(dm.b, 0) AS bronze_daily,
    COALESCE(wm.g, 0) AS gold_weekly,
    COALESCE(wm.s, 0) AS silver_weekly,
    COALESCE(wm.b, 0) AS bronze_weekly
  FROM public.profiles p
  LEFT JOIN daily_medals dm ON dm.uid = p.id
  LEFT JOIN weekly_medals wm ON wm.uid = p.id
  WHERE p.is_verified = true
    AND p.hidden_at IS NULL
  ORDER BY
    (COALESCE(dm.g, 0) + COALESCE(wm.g, 0)) DESC,
    (COALESCE(dm.s, 0) + COALESCE(wm.s, 0)) DESC,
    (COALESCE(dm.b, 0) + COALESCE(wm.b, 0)) DESC,
    p.username ASC;
END;
$$;

DROP FUNCTION IF EXISTS get_leaderboard_timeline(integer);
DROP FUNCTION IF EXISTS get_leaderboard_timeline(integer, text);
CREATE OR REPLACE FUNCTION get_leaderboard_timeline(weeks_back int DEFAULT 6, view_mode text DEFAULT 'all')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json := '[]'::json;
  period_row json;
  day_standings json;
  week_standings json;
  periods json[] := '{}';
  d date;
  w date;
BEGIN
  FOR d IN
    SELECT generate_series(
      (date_trunc('week', (now() AT TIME ZONE 'America/Toronto') - (weeks_back || ' weeks')::interval) AT TIME ZONE 'America/Toronto')::date,
      (now() AT TIME ZONE 'America/Toronto')::date - 1,
      '1 day'::interval
    )::date
  LOOP
    SELECT json_agg(
      json_build_object('rank', sub.rn, 'user_id', sub.user_id, 'username', sub.username, 'total_seconds', sub.total_seconds)
      ORDER BY sub.total_seconds DESC, sub.username ASC
    ) INTO day_standings
    FROM (
      SELECT lb.user_id, lb.username, lb.total_seconds,
        row_number() OVER (ORDER BY lb.total_seconds DESC, lb.username ASC) AS rn
      FROM get_leaderboard_for_date(d, view_mode) lb
      WHERE lb.total_seconds > 0
    ) sub;

    period_row := json_build_object(
      'period_type', 'daily',
      'period_label', to_char(d, 'Mon DD'),
      'period_date', d,
      'standings', COALESCE(day_standings, '[]'::json)
    );
    periods := array_append(periods, period_row);
  END LOOP;

  FOR w IN
    SELECT generate_series(
      (date_trunc('week', (now() AT TIME ZONE 'America/Toronto') - (weeks_back || ' weeks')::interval) AT TIME ZONE 'America/Toronto')::date,
      (date_trunc('week', (now() AT TIME ZONE 'America/Toronto') - '1 week'::interval) AT TIME ZONE 'America/Toronto')::date,
      '7 days'::interval
    )::date
  LOOP
    SELECT json_agg(
      json_build_object('rank', sub.rn, 'user_id', sub.user_id, 'username', sub.username, 'total_seconds', sub.total_seconds)
      ORDER BY sub.total_seconds DESC, sub.username ASC
    ) INTO week_standings
    FROM (
      SELECT lb.user_id, lb.username, lb.total_seconds,
        row_number() OVER (ORDER BY lb.total_seconds DESC, lb.username ASC) AS rn
      FROM get_leaderboard_for_week(w, view_mode) lb
      WHERE lb.total_seconds > 0
    ) sub;

    period_row := json_build_object(
      'period_type', 'weekly',
      'period_label', 'Week of ' || to_char(w, 'Mon DD'),
      'period_date', w,
      'standings', COALESCE(week_standings, '[]'::json)
    );
    periods := array_append(periods, period_row);
  END LOOP;

  SELECT array_to_json(periods) INTO result;
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS get_user_medal_history(uuid, integer);
DROP FUNCTION IF EXISTS get_user_medal_history(uuid, integer, text);
CREATE OR REPLACE FUNCTION get_user_medal_history(target_user_id uuid, weeks_back int DEFAULT 6, view_mode text DEFAULT 'all')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  d date;
  w date;
  user_rank int;
  daily_arr json[] := '{}';
  weekly_arr json[] := '{}';
BEGIN
  FOR d IN
    SELECT generate_series(
      (date_trunc('week', (now() AT TIME ZONE 'America/Toronto') - (weeks_back || ' weeks')::interval) AT TIME ZONE 'America/Toronto')::date,
      (now() AT TIME ZONE 'America/Toronto')::date - 1,
      '1 day'::interval
    )::date
  LOOP
    SELECT rn INTO user_rank
    FROM (
      SELECT lb.user_id, row_number() OVER (ORDER BY lb.total_seconds DESC, lb.username ASC) AS rn
      FROM (SELECT * FROM get_leaderboard_for_date(d, view_mode)) lb
      WHERE lb.total_seconds > 0
    ) sub
    WHERE user_id = target_user_id AND rn <= 3;

    IF user_rank IS NOT NULL THEN
      daily_arr := array_append(daily_arr, json_build_object('date', d, 'rank', user_rank));
    END IF;
  END LOOP;

  FOR w IN
    SELECT generate_series(
      (date_trunc('week', (now() AT TIME ZONE 'America/Toronto') - (weeks_back || ' weeks')::interval) AT TIME ZONE 'America/Toronto')::date,
      (date_trunc('week', (now() AT TIME ZONE 'America/Toronto') - '1 week'::interval) AT TIME ZONE 'America/Toronto')::date,
      '7 days'::interval
    )::date
  LOOP
    SELECT rn INTO user_rank
    FROM (
      SELECT lb.user_id, row_number() OVER (ORDER BY lb.total_seconds DESC, lb.username ASC) AS rn
      FROM (SELECT * FROM get_leaderboard_for_week(w, view_mode)) lb
      WHERE lb.total_seconds > 0
    ) sub
    WHERE user_id = target_user_id AND rn <= 3;

    IF user_rank IS NOT NULL THEN
      weekly_arr := array_append(weekly_arr, json_build_object('week_start', w, 'rank', user_rank));
    END IF;
  END LOOP;

  RETURN json_build_object(
    'daily', array_to_json(daily_arr),
    'weekly', array_to_json(weekly_arr)
  );
END;
$$;
