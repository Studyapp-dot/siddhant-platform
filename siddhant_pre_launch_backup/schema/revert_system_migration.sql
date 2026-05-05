-- ============================================================================
-- SIDDHANT: Revert System Migration
-- ============================================================================
-- Adds:
--   1. is_revert flag on revisions (distinguishes reverts from contributions)
--   2. reverted_revision_id linking a revert to the revision it undid
--   3. is_reverted flag to mark the original revision that was undone
-- ============================================================================
-- Run this in Supabase SQL Editor. Idempotent.
-- ============================================================================


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 1: Add revert tracking columns to revisions                       ║
-- ║                                                                         ║
-- ║  is_revert:            true if this revision was created by a revert    ║
-- ║  reverted_revision_id: the revision ID that this revert undid           ║
-- ║  is_reverted:          true if this revision has been reverted          ║
-- ║                                                                         ║
-- ║  A revert creates a NEW revision (for radical transparency — nothing    ║
-- ║  is ever deleted) but marks it so the system treats it differently:     ║
-- ║    - No total_edits_count increment for the reverter                    ║
-- ║    - No accepted_edits_count / reputation via 72h timer                 ║
-- ║    - The reverted revision is also excluded from acceptance              ║
-- ║    - Visual distinction in history (labeled as revert)                  ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.revisions
  ADD COLUMN IF NOT EXISTS is_revert boolean DEFAULT false;

ALTER TABLE public.revisions
  ADD COLUMN IF NOT EXISTS reverted_revision_id uuid REFERENCES public.revisions(id);

ALTER TABLE public.revisions
  ADD COLUMN IF NOT EXISTS is_reverted boolean DEFAULT false;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 2: Update process_edit_acceptance to skip reverts                  ║
-- ║  Revert revisions and reverted revisions must NOT earn reputation.       ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

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
  -- EXCLUDE: revert revisions (is_revert = true) and reverted revisions (is_reverted = true)
  FOR v_revision IN
    SELECT r.id, r.author_id, r.node_id, r.content_size, r.created_at
    FROM public.revisions r
    WHERE r.acceptance_processed = false
      AND r.created_at < (NOW() - (p_hours_threshold || ' hours')::interval)
      AND COALESCE(r.is_revert, false) = false
      AND COALESCE(r.is_reverted, false) = false
    ORDER BY r.created_at ASC
    LIMIT 50
  LOOP
    -- Calculate character delta vs previous revision of the same node
    SELECT COALESCE(content_size, 0) INTO v_prev_size
    FROM public.revisions
    WHERE node_id = v_revision.node_id
      AND created_at < v_revision.created_at
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_prev_size IS NULL THEN
      v_prev_size := 0;
    END IF;

    v_char_delta := ABS(COALESCE(v_revision.content_size, 0) - v_prev_size);
    v_is_minor := (v_char_delta < 50);
    v_points := CASE WHEN v_is_minor THEN 2 ELSE 5 END;

    -- 1. Mark revision as processed
    UPDATE public.revisions SET acceptance_processed = true WHERE id = v_revision.id;

    -- 2. Increment accepted_edits_count on the author's profile
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

    -- 4. Update reputation_score on profile
    UPDATE public.profiles
    SET reputation_score = COALESCE(reputation_score, 0) + v_points
    WHERE id = v_revision.author_id;

    v_count := v_count + 1;
  END LOOP;

  -- Also mark any revert/reverted revisions as processed so they don't
  -- show up in future queries (without awarding anything)
  UPDATE public.revisions
  SET acceptance_processed = true
  WHERE acceptance_processed = false
    AND created_at < (NOW() - (p_hours_threshold || ' hours')::interval)
    AND (COALESCE(is_revert, false) = true OR COALESCE(is_reverted, false) = true);

  RETURN json_build_object('processed', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_edit_acceptance TO authenticated;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 3: Update recent_changes_view for revert awareness                ║
-- ║  Reverts and reverted edits are labeled distinctly in the feed.          ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

DROP VIEW IF EXISTS public.recent_changes_view;

CREATE OR REPLACE VIEW public.recent_changes_view AS

-- 1. Revisions (with revert distinction)
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

-- Ensure anon and authenticated can read the view
GRANT SELECT ON public.recent_changes_view TO anon, authenticated;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  DONE                                                                   ║
-- ║  Verify:                                                                ║
-- ║    SELECT column_name FROM information_schema.columns                   ║
-- ║      WHERE table_name = 'revisions'                                     ║
-- ║      AND column_name IN ('is_revert', 'reverted_revision_id',           ║
-- ║                          'is_reverted');                                 ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

