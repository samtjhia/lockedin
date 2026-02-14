-- Pomodoro cycle size: number of focus sessions before a long break (default 4)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pomo_cycle_size INTEGER DEFAULT 4;

-- Constrain to sensible range (e.g. 2–8)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pomo_cycle_size_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pomo_cycle_size_check
  CHECK (pomo_cycle_size IS NULL OR (pomo_cycle_size >= 2 AND pomo_cycle_size <= 20));
