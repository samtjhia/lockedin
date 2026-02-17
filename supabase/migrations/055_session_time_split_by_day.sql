-- Split session time by calendar day (Toronto): sessions that span midnight contribute only the
-- portion of their duration that falls on each day. Fixes medal/leaderboard where someone who
-- started before midnight and ended after gets the full duration on the start day.

-- Helper: prorate completed session duration by wall-clock overlap with a day.
-- overlap_seconds / wall_seconds = fraction of session on that day; duration_seconds * that = assigned seconds.

-- 1. Heatmap: prorate each completed session across the days it overlaps
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
    with bounds as (
        select
            ((d::date::text || ' 00:00:00')::timestamp at time zone 'America/Toronto') as day_start,
            (((d::date + 1)::text || ' 00:00:00')::timestamp at time zone 'America/Toronto') as day_end,
            to_char(d::date, 'YYYY-MM-DD') as day_str
        from generate_series(
            (start_date at time zone 'America/Toronto')::date,
            (now() at time zone 'America/Toronto')::date,
            '1 day'::interval
        ) d
    ),
    session_splits as (
        select
            b.day_str,
            s.id,
            s.duration_seconds,
            extract(epoch from (least(s.ended_at, b.day_end) - greatest(s.started_at, b.day_start))) as overlap_sec,
            extract(epoch from (s.ended_at - s.started_at)) as wall_sec
        from bounds b
        join sessions s on s.user_id = auth.uid()
            and s.started_at < b.day_end
            and s.ended_at >= b.day_start
            and s.status = 'completed'
            and s.mode not in ('short-break', 'long-break')
            and coalesce(s.duration_seconds, 0) > 0
    ),
    daily_time as (
        select
            ss.day_str,
            (sum(ss.duration_seconds * greatest(0, ss.overlap_sec) / nullif(ss.wall_sec, 0)) / 60)::bigint as total_minutes
        from session_splits ss
        where ss.wall_sec > 0
        group by ss.day_str
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
    with bounds as (
        select
            ((d::date::text || ' 00:00:00')::timestamp at time zone 'America/Toronto') as day_start,
            (((d::date + 1)::text || ' 00:00:00')::timestamp at time zone 'America/Toronto') as day_end,
            to_char(d::date, 'YYYY-MM-DD') as day_str
        from generate_series(
            (start_date at time zone 'America/Toronto')::date,
            (now() at time zone 'America/Toronto')::date,
            '1 day'::interval
        ) d
    ),
    session_splits as (
        select
            b.day_str,
            s.id,
            s.duration_seconds,
            extract(epoch from (least(s.ended_at, b.day_end) - greatest(s.started_at, b.day_start))) as overlap_sec,
            extract(epoch from (s.ended_at - s.started_at)) as wall_sec
        from bounds b
        join sessions s on s.user_id = target_user_id
            and s.started_at < b.day_end
            and s.ended_at >= b.day_start
            and s.status = 'completed'
            and s.mode not in ('short-break', 'long-break')
            and coalesce(s.duration_seconds, 0) > 0
    ),
    daily_time as (
        select
            ss.day_str,
            (sum(ss.duration_seconds * greatest(0, ss.overlap_sec) / nullif(ss.wall_sec, 0)) / 60)::bigint as total_minutes
        from session_splits ss
        where ss.wall_sec > 0
        group by ss.day_str
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

-- 2. Leaderboard for date: include sessions that OVERLAP the day; prorate completed, prorate live
create or replace function get_leaderboard_for_date(target_date date)
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  is_verified boolean,
  current_status text,
  current_task text,
  total_seconds bigint
)
language plpgsql
security definer
as $$
declare
  start_time timestamp with time zone;
  end_time timestamp with time zone;
begin
  start_time := (target_date || ' 00:00:00')::timestamp at time zone 'America/Toronto';
  end_time := start_time + interval '1 day';

  return query
  with
  -- Completed sessions that overlap this day: prorate duration by overlap/wall
  completed_prorated as (
    select
      s.user_id,
      sum(
        (coalesce(s.duration_seconds, 0) * greatest(0, extract(epoch from (least(s.ended_at, end_time) - greatest(s.started_at, start_time))))
         / nullif(extract(epoch from (s.ended_at - s.started_at)), 0)
        )::bigint
      ) as sec
    from sessions s
    where s.started_at < end_time
      and s.ended_at >= start_time
      and s.status = 'completed'
      and s.mode not in ('short-break', 'long-break')
    group by s.user_id
  ),
  -- Active/paused that overlap: include if started before end_time and (no ended_at or still active). Prorate current total by overlap.
  live_one as (
    select distinct on (s.user_id) s.user_id,
      (case
        when s.status = 'active' and s.last_resumed_at is not null then
          (coalesce(s.accumulated_seconds, 0) + extract(epoch from (least(now(), end_time) - s.last_resumed_at)))::bigint
        when s.status = 'paused' then
          coalesce(s.accumulated_seconds, 0)::bigint
        else 0
      end) as raw_sec,
      extract(epoch from (least(now(), end_time) - greatest(s.started_at, start_time))) as overlap_sec,
      extract(epoch from (now() - s.started_at)) as wall_sec
    from sessions s
    where s.started_at < end_time
      and s.ended_at is null
      and s.status in ('active', 'paused')
      and s.mode not in ('short-break', 'long-break')
    order by s.user_id, s.last_resumed_at desc nulls last
  ),
  live_prorated as (
    select
      user_id,
      (case when wall_sec > 0 then least((raw_sec * greatest(0, overlap_sec) / wall_sec)::bigint, extract(epoch from (end_time - start_time))::bigint) else 0 end) as sec
    from live_one
  ),
  session_stats as (
    select coalesce(c.user_id, l.user_id) as user_id,
      coalesce(c.sec, 0) + coalesce(l.sec, 0) as seconds
    from completed_prorated c
    full outer join live_prorated l on l.user_id = c.user_id
  )
  select
    p.id as user_id,
    p.username,
    p.avatar_url,
    p.is_verified,
    null::text as current_status,
    null::text as current_task,
    coalesce(s.seconds, 0) as total_seconds
  from public.profiles p
  left join session_stats s on s.user_id = p.id
  where p.is_verified = true
    and p.hidden_at is null
  order by coalesce(s.seconds, 0) desc, p.username asc;
end;
$$;

-- 3. Leaderboard for week: prorate completed sessions by overlap with week; live same idea
create or replace function get_leaderboard_for_week(week_start date)
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  is_verified boolean,
  current_status text,
  current_task text,
  total_seconds bigint
)
language plpgsql
security definer
as $$
declare
  start_time timestamp with time zone;
  end_time timestamp with time zone;
begin
  start_time := (week_start || ' 00:00:00')::timestamp at time zone 'America/Toronto';
  end_time := start_time + interval '1 week';

  return query
  with
  completed_prorated as (
    select
      s.user_id,
      sum(
        (coalesce(s.duration_seconds, 0) * greatest(0, extract(epoch from (least(s.ended_at, end_time) - greatest(s.started_at, start_time))))
         / nullif(extract(epoch from (s.ended_at - s.started_at)), 0)
        )::bigint
      ) as sec
    from sessions s
    where s.started_at < end_time
      and s.ended_at >= start_time
      and s.status = 'completed'
      and s.mode not in ('short-break', 'long-break')
    group by s.user_id
  ),
  live_one as (
    select distinct on (s.user_id) s.user_id,
      (case
        when s.status = 'active' and s.last_resumed_at is not null then
          (coalesce(s.accumulated_seconds, 0) + extract(epoch from (least(now(), end_time) - s.last_resumed_at)))::bigint
        when s.status = 'paused' then
          coalesce(s.accumulated_seconds, 0)::bigint
        else 0
      end) as raw_sec,
      extract(epoch from (least(now(), end_time) - greatest(s.started_at, start_time))) as overlap_sec,
      extract(epoch from (now() - s.started_at)) as wall_sec
    from sessions s
    where s.started_at < end_time
      and s.ended_at is null
      and s.status in ('active', 'paused')
      and s.mode not in ('short-break', 'long-break')
    order by s.user_id, s.last_resumed_at desc nulls last
  ),
  live_prorated as (
    select
      user_id,
      (case when wall_sec > 0 then least((raw_sec * greatest(0, overlap_sec) / wall_sec)::bigint, extract(epoch from (end_time - start_time))::bigint) else 0 end) as sec
    from live_one
  ),
  session_stats as (
    select coalesce(c.user_id, l.user_id) as user_id,
      coalesce(c.sec, 0) + coalesce(l.sec, 0) as seconds
    from completed_prorated c
    full outer join live_prorated l on l.user_id = c.user_id
  )
  select
    p.id as user_id,
    p.username,
    p.avatar_url,
    p.is_verified,
    null::text as current_status,
    null::text as current_task,
    coalesce(s.seconds, 0) as total_seconds
  from public.profiles p
  left join session_stats s on s.user_id = p.id
  where p.is_verified = true
    and p.hidden_at is null
  order by coalesce(s.seconds, 0) desc, p.username asc;
end;
$$;
