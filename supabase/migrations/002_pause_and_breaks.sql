-- Migration to support Pause/Resume and Breaks
-- Run this in your Supabase SQL Editor

-- 1. Update Status Check to include 'paused'
ALTER TABLE public.sessions DROP CONSTRAINT sessions_status_check;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_status_check 
  CHECK (status IN ('active', 'paused', 'completed', 'abandoned'));

-- 2. Update Mode Check to include breaks
ALTER TABLE public.sessions DROP CONSTRAINT sessions_mode_check;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_mode_check 
  CHECK (mode IN ('stopwatch', 'pomo', 'short-break', 'long-break'));

-- 3. Add Tracking Columns
ALTER TABLE public.sessions ADD COLUMN accumulated_seconds INTEGER DEFAULT 0;
ALTER TABLE public.sessions ADD COLUMN last_paused_at TIMESTAMP WITH TIME ZONE; -- Tracks when it was paused (optional, for history)
-- We will re-purpose started_at or use a new column for the current segment. 
-- Let's use `last_resumed_at` for the start of the current active segment.
ALTER TABLE public.sessions ADD COLUMN last_resumed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- update existing active sessions to have last_resumed_at = started_at
UPDATE public.sessions SET last_resumed_at = started_at WHERE status = 'active';
