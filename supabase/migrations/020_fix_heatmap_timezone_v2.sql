-- Fix 2 for Heatmap: Ensure Date is returned as Text string 'YYYY-MM-DD'
-- This avoids any confusion between Date objects and Strings on the client/server boundary.

-- DROP first because we are changing the return type from DATE to TEXT
drop function if exists get_heatmap_data(timestamptz);

create or replace function get_heatmap_data(start_date timestamptz)
returns table (
    date text, -- Return as text to ensure strictly 'YYYY-MM-DD' format
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
            -- Convert to Toronto time, then format as string immediately
            to_char(started_at at time zone 'America/Toronto', 'YYYY-MM-DD') as day_str,
            count(*) as session_count
        from
            sessions
        where
            user_id = auth.uid()
            and started_at >= start_date
            and status = 'completed'
        group by
            1
    )
    select
        ds.day_str as date, -- Match the output column name
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
        ds.day_str asc;
end;
$$;
