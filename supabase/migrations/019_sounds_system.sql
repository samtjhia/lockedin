-- Create a table for managing soundscapes
create table public.sounds (
  id uuid default gen_random_uuid() primary key,
  label text not null,
  icon_key text not null check (icon_key in ('rain', 'coffee', 'music', 'fire', 'wind')), -- restrict to known icons for now
  file_url text not null,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.sounds enable row level security;

-- Allow everyone to read sounds
create policy "Sounds are viewable by everyone"
  on public.sounds for select
  using ( true );

-- Insert valid storage bucket (if not exists)
insert into storage.buckets (id, name, public)
values ('sounds', 'sounds', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Sounds are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'sounds' );

create policy "Authenticated users can upload sounds"
  on storage.objects for insert
  with check ( bucket_id = 'sounds' and auth.role() = 'authenticated' );
