-- Migration for Automatic Pomodoro Cycles
-- Run this in your Supabase SQL Editor

-- 1. Add cycle tracking to profiles
ALTER TABLE public.profiles ADD COLUMN pomo_session_count INTEGER DEFAULT 0;

-- 2. Allow 'short-break' and 'long-break' in profiles if strict checking is on (not strictly needed if no constraint on current_task/status prevents it, but good to know)
-- (The profiles table only has constraints on current_status ('active', 'paused', 'offline'), so we are good there)

