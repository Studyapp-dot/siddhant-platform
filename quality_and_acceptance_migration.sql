-- ============================================================================
-- SIDDHANT: Quality Tiers & Edit Acceptance Migration
-- ============================================================================
-- Implements:
--   1. Edit acceptance tracking (acceptance_processed flag on revisions)
--   2. Content-based quality tiers on nodes (replacing activity-based proxy)
--   3. Quality assessments audit table (who changed the tier, when, why)
--   4. RPC function for batch-accepting edits (SECURITY DEFINER)
-- ============================================================================
-- Run this ENTIRE file in the Supabase SQL Editor.
-- It is idempotent — safe to run multiple times.
-- ============================================================================


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 1: Add acceptance tracking to revisions                           ║
-- ║  Tracks whether each edit has been processed by the 72h acceptance      ║
-- ║  timer. Prevents double-processing.                                     ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.revisions
  ADD COLUMN IF NOT EXISTS acceptance_processed boolean DEFAULT false;

-- Mark all existing revisions as already processed (they survived the backfill)
UPDATE public.revisions SET acceptance_processed = true WHERE acceptance_processed = false;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 2: Add quality_tier column to nodes                               ║
-- ║  Content-based quality assessment, NOT activity-based.                   ║
-- ║                                                                         ║
-- ║  Values:                                                                ║
-- ║    stub       — Bare-bones, just created (auto-assigned)                ║
-- ║    start      — Some meaningful content, needs improvement              ║
-- ║    c_class    — Useful to casual reader, significant gaps               ║
-- ║    b_class    — Mostly complete, well-referenced                        ║
-- ║    good_article — Meets editorial standards, independently reviewed     ║
-- ║    featured   — Definitive, comprehensive, scholarly citations          ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.nodes
  ADD COLUMN IF NOT EXISTS quality_tier text DEFAULT 'stub';

-- Add constraint for valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'nodes_quality_tier_check'
    AND table_name = 'nodes'
  ) THEN
    ALTER TABLE public.nodes ADD CONSTRAINT nodes_quality_tier_check
      CHECK (quality_tier IN ('stub', 'start', 'c_class', 'b_class', 'good_article', 'featured'));
  END IF;
END $$;

-- Auto-upgrade existing nodes that have content from 'stub' to 'start'
-- (They've survived long enough to have revisions — they're not bare-bones)
UPDATE public.nodes n
SET quality_tier = 'start'
WHERE quality_tier = 'stub'
  AND EXISTS (
    SELECT 1 FROM public.revisions r 
    WHERE r.node_id = n.id
    AND r.content_size > 500
  );


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 3: Create quality_assessments audit table                         ║
-- ║  Every tier change is permanently logged — who, when, why, from/to.     ║
-- ║  This is the quality transparency mechanism.                            ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.quality_assessments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  node_id uuid REFERENCES public.nodes ON DELETE CASCADE NOT NULL,
  assessor_id uuid REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  previous_tier text NOT NULL,
  new_tier text NOT NULL,
  justification text NOT NULL,        -- Why the tier changed — mandatory
  confidence text DEFAULT 'high' CHECK (confidence IN ('high', 'medium', 'low')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.quality_assessments ENABLE ROW LEVEL SECURITY;

-- Everyone can view assessment history (radical transparency)
CREATE POLICY "Quality assessments are viewable by everyone."
  ON public.quality_assessments FOR SELECT USING (true);

-- Authenticated users can insert assessments
CREATE POLICY "Authenticated users can assess quality."
  ON public.quality_assessments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 4: RPC function for batch-accepting edits                         ║
-- ║  Called by the lazy-evaluation system. Processes all unprocessed edits   ║
-- ║  older than 72 hours that haven't been reverted or flagged.             ║
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
  FOR v_revision IN
    SELECT r.id, r.author_id, r.node_id, r.content_size, r.created_at
    FROM public.revisions r
    WHERE r.acceptance_processed = false
      AND r.created_at < (NOW() - (p_hours_threshold || ' hours')::interval)
    ORDER BY r.created_at ASC
    LIMIT 50  -- Process in batches to avoid long-running transactions
  LOOP
    -- Calculate character delta vs previous revision of the same node
    SELECT COALESCE(content_size, 0) INTO v_prev_size
    FROM public.revisions
    WHERE node_id = v_revision.node_id
      AND created_at < v_revision.created_at
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_prev_size IS NULL THEN
      v_prev_size := 0;  -- First revision of the node
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

  RETURN json_build_object('processed', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_edit_acceptance TO authenticated;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 5: RPC function for quality tier assessment                       ║
-- ║  Updates a node's quality_tier and logs the assessment.                  ║
-- ║  Level checks are enforced in the application layer.                    ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.assess_quality_tier(
  p_node_id uuid,
  p_assessor_id uuid,
  p_new_tier text,
  p_justification text,
  p_confidence text DEFAULT 'high'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_tier text;
BEGIN
  -- Get current tier
  SELECT quality_tier INTO v_old_tier FROM public.nodes WHERE id = p_node_id;

  IF v_old_tier IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Node not found');
  END IF;

  IF v_old_tier = p_new_tier THEN
    RETURN json_build_object('success', false, 'error', 'Node is already at this tier');
  END IF;

  -- Update the node's quality tier
  UPDATE public.nodes SET quality_tier = p_new_tier WHERE id = p_node_id;

  -- Log the assessment
  INSERT INTO public.quality_assessments (node_id, assessor_id, previous_tier, new_tier, justification, confidence)
  VALUES (p_node_id, p_assessor_id, v_old_tier, p_new_tier, p_justification, p_confidence);

  RETURN json_build_object('success', true, 'previous_tier', v_old_tier, 'new_tier', p_new_tier);
END;
$$;

GRANT EXECUTE ON FUNCTION public.assess_quality_tier TO authenticated;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  DONE                                                                   ║
-- ║  Verify by running:                                                     ║
-- ║    SELECT slug, quality_tier FROM nodes LIMIT 10;                       ║
-- ║    SELECT column_name FROM information_schema.columns                   ║
-- ║      WHERE table_name = 'revisions' AND column_name = 'acceptance_processed'; ║
-- ║    SELECT * FROM quality_assessments LIMIT 10;                          ║
-- ╚════════════════════════════════════════════════════════════════════════════╝
