-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  SIDDHANT: Peer Review System — Patch (run AFTER peer_review_migration)  ║
-- ║                                                                          ║
-- ║  This patch:                                                             ║
-- ║    1. Fixes "policy already exists" errors by dropping before create     ║
-- ║    2. Adds quality_reviewed_revision_id to nodes table                   ║
-- ║       — records which revision earned the current quality tier           ║
-- ║    3. Updates close_review_cycle RPC to set this field on advancement    ║
-- ║    4. Handles ALTER TABLE for snapshot/reviewed_revision_id columns       ║
-- ║       (adds them safely if migration was run without them)               ║
-- ╚════════════════════════════════════════════════════════════════════════════╝


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  PART 1: Fix "policy already exists" — Drop before recreating            ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS "review_cycles_read"   ON public.review_cycles;
DROP POLICY IF EXISTS "review_cycles_insert" ON public.review_cycles;
DROP POLICY IF EXISTS "peer_reviews_read"      ON public.peer_reviews;
DROP POLICY IF EXISTS "peer_reviews_read_anon" ON public.peer_reviews;
DROP POLICY IF EXISTS "peer_reviews_insert"    ON public.peer_reviews;

-- Re-create policies
CREATE POLICY "review_cycles_read" ON public.review_cycles
  FOR SELECT USING (true);

CREATE POLICY "review_cycles_insert" ON public.review_cycles
  FOR INSERT WITH CHECK (auth.uid() = initiated_by);

CREATE POLICY "peer_reviews_read" ON public.peer_reviews
  FOR SELECT USING (
    reviewer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM review_cycles rc
      WHERE rc.id = peer_reviews.cycle_id AND rc.status IN ('closed', 'awaiting_conclusion')
    )
  );

CREATE POLICY "peer_reviews_read_anon" ON public.peer_reviews
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM review_cycles rc
      WHERE rc.id = peer_reviews.cycle_id AND rc.status IN ('closed', 'awaiting_conclusion')
    )
  );

CREATE POLICY "peer_reviews_insert" ON public.peer_reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  PART 2: Add snapshot/reviewed revision columns (safe ALTER TABLE)       ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- Add snapshot_revision_id to review_cycles if not already there
ALTER TABLE public.review_cycles
  ADD COLUMN IF NOT EXISTS snapshot_revision_id uuid REFERENCES public.revisions(id);

-- Add reviewed_revision_id to peer_reviews if not already there
ALTER TABLE public.peer_reviews
  ADD COLUMN IF NOT EXISTS reviewed_revision_id uuid REFERENCES public.revisions(id);

-- Add cycle_type for challenge cycles (advancement vs re-review)
ALTER TABLE public.review_cycles
  ADD COLUMN IF NOT EXISTS cycle_type text NOT NULL DEFAULT 'advancement';

-- Expand outcome constraint to include 'downgraded'
-- We need to drop and re-add the check constraint
ALTER TABLE public.review_cycles
  DROP CONSTRAINT IF EXISTS review_cycles_outcome_check;
ALTER TABLE public.review_cycles
  ADD CONSTRAINT review_cycles_outcome_check
  CHECK (outcome IN ('advanced', 'maintained', 'split', 'downgraded'));

-- Add cycle_type constraint
ALTER TABLE public.review_cycles
  DROP CONSTRAINT IF EXISTS review_cycles_cycle_type_check;
ALTER TABLE public.review_cycles
  ADD CONSTRAINT review_cycles_cycle_type_check
  CHECK (cycle_type IN ('advancement', 'challenge'));


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  PART 3: Add quality_reviewed_revision_id to the nodes table             ║
-- ║                                                                          ║
-- ║  DESIGN RATIONALE:                                                       ║
-- ║    quality_tier is a node-level property — it reflects the node's        ║
-- ║    standing, not a specific revision. Tiers are NOT auto-removed when    ║
-- ║    content is edited (that would be disruptive and unfair for typo       ║
-- ║    fixes or minor additions).                                            ║
-- ║                                                                          ║
-- ║    However, radical transparency requires that readers know whether the  ║
-- ║    current content is what was actually reviewed. So we record           ║
-- ║    quality_reviewed_revision_id — the revision the tier was earned on.  ║
-- ║    If the latest revision differs, the UI surfaces this transparently.   ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.nodes
  ADD COLUMN IF NOT EXISTS quality_reviewed_revision_id uuid REFERENCES public.revisions(id);


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  PART 4: Update close_review_cycle RPC to record reviewed revision       ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.close_review_cycle(
  p_cycle_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle         record;
  v_review_count  int;
  v_meets_count   int;
  v_total_reviews int;
  v_outcome       text;
  v_review        record;
  v_has_low_score boolean := false;
  v_criteria_key  text;
  v_score_val     numeric;
  v_result_text   text;
  v_previous_tier text;
  v_contributor   record;
  v_total_size    bigint;
  v_base_points   int;
  v_points        int;
  v_current_rev   uuid;
  v_content_changed boolean := false;
BEGIN
  -- 1. Get the cycle
  SELECT * INTO v_cycle FROM review_cycles WHERE id = p_cycle_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cycle not found');
  END IF;
  IF v_cycle.status = 'closed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cycle already closed');
  END IF;

  -- 2. Count reviews
  SELECT count(*) INTO v_total_reviews FROM peer_reviews WHERE cycle_id = p_cycle_id;
  IF v_total_reviews < v_cycle.min_reviews THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not enough reviews to close');
  END IF;

  -- 3. Count "meets_standard" recommendations
  SELECT count(*) INTO v_meets_count FROM peer_reviews
    WHERE cycle_id = p_cycle_id AND recommendation = 'meets_standard';

  -- 4. Check for low criterion scores (any criterion below 3 in any review)
  FOR v_review IN SELECT criteria_scores FROM peer_reviews WHERE cycle_id = p_cycle_id
  LOOP
    FOR v_criteria_key, v_score_val IN
      SELECT key, (value->>'score')::numeric
      FROM jsonb_each(v_review.criteria_scores)
    LOOP
      IF v_score_val < 3 THEN
        v_has_low_score := true;
      END IF;
    END LOOP;
  END LOOP;

  -- 5a. Determine outcome
  IF v_cycle.cycle_type = 'challenge' THEN
    -- CHALLENGE CYCLE: reviewers are assessing whether content STILL meets the standard
    -- 'meets_standard' = tier should stay, 'needs_work'/'not_ready' = tier should drop
    IF v_meets_count = v_total_reviews AND NOT v_has_low_score THEN
      -- All reviewers confirm: tier is maintained
      v_outcome := 'maintained';
      v_result_text := 'Quality confirmed. All ' || v_total_reviews || ' reviewer(s) confirm the content still meets ' || v_cycle.target_tier || ' standard.';
    ELSIF v_meets_count = 0 THEN
      -- No reviewer says it meets standard → downgrade
      v_outcome := 'downgraded';
      v_result_text := 'Quality challenge sustained. Reviewer(s) agree the content no longer meets the ' || v_cycle.target_tier || ' standard.';
    ELSIF v_meets_count > 0 AND v_meets_count < v_total_reviews THEN
      v_outcome := 'split';
      v_result_text := 'Reviewers are split. ' || v_meets_count || ' of ' || v_total_reviews || ' confirm the content still meets standard.';
    ELSE
      v_outcome := 'maintained';
      v_result_text := 'Quality confirmed despite low scores in some criteria.';
    END IF;
  ELSE
    -- ADVANCEMENT CYCLE: normal promotion logic
    IF v_cycle.target_tier = 'good_article' THEN
      IF v_meets_count = v_total_reviews AND NOT v_has_low_score THEN
        v_outcome := 'advanced';
        v_result_text := 'All reviewers recommend advancement. No criterion scored below 3.';
      ELSIF v_meets_count > 0 AND v_total_reviews > 1 THEN
        v_outcome := 'split';
        v_result_text := 'Reviewers are split. ' || v_meets_count || ' of ' || v_total_reviews || ' recommend advancement.';
      ELSE
        v_outcome := 'maintained';
        v_result_text := 'Reviewer(s) identified areas needing improvement before advancement.';
      END IF;
    ELSE
      IF v_meets_count = v_total_reviews AND NOT v_has_low_score THEN
        v_outcome := 'advanced';
        v_result_text := 'Consensus reached. All ' || v_total_reviews || ' reviewers recommend Featured status.';
      ELSIF v_meets_count > 0 AND v_meets_count < v_total_reviews THEN
        v_outcome := 'split';
        v_result_text := 'Reviewers are split. ' || v_meets_count || ' of ' || v_total_reviews || ' recommend advancement.';
      ELSE
        v_outcome := 'maintained';
        v_result_text := 'Reviewers agree more work is needed before Featured advancement.';
      END IF;
    END IF;
  END IF;

  -- 5b. Check if content was edited during the review cycle
  SELECT id INTO v_current_rev FROM revisions
    WHERE node_id = v_cycle.node_id
    ORDER BY created_at DESC LIMIT 1;
  IF v_cycle.snapshot_revision_id IS NOT NULL
     AND v_current_rev IS NOT NULL
     AND v_current_rev != v_cycle.snapshot_revision_id THEN
    v_content_changed := true;
    v_result_text := v_result_text || ' ⚠ Note: Content was edited after the review cycle was opened.';
  END IF;

  -- 6. Close the cycle
  UPDATE review_cycles SET
    status = 'closed',
    outcome = v_outcome,
    result_summary = v_result_text,
    closed_at = now()
  WHERE id = p_cycle_id;

  -- 7. Set aligned_with_outcome + award alignment rep
  -- Split outcomes: leave aligned_with_outcome as NULL (no one is right or wrong)
  IF v_outcome IN ('advanced', 'maintained', 'downgraded') THEN
    FOR v_review IN SELECT id, reviewer_id, recommendation FROM peer_reviews WHERE cycle_id = p_cycle_id
    LOOP
      -- For challenge cycles, alignment logic is about whether the reviewer agreed with the final outcome
      IF (v_outcome = 'advanced' AND v_review.recommendation = 'meets_standard')
         OR (v_outcome = 'maintained' AND v_cycle.cycle_type = 'advancement' AND v_review.recommendation != 'meets_standard')
         OR (v_outcome = 'maintained' AND v_cycle.cycle_type = 'challenge' AND v_review.recommendation = 'meets_standard')
         OR (v_outcome = 'downgraded' AND v_review.recommendation != 'meets_standard')
      THEN
        UPDATE peer_reviews SET aligned_with_outcome = true WHERE id = v_review.id;
        INSERT INTO reputation_events (
          user_id, event_type, source_id, source_type, description, points
        ) VALUES (
          v_review.reviewer_id, 'peer_review_aligned', v_review.id, 'peer_review',
          'Review aligned with consensus outcome', 2
        );
        UPDATE profiles
          SET reputation_score = COALESCE(reputation_score, 0) + 2
          WHERE id = v_review.reviewer_id;
      ELSE
        UPDATE peer_reviews SET aligned_with_outcome = false WHERE id = v_review.id;
      END IF;
    END LOOP;
  END IF;

  -- 8. If advanced: update quality_tier, record reviewed revision, award contributor rep
  IF v_outcome = 'advanced' THEN
    SELECT quality_tier INTO v_previous_tier FROM nodes WHERE id = v_cycle.node_id;

    UPDATE nodes
      SET quality_tier = v_cycle.target_tier,
          quality_reviewed_revision_id = COALESCE(v_cycle.snapshot_revision_id, v_current_rev)
      WHERE id = v_cycle.node_id;

    INSERT INTO quality_assessments (
      node_id, assessor_id, previous_tier, new_tier,
      justification, confidence
    ) VALUES (
      v_cycle.node_id,
      v_cycle.initiated_by,
      COALESCE(v_previous_tier, 'stub'),
      v_cycle.target_tier,
      'Advanced via peer review cycle: ' || v_result_text,
      'high'
    );

    v_base_points := CASE v_cycle.target_tier
      WHEN 'good_article' THEN 25
      WHEN 'featured' THEN 40
      ELSE 10
    END;
    SELECT COALESCE(SUM(content_size), 0) INTO v_total_size
      FROM revisions WHERE node_id = v_cycle.node_id;

    IF v_total_size > 0 THEN
      FOR v_contributor IN
        SELECT author_id, COALESCE(SUM(content_size), 0) AS author_size
        FROM revisions
        WHERE node_id = v_cycle.node_id
        GROUP BY author_id
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM reputation_events
          WHERE user_id = v_contributor.author_id
            AND source_id = v_cycle.node_id
            AND event_type = 'tier_advancement_bonus'
            AND description LIKE '%Node advanced to ' || v_cycle.target_tier || '%'
        ) THEN
          v_points := GREATEST(1, ROUND(v_base_points * (v_contributor.author_size::numeric / v_total_size)));
          INSERT INTO reputation_events (
            user_id, event_type, source_id, source_type, description, points
          ) VALUES (
            v_contributor.author_id, 'tier_advancement_bonus', v_cycle.node_id, 'node',
            'Node advanced to ' || v_cycle.target_tier || ' via peer review', v_points
          );
          UPDATE profiles
            SET reputation_score = COALESCE(reputation_score, 0) + v_points
            WHERE id = v_contributor.author_id;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- 9. If downgraded (challenge sustained): demote the node
  IF v_outcome = 'downgraded' THEN
    SELECT quality_tier INTO v_previous_tier FROM nodes WHERE id = v_cycle.node_id;

    -- Downgrade to the prerequisite tier
    UPDATE nodes
      SET quality_tier = CASE v_cycle.target_tier
            WHEN 'featured'     THEN 'good_article'
            WHEN 'good_article' THEN 'b_class'
            ELSE 'b_class'
          END,
          quality_reviewed_revision_id = NULL
      WHERE id = v_cycle.node_id;

    INSERT INTO quality_assessments (
      node_id, assessor_id, previous_tier, new_tier,
      justification, confidence
    ) VALUES (
      v_cycle.node_id,
      v_cycle.initiated_by,
      COALESCE(v_previous_tier, 'stub'),
      CASE v_cycle.target_tier
        WHEN 'featured'     THEN 'good_article'
        WHEN 'good_article' THEN 'b_class'
        ELSE 'b_class'
      END,
      'Downgraded via quality challenge: ' || v_result_text,
      'high'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'outcome', v_outcome,
    'result_summary', v_result_text
  );
END;
$$;

-- Ensure grants are still set
GRANT EXECUTE ON FUNCTION public.close_review_cycle TO authenticated;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  PART 5: Update assess_quality_tier to clear quality_reviewed_revision_id║
-- ║                                                                          ║
-- ║  When a node is individually assessed (lower tiers only — GA/Featured    ║
-- ║  are blocked), clear the reviewed revision pointer. If someone moves a   ║
-- ║  node that was previously a Good Article back to Solid, the "reviewed    ║
-- ║  at earlier revision" indicator should also clear.                       ║
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

  -- Update quality tier and clear the reviewed revision pointer.
  -- Individual assessment is for lower tiers — if this is called it means
  -- the node is no longer at a peer-reviewed tier, so the pointer is stale.
  UPDATE public.nodes
    SET quality_tier = p_new_tier,
        quality_reviewed_revision_id = NULL
    WHERE id = p_node_id;

  -- Log the assessment
  INSERT INTO public.quality_assessments (node_id, assessor_id, previous_tier, new_tier, justification, confidence)
  VALUES (p_node_id, p_assessor_id, v_old_tier, p_new_tier, p_justification, p_confidence);

  RETURN json_build_object('success', true, 'previous_tier', v_old_tier, 'new_tier', p_new_tier);
END;
$$;

GRANT EXECUTE ON FUNCTION public.assess_quality_tier TO authenticated;
