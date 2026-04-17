-- Strava integration schema: connections, sync state, webhook inbox, and import ledger.

-- 1) Session provenance metadata for imported activities
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS source text;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS source_activity_id text;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS source_payload jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS sessions_source_activity_unique_idx
  ON public.sessions (source, source_activity_id)
  WHERE source IS NOT NULL AND source_activity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sessions_source_idx
  ON public.sessions (source);

-- 2) Connected Strava account per user
CREATE TABLE IF NOT EXISTS public.strava_connections (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  athlete_id bigint UNIQUE NOT NULL,
  athlete_username text,
  athlete_name text,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  scope text,
  included_activity_types text[] NOT NULL DEFAULT ARRAY[
    'RUN',
    'RIDE',
    'WALK',
    'HIKE',
    'SWIM',
    'WORKOUT',
    'WEIGHTTRAINING',
    'VIRTUALRIDE',
    'VIRTUALRUN'
  ],
  connected_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS strava_connections_active_idx
  ON public.strava_connections (disconnected_at);

ALTER TABLE public.strava_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own strava connection." ON public.strava_connections;
CREATE POLICY "Users can view their own strava connection."
  ON public.strava_connections
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own strava connection." ON public.strava_connections;
CREATE POLICY "Users can insert their own strava connection."
  ON public.strava_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own strava connection." ON public.strava_connections;
CREATE POLICY "Users can update their own strava connection."
  ON public.strava_connections
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 3) Sync health/status per user
CREATE TABLE IF NOT EXISTS public.strava_sync_state (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  sync_in_progress boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  last_success_at timestamptz,
  last_webhook_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.strava_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own strava sync state." ON public.strava_sync_state;
CREATE POLICY "Users can view their own strava sync state."
  ON public.strava_sync_state
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own strava sync state." ON public.strava_sync_state;
CREATE POLICY "Users can insert their own strava sync state."
  ON public.strava_sync_state
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own strava sync state." ON public.strava_sync_state;
CREATE POLICY "Users can update their own strava sync state."
  ON public.strava_sync_state
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 4) Durable import ledger for idempotency
CREATE TABLE IF NOT EXISTS public.strava_activity_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  strava_activity_id bigint NOT NULL,
  activity_type text NOT NULL,
  started_at timestamptz NOT NULL,
  duration_seconds integer NOT NULL CHECK (duration_seconds >= 0),
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  payload jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT strava_activity_imports_user_id_strava_activity_id_key UNIQUE (user_id, strava_activity_id)
);

CREATE INDEX IF NOT EXISTS strava_activity_imports_user_idx
  ON public.strava_activity_imports (user_id, imported_at DESC);

ALTER TABLE public.strava_activity_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own strava imports." ON public.strava_activity_imports;
CREATE POLICY "Users can view their own strava imports."
  ON public.strava_activity_imports
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own strava imports." ON public.strava_activity_imports;
CREATE POLICY "Users can insert their own strava imports."
  ON public.strava_activity_imports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own strava imports." ON public.strava_activity_imports;
CREATE POLICY "Users can update their own strava imports."
  ON public.strava_activity_imports
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 5) Webhook event inbox (service-role only)
CREATE TABLE IF NOT EXISTS public.strava_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id bigint,
  object_type text,
  object_id bigint,
  aspect_type text,
  event_time timestamptz,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS strava_webhook_events_athlete_idx
  ON public.strava_webhook_events (athlete_id, created_at DESC);

CREATE INDEX IF NOT EXISTS strava_webhook_events_unprocessed_idx
  ON public.strava_webhook_events (processed_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.strava_webhook_events ENABLE ROW LEVEL SECURITY;
