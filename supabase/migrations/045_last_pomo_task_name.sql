-- Persist last pomo focus task name so auto-started focus sessions after a break keep the same title
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_pomo_task_name text;
