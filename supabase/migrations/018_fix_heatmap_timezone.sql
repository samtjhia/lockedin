-- Fix Heatmap Data to use Toronto Timezone
-- Similar to daily metrics, we need to ensure "Today's" activity is actually counted as "Today".
-- Previously, evening sessions (8PM EST+) were being counted as "Tomorrow" (UTC) and thus not showing up on the heatmap for "today".

create or replace function get_heatmap_data(start_date timestamptz)
returns table (
    date date,
    count bigint,
    level int -- 0-4 for intensity
)
language plpgsql
security definer
as $$
begin
    return query
    with daily_sessions as (
        select
            -- Convert the started_at timestamp to Toronto time BEFORE determining the day
            (started_at at time zone 'America/Toronto')::date as day,
            count(*) as session_count
        from
            sessions
        where
            user_id = auth.uid()
            -- We can keep the filter on start_date as is, or adjust it, 
            -- but the important part is how we group the output 'day'.
            and started_at >= start_date
            and status = 'completed'
        group by
            1
    )
    select
        ds.day,
        ds.session_count,
        case
            when ds.session_count = 0 then 0
            when ds.session_count <= 2 then 1
            when ds.session_count <= 5 then 2
            when ds.session_count <= 8 then 3
            else 4
        end as level
    from
        daily_sessions ds
    order by
        ds.day asc;
end;
$$;
