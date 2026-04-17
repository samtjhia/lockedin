-- Idempotent bootstrap for fresh Supabase projects.
-- Run this ONCE before `npx supabase db push` on a brand-new project.
-- It creates baseline objects expected by migration 002+.

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  username text,
  avatar_url text,
  is_verified boolean DEFAULT false,
  current_status text CHECK (current_status IN ('active', 'paused', 'offline')) DEFAULT 'offline',
  current_task text,
  last_nudge_sent_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Public profiles are viewable by everyone.'
  ) THEN
    CREATE POLICY "Public profiles are viewable by everyone."
      ON public.profiles FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can update own profile.'
  ) THEN
    CREATE POLICY "Users can update own profile."
      ON public.profiles FOR UPDATE
      USING (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can insert their own profile.'
  ) THEN
    CREATE POLICY "Users can insert their own profile."
      ON public.profiles FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
      AND tgrelid = 'auth.users'::regclass
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;
END $$;

-- Avatars bucket + storage policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Avatar images are publicly accessible.'
  ) THEN
    CREATE POLICY "Avatar images are publicly accessible."
      ON storage.objects FOR SELECT
      USING (bucket_id = 'avatars');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Anyone can upload an avatar.'
  ) THEN
    CREATE POLICY "Anyone can upload an avatar."
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'avatars');
  END IF;
END $$;

-- Sessions baseline table expected by migration 002+
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  task_name text NOT NULL,
  task_description text,
  mode text CHECK (mode IN ('stopwatch', 'pomo')) DEFAULT 'stopwatch',
  started_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  duration_seconds integer,
  status text CHECK (status IN ('active', 'completed', 'abandoned')) DEFAULT 'active'
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sessions'
      AND policyname = 'Users can view their own sessions.'
  ) THEN
    CREATE POLICY "Users can view their own sessions."
      ON public.sessions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sessions'
      AND policyname = 'Users can insert their own sessions.'
  ) THEN
    CREATE POLICY "Users can insert their own sessions."
      ON public.sessions FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sessions'
      AND policyname = 'Users can update their own sessions.'
  ) THEN
    CREATE POLICY "Users can update their own sessions."
      ON public.sessions FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;
