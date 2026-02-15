-- Avatars bucket and RLS: allow authenticated users to upload/update only in their own folder (user_id/...)
-- Required for profile avatar upload; upsert needs INSERT + SELECT + UPDATE

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Drop existing policies if present (avoid duplicate or overly permissive policies from schema.sql)
drop policy if exists "Avatar images are publicly accessible." on storage.objects;
drop policy if exists "Anyone can upload an avatar." on storage.objects;

-- Public read: anyone can view avatars (public bucket)
create policy "Avatars public read"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

-- Authenticated upload: users can only insert into folder matching their user id
create policy "Users can upload own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Required for upsert (overwrite): users can update only their own file
create policy "Users can update own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
