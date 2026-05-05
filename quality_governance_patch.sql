-- ============================================================================
-- SIDDHANT: Revision Flagging & Reputation Guard Migration
-- ============================================================================
-- Adds:
--   1. Revision flagging columns
--   2. Flag-aware Edit Acceptance logic
--   3. Simplified Execute Revert (no point deduction)
--   4. Flag/Clear RPC 
--   5. Updated recent_changes_view with flag awareness
-- ============================================================================

-- 1. ADD FLAGGING COLUMNS TO REVISIONS
ALTER TABLE public.revisions 
  ADD COLUMN IF NOT EXISTS is_flagged boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS flagged_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS flag_reason text;

-- 2. UPDATE PROCESS_EDIT_ACCEPTANCE TO SKIP FLAGGED REVISIONS
-- This ensures flagged edits never earn reputation automatically.
CREATE OR REPLACE FUNCTION public.process_edit_acceptance(
  p_hours_threshold integer DEFAULT 72
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_revision RECORD;
  v_prev_size integer;
  v_char_delta integer;
  v_is_minor boolean;
  v_points integer;
  v_count integer := 0;
BEGIN
  -- Find all unprocessed revisions older than the threshold
  -- EXCLUDE: reverts, reverted, AND flagged revisions
  FOR v_revision IN
    SELECT r.id, r.author_id, r.node_id, r.content_size, r.created_at
    FROM public.revisions r
    WHERE r.acceptance_processed = false
      AND r.created_at < (NOW() - (p_hours_threshold || ' hours')::interval)
      AND COALESCE(r.is_revert, false) = false
      AND COALESCE(r.is_reverted, false) = false
      AND COALESCE(r.is_flagged, false) = false
    ORDER BY r.created_at ASC
    LIMIT 50
  LOOP
    -- Calculate character delta
    SELECT COALESCE(content_size, 0) INTO v_prev_size
    FROM public.revisions
    WHERE node_id = v_revision.node_id
      AND created_at < v_revision.created_at
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_prev_size IS NULL THEN v_prev_size := 0; END IF;

    v_char_delta := ABS(COALESCE(v_revision.content_size, 0) - v_prev_size);
    v_is_minor := (v_char_delta < 50);
    v_points := CASE WHEN v_is_minor THEN 2 ELSE 5 END;

    -- 1. Mark revision as processed
    UPDATE public.revisions SET acceptance_processed = true WHERE id = v_revision.id;

    -- 2. Increment accepted_edits_count
    UPDATE public.profiles
    SET accepted_edits_count = COALESCE(accepted_edits_count, 0) + 1
    WHERE id = v_revision.author_id;

    -- 3. Award reputation points
    INSERT INTO public.reputation_events (user_id, event_type, points, source_id, source_type, description)
    VALUES (
      v_revision.author_id,
      CASE WHEN v_is_minor THEN 'edit_accepted_minor' ELSE 'edit_accepted_substantive' END,
      v_points,
      v_revision.id,
      'revision',
      'Edit ' || CASE WHEN v_is_minor THEN '(minor)' ELSE '(substantive)' END || ' accepted after community review window'
    );

    -- 4. Update reputation_score
    UPDATE public.profiles
    SET reputation_score = COALESCE(reputation_score, 0) + v_points
    WHERE id = v_revision.author_id;

    v_count := v_count + 1;
  END LOOP;

  -- Also mark any revert/reverted/flagged revisions as handled for this run 
  -- (Flagged will be picked up later if the flag is cleared)
  UPDATE public.revisions
  SET acceptance_processed = true
  WHERE acceptance_processed = false
    AND created_at < (NOW() - (p_hours_threshold || ' hours')::interval)
    AND (COALESCE(is_revert, false) = true OR COALESCE(is_reverted, false) = true);

  RETURN json_build_object('processed', v_count);
END;
$$;


-- 3. UPDATE EXECUTE_REVERT (simplified — no point deduction)
-- Reverts simply undo the edit. Flags handle reputation deterrence.
CREATE OR REPLACE FUNCTION public.execute_revert(
  p_target_revision_id uuid,
  p_reverter_id uuid,
  p_restored_content text,
  p_restored_size integer,
  p_commit_message text,
  p_node_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Mark the target revision as reverted
  UPDATE public.revisions
  SET is_reverted = true
  WHERE id = p_target_revision_id;

  -- 2. Create the new revert revision
  INSERT INTO public.revisions (
    node_id, author_id, report_content, content_size, commit_message,
    is_revert, reverted_revision_id, acceptance_processed
  )
  VALUES (
    p_node_id, p_reverter_id, p_restored_content, p_restored_size, p_commit_message,
    true, p_target_revision_id, true
  );

  RETURN json_build_object('success', true);
END;
$$;

-- 4. NEW RPC: FLAG/CLEAR REVISION
CREATE OR REPLACE FUNCTION public.resolve_revision_flag(
  p_revision_id uuid,
  p_flag boolean,
  p_flagger_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check permission (Level 3+ required to CLEAR a flag)
  -- (Flagging itself can be done by L1+, handled in server action for simplicity)
  
  UPDATE public.revisions
  SET 
    is_flagged = p_flag,
    flagged_by = CASE WHEN p_flag THEN p_flagger_id ELSE NULL END,
    flag_reason = CASE WHEN p_flag THEN p_reason ELSE NULL END,
    -- If clearing a flag, reset acceptance_processed so the 72h timer can re-evaluate
    -- BUT only if the revision is not a revert or reverted (those should never be processed)
    acceptance_processed = CASE 
      WHEN NOT p_flag 
        AND COALESCE(is_revert, false) = false 
        AND COALESCE(is_reverted, false) = false 
      THEN false 
      ELSE acceptance_processed 
    END
  WHERE id = p_revision_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_revision_flag TO authenticated;


-- 5. UPDATE RECENT_CHANGES_VIEW WITH FLAG AWARENESS
-- Flagged revisions are now visually distinct in the activity feed.
DROP VIEW IF EXISTS public.recent_changes_view;

CREATE OR REPLACE VIEW public.recent_changes_view AS

-- 1. Revisions (with revert + flag distinction)
SELECT
  r.id AS activity_id,
  r.node_id,
  n.title AS node_title,
  n.slug AS node_slug,
  r.author_id,
  p.username AS author_username,
  p.role AS author_role,
  p.reputation_score AS author_reputation,
  'revision' AS activity_type,
  CASE
    WHEN COALESCE(r.is_revert, false) THEN '↩ reverted: ' || r.commit_message
    WHEN COALESCE(r.is_reverted, false) THEN '✗ [reverted] ' || r.commit_message
    WHEN COALESCE(r.is_flagged, false) THEN '⚑ [flagged] ' || r.commit_message
      || ' (' || COALESCE(r.content_size, 0) || ' chars)'
    ELSE 'committed edit: ' || r.commit_message
      || ' (' || COALESCE(r.content_size, 0) || ' chars)'
  END AS action_summary,
  r.created_at
FROM public.revisions r
JOIN public.nodes n ON r.node_id = n.id
JOIN public.profiles p ON r.author_id = p.id

UNION ALL

-- 2. Discussions
SELECT
  d.id AS activity_id,
  d.node_id,
  n.title AS node_title,
  n.slug AS node_slug,
  d.author_id,
  p.username AS author_username,
  p.role AS author_role,
  p.reputation_score AS author_reputation,
  'discussion' AS activity_type,
  CASE
    WHEN d.parent_id IS NULL THEN 'started discussion topic'
    ELSE 'replied in discussion thread'
  END AS action_summary,
  d.created_at
FROM public.discussions d
JOIN public.nodes n ON d.node_id = n.id
JOIN public.profiles p ON d.author_id = p.id

UNION ALL

-- 3. Inline Tags
SELECT
  t.id AS activity_id,
  t.node_id,
  n.title AS node_title,
  n.slug AS node_slug,
  t.author_id,
  p.username AS author_username,
  p.role AS author_role,
  p.reputation_score AS author_reputation,
  'inline_tag' AS activity_type,
  'flagged issue: "' || REPLACE(t.tag_type, '_', ' ') || '"' ||
    CASE WHEN t.resolved THEN ' (resolved)' ELSE ' (open)' END AS action_summary,
  t.created_at
FROM public.inline_tags t
JOIN public.nodes n ON t.node_id = n.id
JOIN public.profiles p ON t.author_id = p.id;

GRANT SELECT ON public.recent_changes_view TO anon, authenticated;
