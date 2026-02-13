-- Create a table for user quick links (bookmarks and youtube links)
create table public.user_links (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  url text not null,
  link_type text not null check (link_type in ('quick', 'youtube')),
  position integer default 0,
  created_at timestamp with time zone default now()
);

-- Create index for faster queries by user
create index user_links_user_id_idx on public.user_links(user_id);

-- Enable RLS
alter table public.user_links enable row level security;

-- Users can only view their own links
create policy "Users can view their own links"
  on public.user_links for select
  using ( auth.uid() = user_id );

-- Users can insert their own links
create policy "Users can insert their own links"
  on public.user_links for insert
  with check ( auth.uid() = user_id );

-- Users can update their own links
create policy "Users can update their own links"
  on public.user_links for update
  using ( auth.uid() = user_id );

-- Users can delete their own links
create policy "Users can delete their own links"
  on public.user_links for delete
  using ( auth.uid() = user_id );
