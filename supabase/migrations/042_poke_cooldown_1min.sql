-- Change poke cooldown from 10 minutes to 1 minute
CREATE OR REPLACE FUNCTION poke_user(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    current_pid uuid;
    last_poke_time timestamptz;
    is_friend boolean;
BEGIN
    current_pid := auth.uid();

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

    SELECT created_at INTO last_poke_time
    FROM pokes
    WHERE sender_id = current_pid AND receiver_id = target_user_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF last_poke_time IS NOT NULL AND (now() - last_poke_time) < interval '1 minute' THEN
        RETURN json_build_object('success', false, 'message', 'Cooldown active', 'remaining_seconds', EXTRACT(EPOCH FROM ((last_poke_time + interval '1 minute') - now())));
    END IF;

    INSERT INTO pokes (sender_id, receiver_id)
    VALUES (current_pid, target_user_id);

    RETURN json_build_object('success', true);
END;
$$;
