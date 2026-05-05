-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  SIDDHANT: Peer Review System — Database Migration                       ║
-- ║                                                                          ║
-- ║  Peer review is the formal process for advancing nodes to               ║
-- ║  Good Article and Featured tiers. Lower tiers (Draft → Developing →     ║
-- ║  Useful → Solid) use individual editor assessment (already built).       ║
-- ║                                                                          ║
-- ║  Good Article: 1 independent L3+ reviewer                               ║
-- ║  Featured:     2+ independent L4+ reviewers (consensus required)         ║
-- ║                                                                          ║
-- ║  Steps:                                                                  ║
-- ║    1. Create review_cycles table                                         ║
-- ║    2. Create peer_reviews table                                          ║
-- ║    3. Create submit_peer_review RPC                                      ║
-- ║    4. Create close_review_cycle RPC                                      ║
-- ║    5. Set up RLS policies (anchoring-safe visibility)                    ║
-- ║    6. Update recent_changes_view                                         ║
-- ╚════════════════════════════════════════════════════════════════════════════╝


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 1: review_cycles — Tracks formal review cycles for top-tier nodes  ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.review_cycles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id       uuid NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  target_tier   text NOT NULL CHECK (target_tier IN ('good_article', 'featured')),
  initiated_by  uuid NOT NULL REFERENCES public.profiles(id),
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  outcome       text CHECK (outcome IN ('advanced', 'maintained', 'split', 'downgraded')),
  -- 'advancement' = normal: node is at prerequisite tier, seeking promotion
  -- 'challenge'   = re-review: node is already at target tier, quality being questioned
  cycle_type    text NOT NULL DEFAULT 'advancement' CHECK (cycle_type IN ('advancement', 'challenge')),
  min_reviews   int NOT NULL DEFAULT 1,
  result_summary text,
  -- Revision snapshot: the latest revision ID at the time the cycle was opened.
  -- Used to detect if content was edited while review is pending.
  snapshot_revision_id uuid REFERENCES public.revisions(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  closed_at     timestamptz
);

-- Index for quick lookup of active cycles per node
CREATE INDEX IF NOT EXISTS idx_review_cycles_node_id ON public.review_cycles(node_id);
CREATE INDEX IF NOT EXISTS idx_review_cycles_status ON public.review_cycles(status);

-- Only one open cycle per node at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_cycles_one_open 
  ON public.review_cycles(node_id) WHERE status = 'open';

ALTER TABLE public.review_cycles ENABLE ROW LEVEL SECURITY;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 2: peer_reviews — Individual structured reviews within a cycle     ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.peer_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id        uuid NOT NULL REFERENCES public.review_cycles(id) ON DELETE CASCADE,
  node_id         uuid NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  reviewer_id     uuid NOT NULL REFERENCES public.profiles(id),
  recommendation  text NOT NULL CHECK (recommendation IN ('meets_standard', 'needs_work', 'not_ready')),
  confidence      text NOT NULL DEFAULT 'high' CHECK (confidence IN ('high', 'medium', 'low')),
  overall_comment text NOT NULL,
  criteria_scores jsonb NOT NULL DEFAULT '{}',
  rubric_version  text NOT NULL DEFAULT 'v1',
  aligned_with_outcome boolean,
  -- Which revision the reviewer was looking at when they submitted.
  -- Allows us to detect if the content changed since the review.
  reviewed_revision_id uuid REFERENCES public.revisions(id),
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- One review per reviewer per cycle
  UNIQUE(cycle_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_peer_reviews_cycle_id ON public.peer_reviews(cycle_id);
CREATE INDEX IF NOT EXISTS idx_peer_reviews_node_id ON public.peer_reviews(node_id);
CREATE INDEX IF NOT EXISTS idx_peer_reviews_reviewer ON public.peer_reviews(reviewer_id);

ALTER TABLE public.peer_reviews ENABLE ROW LEVEL SECURITY;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 3: submit_peer_review RPC — SECURITY DEFINER                      ║
-- ║                                                                          ║
-- ║  Inserts a review, increments peer_reviews_completed on the reviewer's   ║
-- ║  profile, and awards reputation. Does NOT auto-close the cycle —         ║
-- ║  closing is handled by the application layer for flexibility.            ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- Drop possible overloaded versions first to avoid "function name is not unique" errors
DROP FUNCTION IF EXISTS public.submit_peer_review(uuid, uuid, uuid, text, text, text, jsonb, text);
DROP FUNCTION IF EXISTS public.submit_peer_review(uuid, uuid, uuid, text, text, text, jsonb, text, uuid);

CREATE OR REPLACE FUNCTION public.submit_peer_review(
  p_cycle_id        uuid,
  p_node_id         uuid,
  p_reviewer_id     uuid,
  p_recommendation  text,
  p_confidence      text,
  p_overall_comment text,
  p_criteria_scores jsonb,
  p_rubric_version  text DEFAULT 'v1',
  p_reviewed_revision_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle     record;
  v_existing  int;
  v_review_id uuid;
  v_count     int;
BEGIN
  -- 1. Validate cycle exists and is open
  SELECT * INTO v_cycle FROM review_cycles WHERE id = p_cycle_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Review cycle not found');
  END IF;
  IF v_cycle.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Review cycle is already closed');
  END IF;

  -- 2. Check reviewer hasn't already submitted
  SELECT count(*) INTO v_existing FROM peer_reviews
    WHERE cycle_id = p_cycle_id AND reviewer_id = p_reviewer_id;
  IF v_existing > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already submitted a review for this cycle');
  END IF;

  -- 3. Insert the review
  INSERT INTO peer_reviews (
    cycle_id, node_id, reviewer_id, recommendation,
    confidence, overall_comment, criteria_scores, rubric_version,
    reviewed_revision_id
  ) VALUES (
    p_cycle_id, p_node_id, p_reviewer_id, p_recommendation,
    p_confidence, p_overall_comment, p_criteria_scores, p_rubric_version,
    p_reviewed_revision_id
  ) RETURNING id INTO v_review_id;

  -- 4. Increment peer_reviews_completed on reviewer's profile
  UPDATE profiles
    SET peer_reviews_completed = COALESCE(peer_reviews_completed, 0) + 1
    WHERE id = p_reviewer_id;

  -- 5. Award +3 rep for completing a review
  INSERT INTO reputation_events (
    user_id, event_type, source_id, source_type, description, points
  ) VALUES (
    p_reviewer_id, 'peer_review_completed', v_review_id, 'peer_review',
    'Completed structured peer review', 3
  );
  UPDATE profiles
    SET reputation_score = COALESCE(reputation_score, 0) + 3
    WHERE id = p_reviewer_id;

  -- 6. Count total reviews in this cycle
  SELECT count(*) INTO v_count FROM peer_reviews WHERE cycle_id = p_cycle_id;

  RETURN jsonb_build_object(
    'success', true,
    'review_id', v_review_id,
    'review_count', v_count,
    'min_reviews', v_cycle.min_reviews
  );
END;
$$;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 4: close_review_cycle RPC — Calculate consensus & advance tier     ║
-- ║                                                                          ║
-- ║  Called by the application when minimum reviews are reached.             ║
-- ║  Calculates outcome, sets aligned_with_outcome on each review,           ║
-- ║  awards alignment rep, and advances the node tier if consensus.          ║
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

  -- 5. Determine outcome
  IF v_cycle.target_tier = 'good_article' THEN
    -- Good Article: single reviewer determines outcome
    IF v_meets_count = v_total_reviews AND NOT v_has_low_score THEN
      v_outcome := 'advanced';
      v_result_text := 'All reviewers recommend advancement. No criterion scored below 3.';
    ELSIF v_meets_count > 0 AND v_total_reviews > 1 THEN
      -- Split: some say advance, some say not
      v_outcome := 'split';
      v_result_text := 'Reviewers are split. ' || v_meets_count || ' of ' || v_total_reviews || ' recommend advancement.';
    ELSE
      v_outcome := 'maintained';
      v_result_text := 'Reviewer(s) identified areas needing improvement before advancement.';
    END IF;
  ELSE
    -- Featured: consensus among 2+ reviewers
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

  -- 5b. Check if content was edited during the review cycle
  IF v_cycle.snapshot_revision_id IS NOT NULL THEN
    SELECT id INTO v_current_rev FROM revisions
      WHERE node_id = v_cycle.node_id
      ORDER BY created_at DESC LIMIT 1;
    IF v_current_rev IS NOT NULL AND v_current_rev != v_cycle.snapshot_revision_id THEN
      v_content_changed := true;
      v_result_text := v_result_text || ' ⚠ Note: Content was edited after the review cycle was opened.';
    END IF;
  END IF;

  -- 6. Close the cycle
  UPDATE review_cycles SET
    status = 'closed',
    outcome = v_outcome,
    result_summary = v_result_text,
    closed_at = now()
  WHERE id = p_cycle_id;

  -- 7. Set aligned_with_outcome on each review + award alignment rep
  -- Note: split outcomes leave aligned_with_outcome as NULL — no one is "right" or "wrong"
  IF v_outcome = 'advanced' OR v_outcome = 'maintained' THEN
    FOR v_review IN SELECT id, reviewer_id, recommendation FROM peer_reviews WHERE cycle_id = p_cycle_id
    LOOP
      IF (v_outcome = 'advanced' AND v_review.recommendation = 'meets_standard')
         OR (v_outcome = 'maintained' AND v_review.recommendation != 'meets_standard')
      THEN
        -- Aligned with outcome
        UPDATE peer_reviews SET aligned_with_outcome = true WHERE id = v_review.id;
        -- Award +2 alignment rep
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
        -- Diverged from outcome
        UPDATE peer_reviews SET aligned_with_outcome = false WHERE id = v_review.id;
      END IF;
    END LOOP;
  END IF;
  -- Split outcomes: aligned_with_outcome stays NULL for all reviews

  -- 8. If advanced, update the node's quality_tier
  IF v_outcome = 'advanced' THEN
    -- Capture previous tier BEFORE updating
    SELECT quality_tier INTO v_previous_tier FROM nodes WHERE id = v_cycle.node_id;

    UPDATE nodes SET quality_tier = v_cycle.target_tier WHERE id = v_cycle.node_id;

    -- Log it in quality_assessments for the audit trail
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

    -- Award proportional tier_advancement_bonus rep to content contributors
    -- (matches logic in quality.ts — base 10 points per tier jump)
    v_base_points := 10; -- one tier jump (b_class→good_article or good_article→featured)
    SELECT COALESCE(SUM(content_size), 0) INTO v_total_size FROM revisions WHERE node_id = v_cycle.node_id;

    IF v_total_size > 0 THEN
      FOR v_contributor IN
        SELECT author_id, COALESCE(SUM(content_size), 0) AS author_size
        FROM revisions
        WHERE node_id = v_cycle.node_id
        GROUP BY author_id
      LOOP
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
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'outcome', v_outcome,
    'result_summary', v_result_text
  );
END;
$$;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 5: RLS Policies                                                    ║
-- ║                                                                          ║
-- ║  Key design: while a cycle is OPEN, reviewers can only see their own     ║
-- ║  review (prevents anchoring bias). After CLOSED, all reviews visible     ║
-- ║  (radical transparency).                                                 ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- review_cycles: everyone can read, authenticated can insert
DROP POLICY IF EXISTS "review_cycles_read" ON public.review_cycles;
CREATE POLICY "review_cycles_read" ON public.review_cycles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "review_cycles_insert" ON public.review_cycles;
CREATE POLICY "review_cycles_insert" ON public.review_cycles
  FOR INSERT WITH CHECK (auth.uid() = initiated_by);

-- peer_reviews: anchoring-safe visibility
-- Read: see your own reviews always; see ALL reviews only when cycle is closed
DROP POLICY IF EXISTS "peer_reviews_read" ON public.peer_reviews;
CREATE POLICY "peer_reviews_read" ON public.peer_reviews
  FOR SELECT USING (
    reviewer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM review_cycles rc
      WHERE rc.id = peer_reviews.cycle_id AND rc.status = 'closed'
    )
  );

-- Anon users can see closed reviews (radical transparency)
DROP POLICY IF EXISTS "peer_reviews_read_anon" ON public.peer_reviews;
CREATE POLICY "peer_reviews_read_anon" ON public.peer_reviews
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM review_cycles rc
      WHERE rc.id = peer_reviews.cycle_id AND rc.status = 'closed'
    )
  );

DROP POLICY IF EXISTS "peer_reviews_insert" ON public.peer_reviews;
CREATE POLICY "peer_reviews_insert" ON public.peer_reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 6: Update recent_changes_view — Add peer review activity           ║
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
JOIN public.profiles p ON t.author_id = p.id

UNION ALL

-- 4. Peer Reviews — new activity type for quality monitoring
SELECT
  pr.id AS activity_id,
  pr.node_id,
  n.title AS node_title,
  n.slug AS node_slug,
  pr.reviewer_id AS author_id,
  p.username AS author_username,
  p.role AS author_role,
  p.reputation_score AS author_reputation,
  'peer_review' AS activity_type,
  'submitted ' ||
    CASE COALESCE(rc.cycle_type, 'advancement')
      WHEN 'challenge' THEN 'quality challenge'
      ELSE 'peer review'
    END || ' for ' ||
    CASE rc.target_tier
      WHEN 'good_article' THEN 'Good Article'
      WHEN 'featured' THEN 'Featured'
      ELSE rc.target_tier
    END || ' assessment' ||
    CASE
      WHEN rc.status = 'closed' THEN ' (cycle ' || COALESCE(rc.outcome, 'closed') || ')'
      ELSE ' (review cycle open)'
    END AS action_summary,
  pr.created_at
FROM public.peer_reviews pr
JOIN public.review_cycles rc ON pr.cycle_id = rc.id
JOIN public.nodes n ON pr.node_id = n.id
JOIN public.profiles p ON pr.reviewer_id = p.id;

-- Ensure anon and authenticated can read the view
GRANT SELECT ON public.recent_changes_view TO anon, authenticated;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  GRANTS                                                                  ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

GRANT SELECT, INSERT ON public.review_cycles TO authenticated;
GRANT SELECT ON public.review_cycles TO anon;
GRANT SELECT, INSERT ON public.peer_reviews TO authenticated;
GRANT SELECT ON public.peer_reviews TO anon;
GRANT EXECUTE ON FUNCTION public.submit_peer_review TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_review_cycle TO authenticated;
