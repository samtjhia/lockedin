-- Change heatmap calculations from session count to total time spent
-- Level is now based on minutes studied per day:
--   Level 0: 0 minutes
--   Level 1: 1-30 minutes
--   Level 2: 31-60 minutes (up to 1 hour)
--   Level 3: 61-120 minutes (up to 2 hours)
--   Level 4: 120+ minutes (2+ hours)

-- Update dashboard heatmap function
create or replace function get_heatmap_data(start_date timestamptz)
returns table (
    date text,
    count bigint,  -- Now represents total minutes instead of session count
    level int
)
language plpgsql
security definer
as $$
begin
    return query
    with daily_time as (
        select
            to_char(started_at at time zone 'America/Toronto', 'YYYY-MM-DD') as day_str,
            coalesce(sum(
                extract(epoch from (ended_at - started_at)) / 60
            ), 0)::bigint as total_minutes
        from
            sessions
        where
            user_id = auth.uid()
            and started_at >= start_date
            and status = 'completed'
            and mode NOT IN ('short-break', 'long-break')
        group by
            1
    )
    select
        dt.day_str as date,
        dt.total_minutes as count,
        case
            when dt.total_minutes = 0 then 0
            when dt.total_minutes <= 30 then 1
            when dt.total_minutes <= 60 then 2
            when dt.total_minutes <= 120 then 3
            else 4
        end as level
    from daily_time dt;
end;
$$;

-- Update leaderboard heatmap function
create or replace function get_user_heatmap_data(
    target_user_id uuid,
    start_date timestamptz
)
returns table (
    date text,
    count bigint,  -- Now represents total minutes instead of session count
    level int
)
language plpgsql
security definer
as $$
begin
    return query
    with daily_time as (
        select
            to_char(started_at at time zone 'America/Toronto', 'YYYY-MM-DD') as day_str,
            coalesce(sum(
                extract(epoch from (ended_at - started_at)) / 60
            ), 0)::bigint as total_minutes
        from
            sessions
        where
            user_id = target_user_id
            and started_at >= start_date
            and status = 'completed'
            and mode NOT IN ('short-break', 'long-break')
        group by
            1
    )
    select
        dt.day_str as date,
        dt.total_minutes as count,
        case
            when dt.total_minutes = 0 then 0
            when dt.total_minutes <= 30 then 1
            when dt.total_minutes <= 60 then 2
            when dt.total_minutes <= 120 then 3
            else 4
        end as level
    from daily_time dt;
end;
$$;

-- Re-grant permissions for leaderboard function (since we replaced it)
grant execute on function get_user_heatmap_data(uuid, timestamptz) to authenticated;
grant execute on function get_user_heatmap_data(uuid, timestamptz) to anon;
