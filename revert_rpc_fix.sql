-- ============================================================================
-- SIDDHANT: Revert System — RLS Fix
-- ============================================================================
-- The revert action needs to UPDATE revisions (set is_reverted = true),
-- but there's no UPDATE policy on the revisions table. Supabase RLS
-- silently blocks the update, which is why the "REVERTED" badge never
-- appears.
--
-- Solution: An RPC function (SECURITY DEFINER) that marks a revision
-- as reverted and creates the revert revision atomically.
-- ============================================================================

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
DECLARE
  v_new_revision_id uuid;
BEGIN
  -- 1. Mark the target revision as reverted
  UPDATE public.revisions
  SET is_reverted = true,
      acceptance_processed = true
  WHERE id = p_target_revision_id;

  -- 2. Create the revert revision
  INSERT INTO public.revisions (
    node_id, author_id, report_content, content_size,
    commit_message, is_revert, reverted_revision_id, acceptance_processed
  ) VALUES (
    p_node_id, p_reverter_id, p_restored_content, p_restored_size,
    p_commit_message, true, p_target_revision_id, true
  )
  RETURNING id INTO v_new_revision_id;

  RETURN json_build_object(
    'success', true,
    'revert_revision_id', v_new_revision_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_revert TO authenticated;


-- ============================================================================
-- Retroactive fix: Mark revisions that were previously reverted but
-- whose is_reverted flag was never set (due to the RLS bug).
-- This finds all revisions referenced by reverted_revision_id and marks them.
-- ============================================================================
UPDATE public.revisions
SET is_reverted = true,
    acceptance_processed = true
WHERE id IN (
  SELECT reverted_revision_id
  FROM public.revisions
  WHERE is_revert = true
    AND reverted_revision_id IS NOT NULL
)
AND COALESCE(is_reverted, false) = false;


-- ============================================================================
-- DONE — Run this in Supabase SQL Editor, then restart your dev server.
-- ============================================================================


-- ============================================================================
-- BONUS: RPC for closing discussions (same RLS problem — no UPDATE policy)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.close_discussion(
  p_discussion_id uuid,
  p_closer_id uuid,
  p_closing_summary text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.discussions
  SET status = 'closed',
      closed_by = p_closer_id,
      closed_at = NOW(),
      closing_summary = p_closing_summary
  WHERE id = p_discussion_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_discussion TO authenticated;


-- ============================================================================
-- Ensure discussions table has the columns needed for closing.
-- These may already exist from community_schema_migration.sql — safe to re-run.
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discussions' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.discussions
      ADD COLUMN status text DEFAULT 'open' CHECK (status IN ('open', 'closed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discussions' AND column_name = 'closed_by'
  ) THEN
    ALTER TABLE public.discussions
      ADD COLUMN closed_by uuid REFERENCES public.profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discussions' AND column_name = 'closed_at'
  ) THEN
    ALTER TABLE public.discussions
      ADD COLUMN closed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discussions' AND column_name = 'closing_summary'
  ) THEN
    ALTER TABLE public.discussions
      ADD COLUMN closing_summary text;
  END IF;
END $$;


-- ============================================================================
-- Update the discussion UPDATE policy to use new role hierarchy (Level 4+).
-- Drop old policy if it exists, then create new one.
-- ============================================================================
DROP POLICY IF EXISTS "Senior users can close discussions." ON public.discussions;

CREATE POLICY "Senior users can close discussions."
  ON public.discussions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('senior_scholar', 'steward', 'governance_council')
    )
  );


-- ============================================================================
-- ALL DONE — Run this in Supabase SQL Editor, then restart your dev server.
-- ============================================================================
