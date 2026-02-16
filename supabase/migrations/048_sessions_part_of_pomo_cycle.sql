-- Break sessions started by the pomo cycle (after a focus session ends) are marked
-- so that when the break timer ends we auto-start the next pomo. Manually started
-- breaks (user chose Break mode from idle) are not marked and simply end to idle.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS part_of_pomo_cycle boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sessions.part_of_pomo_cycle IS 'True when this break was auto-started by transitionSession after a pomo; used to avoid auto-resuming to pomo when user manually started a break.';
