-- Keep "all" medal views focused on study sessions to avoid skew.
-- Health medals remain available in explicit health view.

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
DECLARE
  medal_view_mode text := CASE
    WHEN lower(coalesce(view_mode, 'all')) = 'all' THEN 'study'
    ELSE lower(coalesce(view_mode, 'all'))
  END;
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
              AND public.session_matches_view_mode(s.domain, medal_view_mode)
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
    CROSS JOIN LATERAL (SELECT * FROM get_leaderboard_for_date(dr.d, medal_view_mode)) lb
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
    CROSS JOIN LATERAL (SELECT * FROM get_leaderboard_for_week(wr.w, medal_view_mode)) lb
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
  medal_view_mode text := CASE
    WHEN lower(coalesce(view_mode, 'all')) = 'all' THEN 'study'
    ELSE lower(coalesce(view_mode, 'all'))
  END;
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
      FROM get_leaderboard_for_date(d, medal_view_mode) lb
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
      FROM get_leaderboard_for_week(w, medal_view_mode) lb
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
  medal_view_mode text := CASE
    WHEN lower(coalesce(view_mode, 'all')) = 'all' THEN 'study'
    ELSE lower(coalesce(view_mode, 'all'))
  END;
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
      FROM (SELECT * FROM get_leaderboard_for_date(d, medal_view_mode)) lb
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
      FROM (SELECT * FROM get_leaderboard_for_week(w, medal_view_mode)) lb
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
