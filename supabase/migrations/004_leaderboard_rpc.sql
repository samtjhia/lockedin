-- Phase 3: Leaderboard RPC Function
-- This function aggregates session data for the leaderboard

create or replace function get_leaderboard(period text)
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
begin
  -- Determine start time based on period
  if period = 'weekly' then
    start_time := date_trunc('week', now()); -- Starts Monday 00:00
  else
    start_time := date_trunc('day', now()); -- Starts Today 00:00 (default)
  end if;

  return query
  with session_stats as (
    select 
      s.user_id,
      sum(
        case 
          -- For completed sessions, use stored duration
          when s.status = 'completed' then s.duration_seconds
          -- For paused sessions, use accumulated seconds
          when s.status = 'paused' then s.accumulated_seconds
          -- For active sessions, use accumulated + elapsed time since last resume
          when s.status = 'active' then (s.accumulated_seconds + extract(epoch from (now() - s.last_resumed_at)))
          else 0
        end
      )::bigint as seconds
    from sessions s
    where s.started_at >= start_time
    -- Exclude breaks from the score? Yes, usually for productivity leaderboards.
    and s.mode not in ('short-break', 'long-break')
    group by s.user_id
  )
  select 
    p.id as user_id,
    p.username,
    p.avatar_url,
    p.is_verified,
    p.current_status,
    p.current_task,
    coalesce(ss.seconds, 0) as total_seconds
  from profiles p
  left join session_stats ss on p.id = ss.user_id
  order by total_seconds desc nulls last;
end;
$$;
