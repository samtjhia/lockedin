-- Heatmap: use actual tracked study time (duration_seconds) instead of wall-clock (ended_at - started_at).
-- Fixes sessions left running/paused for hours being counted as full wall-clock time; real long study days are unchanged.

create or replace function get_heatmap_data(start_date timestamptz)
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
    with daily_time as (
        select
            to_char(s.started_at at time zone 'America/Toronto', 'YYYY-MM-DD') as day_str,
            coalesce(sum(
                greatest(0, coalesce(s.duration_seconds, 0)) / 60
            ), 0)::bigint as total_minutes
        from sessions s
        where s.user_id = auth.uid()
            and s.started_at >= start_date
            and s.status = 'completed'
            and s.mode not in ('short-break', 'long-break')
        group by 1
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
    with daily_time as (
        select
            to_char(s.started_at at time zone 'America/Toronto', 'YYYY-MM-DD') as day_str,
            coalesce(sum(
                greatest(0, coalesce(s.duration_seconds, 0)) / 60
            ), 0)::bigint as total_minutes
        from sessions s
        where s.user_id = target_user_id
            and s.started_at >= start_date
            and s.status = 'completed'
            and s.mode not in ('short-break', 'long-break')
        group by 1
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
