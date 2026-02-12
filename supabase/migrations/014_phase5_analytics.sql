/*
  # Phase 5: History & Analytics Setup

  1. New Tables
     - `todos` (Main Quest backlog)
       - `id` (uuid, primary key)
       - `user_id` (uuid, foreign key to auth.users)
       - `task_name` (text)
       - `is_completed` (boolean)
       - `created_at` (timestamptz)
       - `completed_at` (timestamptz)

  2. Analytics Functions
     - `get_heatmap_data`: Returns daily session counts for the last 365 days
     - `get_daily_metrics`: Returns hourly breakdown and task distribution for a specific date
*/

-- 1. Create todos table
create table if not exists public.todos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  task_name text not null,
  is_completed boolean default false,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Enable RLS
alter table public.todos enable row level security;

-- Policies for todos
drop policy if exists "Users can view their own todos" on public.todos;
create policy "Users can view their own todos"
  on public.todos for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own todos" on public.todos;
create policy "Users can insert their own todos"
  on public.todos for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own todos" on public.todos;
create policy "Users can update their own todos"
  on public.todos for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own todos" on public.todos;
create policy "Users can delete their own todos"
  on public.todos for delete
  using (auth.uid() = user_id);

-- 2. Heatmap Data RPC
-- Returns date and count of completed sessions for the last 365 days
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
            date_trunc('day', started_at)::date as day,
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
        ds.day,
        ds.session_count,
        case
            when ds.session_count = 0 then 0
            when ds.session_count <= 2 then 1
            when ds.session_count <= 4 then 2
            when ds.session_count <= 6 then 3
            else 4
        end as level
    from
        daily_sessions ds;
end;
$$;

-- 3. Daily Metrics RPC
-- Returns aggregated stats for a specific date (hourly focus & task distribution)
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
