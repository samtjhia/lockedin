-- Allow 'online' as a profile status (user is on app but no timer running)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_current_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_current_status_check
  CHECK (current_status IN ('active', 'paused', 'online', 'offline'));

-- Update get_friends to sort: active, paused, online, offline
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
        p.updated_at
    FROM profiles p
    JOIN friendships f ON 
        (f.requester_id = current_pid AND f.recipient_id = p.id) OR
        (f.requester_id = p.id AND f.recipient_id = current_pid)
    WHERE f.status = 'accepted'
    ORDER BY 
        CASE 
            WHEN p.current_status = 'active' THEN 1
            WHEN p.current_status = 'paused' THEN 2
            WHEN p.current_status = 'online' THEN 3
            ELSE 4 
        END ASC,
        p.username ASC;
END;
$$;
