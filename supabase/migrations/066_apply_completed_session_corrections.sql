-- Atomic correction of a completed session: optional end trim + single or split segments.

CREATE OR REPLACE FUNCTION public.apply_completed_session_corrections(
  p_session_id uuid,
  p_final_ended_at timestamp with time zone,
  p_segments jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orig public.sessions%ROWTYPE;
  n int;
  i int;
  seg jsonb;
  v_cursor timestamptz;
  v_end timestamptz;
  v_task text;
  v_dur int;
  v_prev_end timestamptz;
  j int;
  seg_j jsonb;
  v_ins_start timestamptz;
  v_ins_end timestamptz;
  v_ins_task text;
  v_ins_dur int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_orig FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found');
  END IF;

  IF v_orig.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF v_orig.status IS DISTINCT FROM 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only completed sessions can be edited');
  END IF;

  IF v_orig.ended_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session has no end time');
  END IF;

  IF p_final_ended_at < v_orig.started_at OR p_final_ended_at > v_orig.ended_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'End time out of allowed range');
  END IF;

  IF p_segments IS NULL OR jsonb_typeof(p_segments) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid segments');
  END IF;

  n := jsonb_array_length(p_segments);
  IF n < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'At least one segment required');
  END IF;

  IF n >= 2 AND v_orig.source IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Imported sessions cannot be split');
  END IF;

  v_cursor := v_orig.started_at;
  FOR i IN 0..n - 1 LOOP
    seg := p_segments -> i;
    IF seg IS NULL OR jsonb_typeof(seg) <> 'object' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid segment payload');
    END IF;

    v_task := trim(coalesce(seg ->> 'task_name', ''));
    IF length(v_task) < 1 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Each segment needs a task name');
    END IF;

    BEGIN
      v_end := (seg ->> 'ended_at')::timestamptz;
    EXCEPTION
      WHEN others THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid segment end time');
    END;

    IF v_end <= v_cursor THEN
      RETURN jsonb_build_object('success', false, 'error', 'Segment end times must increase');
    END IF;

    IF v_end > p_final_ended_at THEN
      RETURN jsonb_build_object('success', false, 'error', 'Segment ends after session end time');
    END IF;

    IF extract(epoch FROM (v_end - v_cursor))::int < 60 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Each segment must be at least 60 seconds');
    END IF;

    v_cursor := v_end;
  END LOOP;

  IF abs(extract(epoch FROM (v_cursor - p_final_ended_at))) > 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Last segment must end at the session end time');
  END IF;

  -- First segment: update existing row (preserve id, user, mode, domain, source, etc.)
  seg := p_segments -> 0;
  v_task := trim(coalesce(seg ->> 'task_name', ''));
  v_end := (seg ->> 'ended_at')::timestamptz;
  v_dur := greatest(0, floor(extract(epoch FROM (v_end - v_orig.started_at)))::int);

  UPDATE public.sessions
  SET
    task_name = v_task,
    ended_at = v_end,
    duration_seconds = v_dur,
    accumulated_seconds = v_dur,
    last_resumed_at = NULL
  WHERE id = p_session_id;

  IF n >= 2 THEN
    FOR j IN 1..n - 1 LOOP
      seg_j := p_segments -> j;
      v_ins_task := trim(coalesce(seg_j ->> 'task_name', ''));
      v_prev_end := (p_segments -> (j - 1) ->> 'ended_at')::timestamptz;
      v_ins_end := (seg_j ->> 'ended_at')::timestamptz;
      v_ins_dur := greatest(0, floor(extract(epoch FROM (v_ins_end - v_prev_end)))::int);

      INSERT INTO public.sessions (
        user_id,
        task_name,
        task_description,
        mode,
        domain,
        started_at,
        ended_at,
        duration_seconds,
        status,
        accumulated_seconds,
        last_resumed_at,
        part_of_pomo_cycle,
        source,
        source_activity_id,
        source_payload
      )
      VALUES (
        v_orig.user_id,
        v_ins_task,
        NULL,
        v_orig.mode,
        v_orig.domain,
        v_prev_end,
        v_ins_end,
        v_ins_dur,
        'completed',
        v_ins_dur,
        NULL,
        false,
        NULL,
        NULL,
        NULL
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.apply_completed_session_corrections(uuid, timestamp with time zone, jsonb)
  IS 'Correct completed session end time and/or split into contiguous segments (same user); rejects split for imported sessions.';
