-- Get friends for any user (for viewing on profile pages)
CREATE OR REPLACE FUNCTION get_user_friends(target_user_id uuid)
RETURNS TABLE (
    user_id uuid,
    username text,
    avatar_url text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.username,
        p.avatar_url
    FROM profiles p
    JOIN friendships f ON
        (f.requester_id = target_user_id AND f.recipient_id = p.id) OR
        (f.requester_id = p.id AND f.recipient_id = target_user_id)
    WHERE f.status = 'accepted'
    ORDER BY p.username ASC;
END;
$$;
