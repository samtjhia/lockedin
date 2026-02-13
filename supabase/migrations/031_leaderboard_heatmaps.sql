-- Create public heatmap function for leaderboard
-- This allows fetching heatmap data for any user (for the public leaderboard)

create or replace function get_user_heatmap_data(
    target_user_id uuid,
    start_date timestamptz
)
returns table (
    date text,
    count bigint,
    level int
)
language plpgsql
security definer
as $$
begin
    return query
    with daily_sessions as (
        select
            to_char(started_at at time zone 'America/Toronto', 'YYYY-MM-DD') as day_str,
            count(*) as session_count
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
        ds.day_str as date,
        ds.session_count,
        case
            when ds.session_count = 0 then 0
            when ds.session_count <= 2 then 1
            when ds.session_count <= 5 then 2
            when ds.session_count <= 8 then 3
            else 4
        end as level
    from daily_sessions ds;
end;
$$;

-- Grant execute to authenticated and anon for public leaderboard
grant execute on function get_user_heatmap_data(uuid, timestamptz) to authenticated;
grant execute on function get_user_heatmap_data(uuid, timestamptz) to anon;
