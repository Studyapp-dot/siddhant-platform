-- ============================================================================
-- SIDDHANT: Quality Governance Reforms — Migration
-- ============================================================================
-- This migration implements:
--   1. review_cycles: 'awaiting_conclusion' status + concluded_by + consensus_summary
--   2. quality_votes: community blind voting for lower tiers (stub → b_class)
--   3. compute_quality_tier: RPC to calculate consensus tier from votes
--   4. cast_quality_vote: RPC to record a vote and recompute tier
-- ============================================================================
-- Run this ENTIRE file in the Supabase SQL Editor.
-- It is idempotent — safe to run multiple times.
-- ============================================================================


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  PART 1: Update review_cycles for formal Senior Scholar sign-off        ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- Add concluded_by and consensus_summary columns
ALTER TABLE public.review_cycles
  ADD COLUMN IF NOT EXISTS concluded_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS consensus_summary TEXT;

-- Update the status check constraint to allow 'awaiting_conclusion'
-- First, drop the existing constraint if it exists, then recreate
DO $$
BEGIN
  -- Drop existing constraint
  ALTER TABLE public.review_cycles DROP CONSTRAINT IF EXISTS review_cycles_status_check;
  
  -- Add new constraint including 'awaiting_conclusion'
  ALTER TABLE public.review_cycles
    ADD CONSTRAINT review_cycles_status_check
    CHECK (status IN ('open', 'awaiting_conclusion', 'closed'));
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not update status constraint: %', SQLERRM;
END $$;

-- Update RLS policy if needed (awaiting_conclusion cycles should be readable)
-- The existing 'review_cycles_read' policy likely uses TRUE for SELECT,
-- so no change needed there.


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  PART 2: Quality Votes table for community blind voting                 ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.quality_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES public.profiles(id),
  voted_tier TEXT NOT NULL CHECK (voted_tier IN ('stub', 'start', 'c_class', 'b_class')),
  justification TEXT,  -- optional: voter can explain their reasoning
  revision_id UUID REFERENCES public.revisions(id),  -- tracks which revision was current when they voted
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT quality_votes_one_per_user UNIQUE (node_id, voter_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_quality_votes_node ON public.quality_votes(node_id);
CREATE INDEX IF NOT EXISTS idx_quality_votes_voter ON public.quality_votes(voter_id);

-- RLS policies
ALTER TABLE public.quality_votes ENABLE ROW LEVEL SECURITY;

-- Everyone can read votes (but the UI won't show the tally — blind voting is enforced client-side)
DO $$
BEGIN
  CREATE POLICY quality_votes_read ON public.quality_votes
    FOR SELECT USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Authenticated users can insert their own votes
DO $$
BEGIN
  CREATE POLICY quality_votes_insert ON public.quality_votes
    FOR INSERT WITH CHECK (auth.uid() = voter_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Users can update their own votes (to change their vote)
DO $$
BEGIN
  CREATE POLICY quality_votes_update ON public.quality_votes
    FOR UPDATE USING (auth.uid() = voter_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  PART 3: cast_quality_vote — RPC for recording a vote                   ║
-- ║  Handles upsert (insert or update), recomputes consensus, awards rep    ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- Drop existing function if it exists (clean re-create)
DROP FUNCTION IF EXISTS public.cast_quality_vote(uuid, uuid, text, text, uuid);

CREATE OR REPLACE FUNCTION public.cast_quality_vote(
  p_node_id UUID,
  p_voter_id UUID,
  p_voted_tier TEXT,
  p_justification TEXT DEFAULT NULL,
  p_revision_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_tier       TEXT;
  v_new_consensus  TEXT;
  v_vote_count     INT;
  v_existing_vote  TEXT;
  v_is_contributor BOOLEAN;
BEGIN
  -- 1. Validate tier value
  IF p_voted_tier NOT IN ('stub', 'start', 'c_class', 'b_class') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid tier. Must be stub, start, c_class, or b_class.');
  END IF;

  -- 2. Independence check: voter must not have contributed to the node
  SELECT EXISTS(
    SELECT 1 FROM revisions WHERE node_id = p_node_id AND author_id = p_voter_id
  ) INTO v_is_contributor;

  IF v_is_contributor THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot vote on the quality of a node you contributed to.');
  END IF;

  -- 3. Check if user already has a vote (for update path)
  SELECT voted_tier INTO v_existing_vote
    FROM quality_votes
    WHERE node_id = p_node_id AND voter_id = p_voter_id;

  -- 4. Upsert the vote
  INSERT INTO quality_votes (node_id, voter_id, voted_tier, justification, revision_id)
  VALUES (p_node_id, p_voter_id, p_voted_tier, p_justification, p_revision_id)
  ON CONFLICT (node_id, voter_id) DO UPDATE
    SET voted_tier = EXCLUDED.voted_tier,
        justification = EXCLUDED.justification,
        revision_id = EXCLUDED.revision_id,
        updated_at = now();

  -- 5. Get current node tier
  SELECT quality_tier INTO v_old_tier FROM nodes WHERE id = p_node_id;

  -- 6. Count total votes
  SELECT COUNT(*) INTO v_vote_count FROM quality_votes WHERE node_id = p_node_id;

  -- 7. Compute consensus tier (majority vote, minimum 3 votes to move above stub)
  IF v_vote_count >= 3 THEN
    -- Find the tier with the most votes
    SELECT voted_tier INTO v_new_consensus
      FROM quality_votes
      WHERE node_id = p_node_id
      GROUP BY voted_tier
      ORDER BY COUNT(*) DESC
      LIMIT 1;
  ELSE
    -- Not enough votes — keep current tier but don't move above stub unless we have 3+
    -- If current tier is already above stub from a previous consensus, keep it
    v_new_consensus := v_old_tier;
  END IF;

  -- 8. Only update if the tier actually changed AND the node is in the votable range
  -- (Don't override good_article or featured — those use peer review)
  IF v_new_consensus IS NOT NULL
     AND v_new_consensus != v_old_tier
     AND v_old_tier IN ('stub', 'start', 'c_class', 'b_class') THEN

    -- Update the node's quality tier
    UPDATE nodes SET quality_tier = v_new_consensus WHERE id = p_node_id;

    -- Log the assessment for audit trail
    INSERT INTO quality_assessments (node_id, assessor_id, previous_tier, new_tier, justification, confidence)
    VALUES (p_node_id, p_voter_id, v_old_tier, v_new_consensus, 'Community consensus via quality voting (' || v_vote_count || ' votes)', 'high');

    -- Award alignment reputation to all voters whose vote matches the new consensus
    INSERT INTO reputation_events (user_id, event_type, source_id, source_type, description, points)
    SELECT qv.voter_id, 'peer_review_aligned', p_node_id, 'node',
           'Quality vote aligned with community consensus (' || v_new_consensus || ')', 1
    FROM quality_votes qv
    WHERE qv.node_id = p_node_id
      AND qv.voted_tier = v_new_consensus
      -- Only award once per consensus shift: check they haven't already been awarded for this node
      AND NOT EXISTS (
        SELECT 1 FROM reputation_events re
        WHERE re.user_id = qv.voter_id
          AND re.source_id = p_node_id
          AND re.event_type = 'peer_review_aligned'
          AND re.description LIKE '%Quality vote aligned%' || v_new_consensus || '%'
      );

    -- Update reputation scores for aligned voters
    UPDATE profiles
      SET reputation_score = COALESCE(reputation_score, 0) + 1
      WHERE id IN (
        SELECT qv.voter_id FROM quality_votes qv
        WHERE qv.node_id = p_node_id
          AND qv.voted_tier = v_new_consensus
          AND NOT EXISTS (
            SELECT 1 FROM reputation_events re
            WHERE re.user_id = qv.voter_id
              AND re.source_id = p_node_id
              AND re.event_type = 'peer_review_aligned'
              AND re.description LIKE '%Quality vote aligned%' || v_new_consensus || '%'
          )
      );

    -- Award tier advancement bonus to node contributors if tier went UP
    DECLARE
      v_old_idx INT;
      v_new_idx INT;
      v_tier_order TEXT[] := ARRAY['stub', 'start', 'c_class', 'b_class', 'good_article', 'featured'];
      v_base_points INT;
      v_total_size BIGINT;
      v_contributor RECORD;
      v_points INT;
    BEGIN
      v_old_idx := array_position(v_tier_order, v_old_tier);
      v_new_idx := array_position(v_tier_order, v_new_consensus);

      IF v_new_idx > v_old_idx THEN
        -- Graduated base points
        v_base_points := CASE v_new_consensus
          WHEN 'start' THEN 5
          WHEN 'c_class' THEN 8
          WHEN 'b_class' THEN 12
          ELSE 10
        END;

        SELECT COALESCE(SUM(content_size), 0) INTO v_total_size
          FROM revisions WHERE node_id = p_node_id;

        IF v_total_size > 0 THEN
          FOR v_contributor IN
            SELECT author_id, COALESCE(SUM(content_size), 0) AS author_size
            FROM revisions WHERE node_id = p_node_id
            GROUP BY author_id
          LOOP
            IF NOT EXISTS (
              SELECT 1 FROM reputation_events
              WHERE user_id = v_contributor.author_id
                AND source_id = p_node_id
                AND event_type = 'tier_advancement_bonus'
                AND description LIKE '%Node advanced to ' || v_new_consensus || '%'
            ) THEN
              v_points := GREATEST(1, ROUND(v_base_points * (v_contributor.author_size::numeric / v_total_size)));
              INSERT INTO reputation_events (user_id, event_type, source_id, source_type, description, points)
              VALUES (v_contributor.author_id, 'tier_advancement_bonus', p_node_id, 'node',
                      'Node advanced to ' || v_new_consensus || ' via community consensus', v_points);
              UPDATE profiles
                SET reputation_score = COALESCE(reputation_score, 0) + v_points
                WHERE id = v_contributor.author_id;
            END IF;
          END LOOP;
        END IF;
      END IF;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'vote_count', v_vote_count,
    'consensus_tier', v_new_consensus,
    'previous_tier', v_old_tier,
    'is_update', v_existing_vote IS NOT NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cast_quality_vote TO authenticated;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  PART 4: get_quality_vote_summary — for the UI                          ║
-- ║  Blind BEFORE voting, transparent AFTER voting (like X/Twitter polls)   ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

DROP FUNCTION IF EXISTS public.get_quality_vote_summary(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_quality_vote_summary(
  p_node_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_votes INT;
  v_user_vote TEXT;
  v_user_revision_id UUID;
  v_breakdown jsonb;
BEGIN
  -- Count total votes
  SELECT COUNT(*) INTO v_total_votes FROM quality_votes WHERE node_id = p_node_id;

  -- Get user's current vote if they have one
  IF p_user_id IS NOT NULL THEN
    SELECT voted_tier, revision_id INTO v_user_vote, v_user_revision_id
      FROM quality_votes
      WHERE node_id = p_node_id AND voter_id = p_user_id;
  END IF;

  -- If user has already voted, include the full breakdown (transparent after voting)
  -- If user hasn't voted, return NULL breakdown (blind before voting)
  IF v_user_vote IS NOT NULL THEN
    SELECT jsonb_object_agg(tier, cnt) INTO v_breakdown
    FROM (
      SELECT voted_tier AS tier, COUNT(*)::int AS cnt
      FROM quality_votes
      WHERE node_id = p_node_id
      GROUP BY voted_tier
    ) sub;
  END IF;

  RETURN jsonb_build_object(
    'total_votes', v_total_votes,
    'user_vote', v_user_vote,
    'user_vote_revision_id', v_user_revision_id,
    'breakdown', COALESCE(v_breakdown, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_quality_vote_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quality_vote_summary TO anon;

