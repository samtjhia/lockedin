-- Migration to support Pause/Resume and Breaks
-- Run this in your Supabase SQL Editor

-- 1. Update Status Check to include 'paused'
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sessions_status_check'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_status_check
      CHECK (status IN ('active', 'paused', 'completed', 'abandoned'));
  END IF;
END
$$;

-- 2. Update Mode Check to include breaks
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_mode_check;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sessions_mode_check'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_mode_check
      CHECK (mode IN ('stopwatch', 'pomo', 'short-break', 'long-break'));
  END IF;
END
$$;

-- 3. Add Tracking Columns
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS accumulated_seconds INTEGER DEFAULT 0;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS last_paused_at TIMESTAMP WITH TIME ZONE; -- Tracks when it was paused (optional, for history)
-- We will re-purpose started_at or use a new column for the current segment. 
-- Let's use `last_resumed_at` for the start of the current active segment.
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS last_resumed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- update existing active sessions to have last_resumed_at = started_at
UPDATE public.sessions
SET last_resumed_at = started_at
WHERE status = 'active'
  AND last_resumed_at IS NULL;
