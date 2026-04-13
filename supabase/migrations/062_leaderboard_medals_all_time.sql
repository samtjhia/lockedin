-- Allow leaderboard medal counts to support all-time range when weeks_back is NULL.
CREATE OR REPLACE FUNCTION get_leaderboard_medal_counts(weeks_back int DEFAULT NULL)
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
