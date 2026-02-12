-- 1. Create PROFILES table
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  username text,
  avatar_url text,
  is_verified boolean default false,
  current_status text check (current_status in ('active', 'paused', 'offline')) default 'offline',
  current_task text,
  last_nudge_sent_at timestamp with time zone,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- 3. Create Policies
-- Allow anyone to VIEW profiles (for the public leaderboard)
create policy "Public profiles are viewable by everyone."
  on public.profiles for select
  using ( true );

-- Allow users to UPDATE their own profile
create policy "Users can update own profile."
  on public.profiles for update
  using ( auth.uid() = id );

-- Allow users to INSERT their own profile (usually handled by trigger, but good backup)
create policy "Users can insert their own profile."
  on public.profiles for insert
  with check ( auth.uid() = id );

-- 4. Create Trigger for New User Signup
-- This function runs automatically when a new user signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

-- Trigger definition
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. Create Storage Bucket for Avatars (Optional, if you want image uploads later)
insert into storage.buckets (id, name, public) 
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly accessible."
  on storage.objects for select
  using ( bucket_id = 'avatars' );

create policy "Anyone can upload an avatar."
  on storage.objects for insert
  with check ( bucket_id = 'avatars' );
