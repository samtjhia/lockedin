-- Fix: Allow users to delete their own sessions
-- Run this in your Supabase SQL Editor

create policy "Users can delete their own sessions"
  on public.sessions for delete
  using ( auth.uid() = user_id );
