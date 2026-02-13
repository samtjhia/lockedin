-- Profile metrics helpers for user profile pages
-- 1) Per-user history stats (day/week/month) for any target user
--    Mirrors existing get_history_stats but parameterized by target_user_id

create or replace function get_user_history_stats(
    target_user_id uuid,
    target_date date
)
returns json
language plpgsql
security definer
as $$
declare
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
begin
    -- Configure Timezone (Toronto)
    day_start := (target_date || ' 00:00:00')::timestamp at time zone 'America/Toronto';
    day_end := day_start + interval '1 day';
    
    -- Week Start (Monday) relative to target date
    week_start := date_trunc('week', day_start);
    -- Month Start relative to target date
    month_start := date_trunc('month', day_start);
    month_end := month_start + interval '1 month';

    -- 1. DAILY STATS
    select 
        coalesce(sum(
            case 
                when status = 'completed' then duration_seconds
                else 0 
            end
        ), 0),
        coalesce(max(
            case 
                when status = 'completed' then duration_seconds 
                else 0 
            end
        ), 0)
    into daily_seconds, longest_session
    from sessions
    where user_id = target_user_id
    and started_at >= day_start and started_at < day_end
    and status = 'completed'
    and mode not in ('short-break', 'long-break');

    -- Peak Hour (Mode)
    select 
        extract(hour from (started_at at time zone 'America/Toronto'))::int
    into peak_hour
    from sessions
    where user_id = target_user_id
    and started_at >= day_start and started_at < day_end
    and status = 'completed'
    and mode not in ('short-break', 'long-break')
    group by 1
    order by count(*) desc
    limit 1;

    -- Top Topics (Daily)
    select json_agg(t) into top_topics
    from (
        select 
            coalesce(nullif(lower(trim(task_name)), ''), 'untitled') as name,
            sum(duration_seconds) as duration
        from sessions
        where user_id = target_user_id
        and started_at >= day_start and started_at < day_end
        and status = 'completed'
        and mode not in ('short-break', 'long-break')
        group by 1
        order by 2 desc
        limit 5
    ) t;

    -- 2. WEEKLY STATS (Total Duration only for Grade)
    select 
        coalesce(sum(duration_seconds), 0)
    into weekly_seconds
    from sessions
    where user_id = target_user_id
    and started_at >= week_start 
    and started_at < (week_start + interval '1 week')
    and status = 'completed'
    and mode not in ('short-break', 'long-break');

    -- 3. MONTHLY STATS (Total Duration, Peak Hour, Top Topics)
    select 
        coalesce(sum(duration_seconds), 0)
    into monthly_seconds
    from sessions
    where user_id = target_user_id
    and started_at >= month_start 
    and started_at < month_end
    and status = 'completed'
    and mode not in ('short-break', 'long-break');

    -- Peak Hour (Month)
    select 
        extract(hour from (started_at at time zone 'America/Toronto'))::int
    into monthly_peak_hour
    from sessions
    where user_id = target_user_id
    and started_at >= month_start and started_at < month_end
    and status = 'completed'
    and mode not in ('short-break', 'long-break')
    group by 1
    order by count(*) desc
    limit 1;

    -- Top Topics (Monthly)
    select json_agg(t) into monthly_top_topics
    from (
        select 
            coalesce(nullif(lower(trim(task_name)), ''), 'untitled') as name,
            sum(duration_seconds) as duration
        from sessions
        where user_id = target_user_id
        and started_at >= month_start and started_at < month_end
        and status = 'completed'
        and mode not in ('short-break', 'long-break')
        group by 1
        order by 2 desc
        limit 8
    ) t;
    
    -- Build Result JSON
    result := json_build_object(
        'daily', json_build_object(
            'total_seconds', daily_seconds,
            'longest_session', longest_session,
            'peak_hour', peak_hour,
            'top_topics', coalesce(top_topics, '[]'::json)
        ),
        'weekly', json_build_object(
            'total_seconds', weekly_seconds
        ),
        'monthly', json_build_object(
            'total_seconds', monthly_seconds,
            'peak_hour', monthly_peak_hour,
            'top_topics', coalesce(monthly_top_topics, '[]'::json)
        )
    );

    return result;
end;
$$;

grant execute on function get_user_history_stats(uuid, date) to authenticated;

