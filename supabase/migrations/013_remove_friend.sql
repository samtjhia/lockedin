-- Migration 13: Remove Friend RPC
-- Allows a user to remove a friendship (whether pending or accepted)
-- Deletes the row completely so they can re-add later if they want.

CREATE OR REPLACE FUNCTION remove_friend(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    current_pid uuid;
BEGIN
    current_pid := auth.uid();

    DELETE FROM friendships
    WHERE (requester_id = current_pid AND recipient_id = target_user_id)
       OR (requester_id = target_user_id AND recipient_id = current_pid);
END;
$$;
