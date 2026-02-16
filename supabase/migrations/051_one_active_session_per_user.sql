-- At most one active or paused session per user (prevents duplicate sessions and double-counted time).
-- punchIn checks before insert; this index is a backstop.

-- Resolve existing duplicates: keep the session with latest last_resumed_at per user, mark the rest abandoned.
UPDATE public.sessions s
SET status = 'abandoned'
WHERE s.status IN ('active', 'paused')
  AND s.id <> (
    SELECT s2.id FROM public.sessions s2
    WHERE s2.user_id = s.user_id AND s2.status IN ('active', 'paused')
    ORDER BY s2.last_resumed_at DESC NULLS LAST, s2.id DESC
    LIMIT 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS sessions_one_active_paused_per_user
  ON public.sessions (user_id)
  WHERE status IN ('active', 'paused');
