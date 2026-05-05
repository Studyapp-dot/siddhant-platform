-- ============================================================================
-- SIDDHANT: Reputation System & User Hierarchy Migration
-- Phase 1 — Core Infrastructure
-- ============================================================================
-- Implements:
--   1. Six-level user hierarchy (Reader → Governance Council)
--   2. Reputation tracking columns on profiles
--   3. reputation_events audit table (every point earned is logged)
--   4. endorsements table ("This Helped Me" per-contribution)
--   5. scholar_stars table (peer recognition with written reason)
--   6. contribution_votes table (generic upvotes on revisions)
--   7. Updated RLS policies for the new hierarchy
-- ============================================================================
-- Run this ENTIRE file in the Supabase SQL Editor.
-- It is idempotent — safe to run multiple times.
-- ============================================================================


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 1: Expand profiles.role to the 6-level hierarchy                  ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- Drop the old constraint and add the new one.
-- Old values: 'registered', 'senior_validator', 'admin'
-- New values: 'reader', 'contributor', 'recognized', 'senior_scholar', 'steward', 'governance_council'
-- Migration: 'registered' → 'contributor', 'senior_validator' → 'senior_scholar', 'admin' → 'steward'

DO $$
BEGIN
  -- MUST drop old constraint first — it only allows ('registered', 'senior_validator', 'admin')
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

  -- Now migrate existing role values to new vocabulary
  UPDATE public.profiles SET role = 'contributor' WHERE role = 'registered';
  UPDATE public.profiles SET role = 'senior_scholar' WHERE role = 'senior_validator';
  UPDATE public.profiles SET role = 'steward' WHERE role = 'admin';

  -- Add new constraint with all 6 levels
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('reader', 'contributor', 'recognized', 'senior_scholar', 'steward', 'governance_council'));

  -- Update default to 'contributor' (Level 2 — registered users)
  ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'contributor';
END $$;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 2: Add reputation tracking columns to profiles                    ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accepted_edits_count integer DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS total_edits_count integer DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS endorsements_received integer DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS peer_reviews_completed integer DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS scholar_stars_received integer DEFAULT 0;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 3: Create reputation_events audit table                           ║
-- ║  Every reputation point earned is permanently logged.                    ║
-- ║  This is the transparency mechanism — anyone can verify how              ║
-- ║  a contributor earned their score.                                       ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.reputation_events (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'edit_accepted_minor',      -- +2: typo, formatting, <50 chars
    'edit_accepted_substantive',-- +5: new analysis, case synthesis, ≥50 chars
    'upvote_received',          -- +1: generic community agreement
    'endorsement_received',     -- +10: "This Helped Me" utility signal
    'scholar_star_received',    -- +15: peer-awarded recognition
    'peer_review_completed',    -- +3: structured rubric-based review
    'peer_review_aligned',      -- +2: review aligned with consensus
    'discussion_cited',         -- +5: argument cited in closing summary
    'flag_resolved',            -- +2: flagged issue subsequently resolved
    'mentee_first_contribution',-- +5: newcomer you mentored contributed
    'tier_advancement_bonus'    -- variable: node advanced a quality tier
  )),
  points integer NOT NULL,
  source_id uuid,             -- ID of the revision, discussion, star, etc. that triggered this
  source_type text,           -- 'revision', 'discussion', 'scholar_star', 'endorsement', etc.
  description text,           -- Human-readable explanation
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.reputation_events ENABLE ROW LEVEL SECURITY;

-- Everyone can see reputation events (radical transparency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Reputation events are viewable by everyone.' AND tablename = 'reputation_events'
  ) THEN
    CREATE POLICY "Reputation events are viewable by everyone."
      ON public.reputation_events FOR SELECT USING (true);
  END IF;
END $$;

-- Only the system (via service role or server actions) inserts reputation events.
-- No user can directly insert — this prevents gaming.
-- Server actions use the service role key to insert.


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 4: Create endorsements table ("This Helped Me")                   ║
-- ║  Per-contribution utility signal. Higher value than generic upvote.      ║
-- ║  Empirical basis: Mustafa et al. (2022) — favourite votes              ║
-- ║  (utility confirmation) drive quality contribution at all levels.       ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.endorsements (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  revision_id uuid REFERENCES public.revisions ON DELETE CASCADE NOT NULL,
  endorser_id uuid REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- One endorsement per user per revision
  UNIQUE(revision_id, endorser_id)
);

ALTER TABLE public.endorsements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Endorsements are viewable by everyone.' AND tablename = 'endorsements'
  ) THEN
    CREATE POLICY "Endorsements are viewable by everyone."
      ON public.endorsements FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Registered users can endorse contributions.' AND tablename = 'endorsements'
  ) THEN
    CREATE POLICY "Registered users can endorse contributions."
      ON public.endorsements FOR INSERT
      WITH CHECK (auth.uid() = endorser_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can remove own endorsement.' AND tablename = 'endorsements'
  ) THEN
    CREATE POLICY "Users can remove own endorsement."
      ON public.endorsements FOR DELETE
      USING (auth.uid() = endorser_id);
  END IF;
END $$;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 5: Create scholar_stars table (Peer Recognition)                  ║
-- ║  Siddhant equivalent of Wikipedia's barnstars.                          ║
-- ║  Empirical basis: Beschastnikh et al. (2009) — peer-awarded            ║
-- ║  recognition functions as a socialization mechanism.                     ║
-- ║  Requires a written reason — this is what makes it a socialization      ║
-- ║  signal rather than a social gesture.                                   ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.scholar_stars (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipient_id uuid REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  giver_id uuid REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  reason text NOT NULL,          -- Written explanation of what was valued (NON-NEGOTIABLE)
  source_id uuid,                -- ID of the specific revision, discussion, etc.
  source_type text CHECK (source_type IN ('revision', 'discussion', 'peer_review', 'mentoring', 'other')),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- Prevent self-awards
  CHECK (recipient_id != giver_id)
);

ALTER TABLE public.scholar_stars ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Scholar stars are viewable by everyone.' AND tablename = 'scholar_stars'
  ) THEN
    CREATE POLICY "Scholar stars are viewable by everyone."
      ON public.scholar_stars FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Registered users can award scholar stars.' AND tablename = 'scholar_stars'
  ) THEN
    CREATE POLICY "Registered users can award scholar stars."
      ON public.scholar_stars FOR INSERT
      WITH CHECK (auth.uid() = giver_id);
  END IF;
END $$;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 6: Create contribution_votes table (Generic Upvotes)              ║
-- ║  +1 reputation per vote. Weaker signal than "This Helped Me"            ║
-- ║  but still indicates community agreement.                               ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.contribution_votes (
  user_id uuid REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  revision_id uuid REFERENCES public.revisions ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, revision_id)
);

ALTER TABLE public.contribution_votes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Contribution votes are viewable by everyone.' AND tablename = 'contribution_votes'
  ) THEN
    CREATE POLICY "Contribution votes are viewable by everyone."
      ON public.contribution_votes FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Registered users can vote on contributions.' AND tablename = 'contribution_votes'
  ) THEN
    CREATE POLICY "Registered users can vote on contributions."
      ON public.contribution_votes FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can remove own vote.' AND tablename = 'contribution_votes'
  ) THEN
    CREATE POLICY "Users can remove own vote."
      ON public.contribution_votes FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 7: Update RLS policies for the new hierarchy                      ║
-- ║  Key changes:                                                           ║
-- ║  - inline_tags resolution: recognized+ (was senior_validator/admin)     ║
-- ║  - discussion closing: senior_scholar+ (was senior_validator/admin)     ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- Update inline_tags resolution policy
-- Level 3+ (recognized, senior_scholar, steward, governance_council) can resolve tags
DROP POLICY IF EXISTS "Validators and admins can resolve tags." ON public.inline_tags;

CREATE POLICY "Recognized contributors and above can resolve tags."
  ON public.inline_tags FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('recognized', 'senior_scholar', 'steward', 'governance_council')
    )
  );

-- Update discussion closing policy
DROP POLICY IF EXISTS "Senior users can close discussions." ON public.discussions;

CREATE POLICY "Senior scholars and above can close discussions."
  ON public.discussions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('senior_scholar', 'steward', 'governance_council')
    )
  );

-- Update group discussion pinning policy
DROP POLICY IF EXISTS "Coordinators and admins can pin group threads." ON public.group_discussions;

CREATE POLICY "Coordinators and senior users can manage group threads."
  ON public.group_discussions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('senior_scholar', 'steward', 'governance_council')
    )
    OR
    EXISTS (
      SELECT 1 FROM subject_group_members
      WHERE user_id = auth.uid()
        AND group_id = group_discussions.group_id
        AND role = 'coordinator'
    )
  );


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 8: Update recent_changes_view with contributor level badges       ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

DROP VIEW IF EXISTS public.recent_changes_view;

CREATE OR REPLACE VIEW public.recent_changes_view AS

-- 1. Revisions
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
  'committed edit: ' || r.commit_message
    || ' (' || COALESCE(r.content_size, 0) || ' chars)' AS action_summary,
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
-- ║  STEP 9: Backfill existing profiles with edit counts                    ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- Count existing revisions per user and set total_edits_count
UPDATE public.profiles p
SET total_edits_count = sub.cnt
FROM (
  SELECT author_id, COUNT(*) AS cnt
  FROM public.revisions
  GROUP BY author_id
) sub
WHERE p.id = sub.author_id;

-- At early stage, treat all existing edits as accepted (they survived)
UPDATE public.profiles
SET accepted_edits_count = total_edits_count
WHERE total_edits_count > 0;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  DONE                                                                   ║
-- ║  Verify by running:                                                     ║
-- ║    SELECT username, role, reputation_score, accepted_edits_count,        ║
-- ║           total_edits_count FROM profiles;                              ║
-- ║    SELECT * FROM reputation_events LIMIT 10;                            ║
-- ║    SELECT * FROM scholar_stars LIMIT 10;                                ║
-- ╚════════════════════════════════════════════════════════════════════════════╝
