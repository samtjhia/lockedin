-- Phase 4: Social System Migration
-- 1. Friendships Table
-- 2. Pokes Table
-- 3. Functions: search, request, accept, poke, get_friends

-- 1. FRIENDSHIPS TABLE
CREATE TABLE IF NOT EXISTS public.friendships (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id uuid REFERENCES public.profiles(id) NOT NULL,
    recipient_id uuid REFERENCES public.profiles(id) NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT friendships_users_check CHECK (requester_id <> recipient_id)
);

-- CREATE UNIQUE INDEX instead of CONSTRAINT for expression index
CREATE UNIQUE INDEX friendships_unique_pair_idx 
ON public.friendships (LEAST(requester_id, recipient_id), GREATEST(requester_id, recipient_id));

-- RLS for friendships
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friendships"
    ON public.friendships FOR SELECT
    USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can insert friend requests"
    ON public.friendships FOR INSERT
    WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update their own friendships"
    ON public.friendships FOR UPDATE
    USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- 2. POKES TABLE
CREATE TABLE IF NOT EXISTS public.pokes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id uuid REFERENCES public.profiles(id) NOT NULL,
    receiver_id uuid REFERENCES public.profiles(id) NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- RLS for pokes
ALTER TABLE public.pokes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pokes sent to them or by them"
    ON public.pokes FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert pokes"
    ON public.pokes FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

-- Indexes
CREATE INDEX idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX idx_friendships_recipient ON public.friendships(recipient_id);
CREATE INDEX idx_pokes_receiver ON public.pokes(receiver_id);
CREATE INDEX idx_pokes_sender ON public.pokes(sender_id);


-- 3. FUNCTIONS

-- A. SEARCH USERS
-- Returns users matching username, plus their relationship status with current user
CREATE OR REPLACE FUNCTION search_users(search_term text)
RETURNS TABLE (
    user_id uuid,
    username text,
    avatar_url text,
    friendship_status text, -- 'none', 'pending_sent', 'pending_received', 'friends'
    is_verified boolean
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    current_pid uuid;
BEGIN
    current_pid := auth.uid();

    RETURN QUERY
    SELECT 
        p.id as user_id,
        p.username,
        p.avatar_url,
        CASE 
            WHEN f.status = 'accepted' THEN 'friends'
            WHEN f.status = 'pending' AND f.requester_id = current_pid THEN 'pending_sent'
            WHEN f.status = 'pending' AND f.recipient_id = current_pid THEN 'pending_received'
            ELSE 'none'
        END as friendship_status,
        p.is_verified
    FROM profiles p
    LEFT JOIN friendships f ON 
        (f.requester_id = current_pid AND f.recipient_id = p.id) OR
        (f.requester_id = p.id AND f.recipient_id = current_pid)
    WHERE 
        p.id <> current_pid AND
        p.username ILIKE '%' || search_term || '%'
    LIMIT 10;
END;
$$;


-- B. SEND FRIEND REQUEST
CREATE OR REPLACE FUNCTION send_friend_request(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    current_pid uuid;
    exists_check boolean;
BEGIN
    current_pid := auth.uid();
    
    IF current_pid = target_user_id THEN
        RETURN json_build_object('success', false, 'message', 'Cannot add yourself');
    END IF;

    -- Check if relationship exists
    SELECT EXISTS (
        SELECT 1 FROM friendships 
        WHERE (requester_id = current_pid AND recipient_id = target_user_id)
           OR (requester_id = target_user_id AND recipient_id = current_pid)
    ) INTO exists_check;

    IF exists_check THEN
         -- Maybe it's blocked or already accepted, but for now just say exists
        RETURN json_build_object('success', false, 'message', 'Relationship already exists');
    END IF;

    INSERT INTO friendships (requester_id, recipient_id, status)
    VALUES (current_pid, target_user_id, 'pending');

    RETURN json_build_object('success', true);
END;
$$;


-- C. ACCEPT FRIEND REQUEST
CREATE OR REPLACE FUNCTION accept_friend_request(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    current_pid uuid;
BEGIN
    current_pid := auth.uid();

    UPDATE friendships
    SET status = 'accepted', updated_at = now()
    WHERE requester_id = target_user_id 
    AND recipient_id = current_pid 
    AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'No pending request found');
    END IF;

    RETURN json_build_object('success', true);
END;
$$;

-- D. POKE USER
CREATE OR REPLACE FUNCTION poke_user(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    current_pid uuid;
    last_poke_time timestamptz;
    is_friend boolean;
BEGIN
    current_pid := auth.uid();

    -- Check friendship
    SELECT EXISTS (
        SELECT 1 FROM friendships 
        WHERE status = 'accepted'
        AND (
            (requester_id = current_pid AND recipient_id = target_user_id) OR
            (requester_id = target_user_id AND recipient_id = current_pid)
        )
    ) INTO is_friend;

    IF NOT is_friend THEN
        RETURN json_build_object('success', false, 'message', 'You can only poke friends');
    END IF;

    -- Check cooldown (30 mins)
    SELECT created_at INTO last_poke_time
    FROM pokes
    WHERE sender_id = current_pid AND receiver_id = target_user_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF last_poke_time IS NOT NULL AND (now() - last_poke_time) < interval '30 minutes' THEN
        RETURN json_build_object('success', false, 'message', 'Cooldown active', 'remaining_seconds', EXTRACT(EPOCH FROM ((last_poke_time + interval '30 minutes') - now())));
    END IF;

    INSERT INTO pokes (sender_id, receiver_id)
    VALUES (current_pid, target_user_id);

    RETURN json_build_object('success', true);
END;
$$;

-- E. GET FRIENDS (Floor List)
-- Returns active friends sorted by status (active > paused > offline)
CREATE OR REPLACE FUNCTION get_friends()
RETURNS TABLE (
    user_id uuid,
    username text,
    avatar_url text,
    current_status text,
    current_task text,
    last_active_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    current_pid uuid;
BEGIN
    current_pid := auth.uid();

    RETURN QUERY
    SELECT 
        p.id,
        p.username,
        p.avatar_url,
        p.current_status,
        p.current_task,
        p.updated_at -- Approximate last active
    FROM profiles p
    JOIN friendships f ON 
        (f.requester_id = current_pid AND f.recipient_id = p.id) OR
        (f.requester_id = p.id AND f.recipient_id = current_pid)
    WHERE f.status = 'accepted'
    ORDER BY 
        CASE 
            WHEN p.current_status = 'active' THEN 1
            WHEN p.current_status = 'paused' THEN 2
            ELSE 3 
        END ASC,
        p.username ASC;
END;
$$;
