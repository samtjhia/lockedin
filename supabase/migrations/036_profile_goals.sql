-- Add goals column to profiles for "What I'm prepping for" section
alter table public.profiles add column if not exists goals text;
