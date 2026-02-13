-- Fix Daily Metrics to exclude break sessions from charts
-- Breaks (short-break, long-break) should not appear in topic distribution or hourly focus

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
    -- Determine the "User's Today" relative to their Timezone (Toronto/EST)
    start_of_day := (target_date || ' 00:00:00')::timestamp at time zone 'America/Toronto';
    end_of_day := start_of_day + interval '1 day';

    -- Hourly Breakdown (Focus Minutes per Hour) - EXCLUDE BREAKS
    select json_agg(h) into hourly_data
    from (
        select
            extract(hour from (started_at at time zone 'America/Toronto')) as hour,
            round(sum(coalesce(duration_seconds, 0))::numeric / 60, 2) as minutes
        from
            sessions
        where
            user_id = auth.uid()
            and started_at >= start_of_day
            and started_at < end_of_day
            and status = 'completed'
            and mode not in ('short-break', 'long-break')
        group by 1
        order by 1
    ) h;

    -- Topic (Task) Distribution - EXCLUDE BREAKS
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
            and mode not in ('short-break', 'long-break')
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
