-- Fix medal page "no data": proration sum could be null (e.g. null ended_at or zero wall_sec),
-- making total_seconds 0 for everyone so WHERE total_seconds > 0 filters out all rows.

-- get_leaderboard_for_date: only completed sessions with ended_at set and wall time > 0; coalesce sum to 0
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
  completed_prorated as (
    select
      s.user_id,
      sum(
        coalesce(
          (coalesce(s.duration_seconds, 0) * greatest(0, extract(epoch from (least(s.ended_at, end_time) - greatest(s.started_at, start_time))))
           / nullif(extract(epoch from (s.ended_at - s.started_at)), 0)
          )::bigint,
          0
        )
      ) as sec
    from sessions s
    where s.started_at < end_time
      and s.ended_at >= start_time
      and s.ended_at is not null
      and s.started_at is not null
      and s.ended_at > s.started_at
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
      (case when wall_sec > 0 and wall_sec is not null then least((raw_sec * greatest(0, coalesce(overlap_sec, 0)) / wall_sec)::bigint, extract(epoch from (end_time - start_time))::bigint) else 0 end) as sec
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

-- get_leaderboard_for_week: same fixes
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
        coalesce(
          (coalesce(s.duration_seconds, 0) * greatest(0, extract(epoch from (least(s.ended_at, end_time) - greatest(s.started_at, start_time))))
           / nullif(extract(epoch from (s.ended_at - s.started_at)), 0)
          )::bigint,
          0
        )
      ) as sec
    from sessions s
    where s.started_at < end_time
      and s.ended_at >= start_time
      and s.ended_at is not null
      and s.started_at is not null
      and s.ended_at > s.started_at
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
      (case when wall_sec > 0 and wall_sec is not null then least((raw_sec * greatest(0, coalesce(overlap_sec, 0)) / wall_sec)::bigint, extract(epoch from (end_time - start_time))::bigint) else 0 end) as sec
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
