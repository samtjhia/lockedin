-- Add 'seen' column to pokes so we can track unread poke notifications
ALTER TABLE public.pokes ADD COLUMN IF NOT EXISTS seen boolean DEFAULT false;

-- Get unseen pokes for the current user, with sender info
CREATE OR REPLACE FUNCTION get_unseen_pokes()
RETURNS TABLE (
    poke_id uuid,
    sender_id uuid,
    sender_username text,
    sender_avatar_url text,
    poked_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.sender_id,
        pr.username,
        pr.avatar_url,
        p.created_at
    FROM pokes p
    JOIN profiles pr ON pr.id = p.sender_id
    WHERE p.receiver_id = auth.uid()
      AND p.seen = false
    ORDER BY p.created_at DESC;
END;
$$;

-- Mark all pokes as seen for the current user
CREATE OR REPLACE FUNCTION mark_pokes_seen()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE pokes
    SET seen = true
    WHERE receiver_id = auth.uid()
      AND seen = false;
END;
$$;
