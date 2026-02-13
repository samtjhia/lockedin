-- Get extended stats for history page
-- Includes:
-- 1. Daily Stats (Grade, Total Time, Longest Session, Peak Hour)
-- 2. Weekly Stats (Grade, Total Time) for the week containing the date
-- 3. Monthly Stats (Grade, Total Time) for the month containing the date

CREATE OR REPLACE FUNCTION get_history_stats(target_date date)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    -- Timestamps
    day_start timestamp with time zone;
    day_end timestamp with time zone;
    week_start timestamp with time zone;
    month_start timestamp with time zone;
    month_end timestamp with time zone;
    
    -- Stats
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
    -- Configure Timezone (Toronto)
    day_start := (target_date || ' 00:00:00')::timestamp at time zone 'America/Toronto';
    day_end := day_start + interval '1 day';
    
    -- Week Start (Monday) relative to target date
    week_start := date_trunc('week', day_start);
    -- Month Start relative to target date
    month_start := date_trunc('month', day_start);
    month_end := month_start + interval '1 month';

    -- 1. DAILY STATS
    SELECT 
        COALESCE(SUM(
            CASE 
                WHEN status = 'completed' THEN duration_seconds
                ELSE 0 
            END
        ), 0),
        COALESCE(MAX(
            CASE 
                WHEN status = 'completed' THEN duration_seconds 
                ELSE 0 
            END
        ), 0)
    INTO daily_seconds, longest_session
    FROM sessions
    WHERE user_id = auth.uid()
    AND started_at >= day_start AND started_at < day_end
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break');

    -- Peak Hour (Mode)
    SELECT 
        extract(hour from (started_at at time zone 'America/Toronto'))::int
    INTO peak_hour
    FROM sessions
    WHERE user_id = auth.uid()
    AND started_at >= day_start AND started_at < day_end
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break')
    GROUP BY 1
    ORDER BY count(*) DESC
    LIMIT 1;

    -- Top Topics (Daily)
    SELECT json_agg(t) INTO top_topics
    FROM (
        SELECT 
            -- Simple normalization: lowercase and trim. 
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

    -- 2. WEEKLY STATS (Total Duration only for Grade)
    SELECT 
        COALESCE(SUM(duration_seconds), 0)
    INTO weekly_seconds
    FROM sessions
    WHERE user_id = auth.uid()
    AND started_at >= week_start 
    AND started_at < (week_start + interval '1 week')
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break');

    -- 3. MONTHLY STATS (Total Duration, Peak Hour, Top Topics)
    SELECT 
        COALESCE(SUM(duration_seconds), 0)
    INTO monthly_seconds
    FROM sessions
    WHERE user_id = auth.uid()
    AND started_at >= month_start 
    AND started_at < month_end
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break');

    -- Peak Hour (Month)
    SELECT 
        extract(hour from (started_at at time zone 'America/Toronto'))::int
    INTO monthly_peak_hour
    FROM sessions
    WHERE user_id = auth.uid()
    AND started_at >= month_start AND started_at < month_end
    AND status = 'completed'
    AND mode NOT IN ('short-break', 'long-break')
    GROUP BY 1
    ORDER BY count(*) DESC
    LIMIT 1;

    -- Top Topics (Monthly)
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
    
    -- Build Result JSON
    result := json_build_object(
        'daily', json_build_object(
            'total_seconds', daily_seconds,
            'longest_session', longest_session,
            'peak_hour', peak_hour,
            'top_topics', COALESCE(top_topics, '[]'::json)
        ),
        'weekly', json_build_object(
            'total_seconds', weekly_seconds
        ),
        'monthly', json_build_object(
            'total_seconds', monthly_seconds,
            'peak_hour', monthly_peak_hour,
            'top_topics', COALESCE(monthly_top_topics, '[]'::json)
        )
    );

    RETURN result;
END;
$$;