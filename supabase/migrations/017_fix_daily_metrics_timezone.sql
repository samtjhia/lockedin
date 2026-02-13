-- Fix Daily Metrics to work with Timezones
-- The issue is that date_trunc('day', started_at) uses UTC Midnight.
-- If you are in Toronto, your sessions logged at 8PM (01:00 UTC next day) are falling into "Tomorrow" and getting filtered out of "Today".

create or replace function get_daily_metrics(
    target_date date default current_date
)
returns json
language plpgsql
security definer
as $$
declare
    hourly_data json;
    topic_data json;
    start_of_day timestamp with time zone;
    end_of_day timestamp with time zone;
begin
    -- 1. Determine the "User's Today" relative to their Timezone (Toronto/EST)
    -- This converts the "target_date" (which is just '2024-03-XX') into a Timestamp Range in Toronto time.
    start_of_day := (target_date || ' 00:00:00')::timestamp at time zone 'America/Toronto';
    end_of_day := start_of_day + interval '1 day';

    -- Hourly Breakdown (Focus Minutes per Hour)
    select json_agg(h) into hourly_data
    from (
        select
            -- Convert the UTC timestamp of the session back to Toronto Hour for display (0-23)
            extract(hour from (started_at at time zone 'America/Toronto')) as hour,
            round(sum(coalesce(duration_seconds, 0))::numeric / 60, 2) as minutes
        from
            sessions
        where
            user_id = auth.uid()
            and started_at >= start_of_day
            and started_at < end_of_day
            and status = 'completed'
        group by 1
        order by 1
    ) h;

    -- Topic (Task) Distribution
    select json_agg(t) into topic_data
    from (
        select
            case 
                when task_name is null or trim(task_name) = '' then 'Untitled'
                else initcap(lower(trim(task_name)))
            end as topic,
            count(*) as sessions_count,
            round(sum(coalesce(duration_seconds, 0))::numeric / 60, 2) as total_minutes
        from
            sessions
        where
            user_id = auth.uid()
            and started_at >= start_of_day
            and started_at < end_of_day
            and status = 'completed'
        group by 1
        order by 3 desc
        limit 5
    ) t;

    return json_build_object(
        'hourly', coalesce(hourly_data, '[]'::json),
        'topics', coalesce(topic_data, '[]'::json)
    );
end;
$$;
