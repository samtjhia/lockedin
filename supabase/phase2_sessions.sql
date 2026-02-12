-- 1. Create SESSIONS table
create table public.sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  task_name text not null,
  task_description text,
  mode text check (mode in ('stopwatch', 'pomo')) default 'stopwatch',
  started_at timestamp with time zone default now(),
  ended_at timestamp with time zone,
  duration_seconds integer,
  status text check (status in ('active', 'completed', 'abandoned')) default 'active'
);

-- 2. Enable RLS
alter table public.sessions enable row level security;

-- 3. Policies
-- Users can view their own sessions
create policy "Users can view their own sessions."
  on public.sessions for select
  using ( auth.uid() = user_id );

-- Users can insert their own sessions
create policy "Users can insert their own sessions."
  on public.sessions for insert
  with check ( auth.uid() = user_id );

-- Users can update their own sessions
create policy "Users can update their own sessions."
  on public.sessions for update
  using ( auth.uid() = user_id );
