-- Leaderboard history and medals: historical leaderboard by date/week, medal counts, timeline, and user medal history.
-- All boundaries use America/Toronto to match get_leaderboard.

-- 1. Leaderboard for a specific date (Toronto day)
CREATE OR REPLACE FUNCTION get_leaderboard_for_date(target_date date)
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
  WITH session_stats AS (
    SELECT 
      s.user_id,
      SUM(
        CASE 
          WHEN s.status = 'completed' THEN s.duration_seconds
          WHEN s.status = 'paused' THEN s.accumulated_seconds
          WHEN s.status = 'active' AND s.last_resumed_at IS NOT NULL THEN
            LEAST(
              (s.accumulated_seconds + EXTRACT(EPOCH FROM (end_time - s.last_resumed_at)))::bigint,
              EXTRACT(EPOCH FROM (end_time - start_time))::bigint
            )
          ELSE 0
        END
      )::bigint AS seconds
    FROM sessions s
    WHERE s.started_at >= start_time
      AND s.started_at < end_time
      AND s.mode NOT IN ('short-break', 'long-break')
    GROUP BY s.user_id
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
  ORDER BY 
    COALESCE(l.seconds, 0) DESC,
    p.username ASC;
END;
$$;

-- 2. Leaderboard for a specific week (Monday 00:00 Toronto)
CREATE OR REPLACE FUNCTION get_leaderboard_for_week(week_start date)
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
  WITH session_stats AS (
    SELECT 
      s.user_id,
      SUM(
        CASE 
          WHEN s.status = 'completed' THEN s.duration_seconds
          WHEN s.status = 'paused' THEN s.accumulated_seconds
          WHEN s.status = 'active' AND s.last_resumed_at IS NOT NULL THEN
            LEAST(
              (s.accumulated_seconds + EXTRACT(EPOCH FROM (end_time - s.last_resumed_at)))::bigint,
              EXTRACT(EPOCH FROM (end_time - start_time))::bigint
            )
          ELSE 0
        END
      )::bigint AS seconds
    FROM sessions s
    WHERE s.started_at >= start_time
      AND s.started_at < end_time
      AND s.mode NOT IN ('short-break', 'long-break')
    GROUP BY s.user_id
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
  ORDER BY 
    COALESCE(l.seconds, 0) DESC,
    p.username ASC;
END;
$$;

-- 3. Medal counts per user over the last N weeks (daily + weekly podiums)
CREATE OR REPLACE FUNCTION get_leaderboard_medal_counts(weeks_back int DEFAULT 6)
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
  WITH 
  date_range AS (
    SELECT generate_series(
      (date_trunc('week', (now() AT TIME ZONE 'America/Toronto') - (weeks_back || ' weeks')::interval) AT TIME ZONE 'America/Toronto')::date,
      (now() AT TIME ZONE 'America/Toronto')::date - 1,
      '1 day'::interval
    )::date AS d
  ),
  week_range AS (
    SELECT generate_series(
      (date_trunc('week', (now() AT TIME ZONE 'America/Toronto') - (weeks_back || ' weeks')::interval) AT TIME ZONE 'America/Toronto')::date,
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
    CROSS JOIN LATERAL (SELECT * FROM get_leaderboard_for_date(dr.d)) lb
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
    CROSS JOIN LATERAL (SELECT * FROM get_leaderboard_for_week(wr.w)) lb
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

-- 4. Timeline: periods with full standings for the History tab
CREATE OR REPLACE FUNCTION get_leaderboard_timeline(weeks_back int DEFAULT 6)
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
  -- Daily periods: each day in range
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
      FROM get_leaderboard_for_date(d) lb
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

  -- Weekly periods
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
      FROM get_leaderboard_for_week(w) lb
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

-- 5. User medal history for profile page (dates and ranks 1/2/3 only)
CREATE OR REPLACE FUNCTION get_user_medal_history(target_user_id uuid, weeks_back int DEFAULT 6)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  daily_result json;
  weekly_result json;
  d date;
  w date;
  user_rank int;
  daily_arr json[] := '{}';
  weekly_arr json[] := '{}';
BEGIN
  -- Daily: for each day, get rank of target_user_id (if in top 3)
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
      FROM (SELECT * FROM get_leaderboard_for_date(d)) lb
      WHERE lb.total_seconds > 0
    ) sub
    WHERE user_id = target_user_id AND rn <= 3;

    IF user_rank IS NOT NULL THEN
      daily_arr := array_append(daily_arr, json_build_object('date', d, 'rank', user_rank));
    END IF;
  END LOOP;

  -- Weekly: for each week, get rank of target_user_id (if in top 3)
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
      FROM (SELECT * FROM get_leaderboard_for_week(w)) lb
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
