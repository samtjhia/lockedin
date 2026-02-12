-- Fix for fuzzy matching in daily metrics
-- updates get_daily_metrics to group by case-insensitive task name

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
    total_focus_minutes bigint;
begin
    -- Hourly Breakdown (Focus Minutes per Hour)
    select json_agg(h) into hourly_data
    from (
        select
            extract(hour from started_at) as hour,
            sum(duration_seconds)::numeric / 60 as minutes
        from
            sessions
        where
            user_id = auth.uid()
            and date_trunc('day', started_at) = target_date
            and status = 'completed'
        group by 1
        order by 1
    ) h;

    -- Topic (Task) Distribution - Now with fuzzy matching (Lower + InitCap)
    select json_agg(t) into topic_data
    from (
        select
            case 
                when task_name is null or trim(task_name) = '' then 'Untitled'
                else initcap(lower(trim(task_name)))
            end as topic,
            count(*) as sessions_count,
            sum(duration_seconds)::numeric / 60 as total_minutes
        from
            sessions
        where
            user_id = auth.uid()
            and date_trunc('day', started_at) = target_date
            and status = 'completed'
        group by 1
        order by 3 desc
        limit 5
    ) t;
    
    -- Total Focus Minutes
    select coalesce(sum(duration_seconds) / 60, 0) into total_focus_minutes
    from sessions
    where 
        user_id = auth.uid()
        and date_trunc('day', started_at) = target_date
        and status = 'completed';

    return json_build_object(
        'hourly', coalesce(hourly_data, '[]'::json),
        'topics', coalesce(topic_data, '[]'::json),
        'total_minutes', total_focus_minutes
    );
end;
$$;
