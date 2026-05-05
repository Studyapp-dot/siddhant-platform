-- ============================================================================
-- SIDDHANT: Group Endorsement Migration — Phase 2
-- ============================================================================
-- Adds endorsement support (Acknowledge / Insightful) for group forum posts.
-- Mirrors the revision-level endorsement tables but for group_discussions.
--
-- Run this in the Supabase SQL Editor. Idempotent.
-- ============================================================================


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  Group Discussion Votes (Acknowledge / "I read this")                   ║
-- ║  Lightweight: one-click, no reason needed.                              ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.group_discussion_votes (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  discussion_id uuid NOT NULL REFERENCES public.group_discussions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, discussion_id)
);

ALTER TABLE public.group_discussion_votes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Group votes are viewable by everyone' AND tablename = 'group_discussion_votes'
  ) THEN
    CREATE POLICY "Group votes are viewable by everyone"
      ON public.group_discussion_votes FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can vote on group discussions' AND tablename = 'group_discussion_votes'
  ) THEN
    CREATE POLICY "Users can vote on group discussions"
      ON public.group_discussion_votes FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can remove own group votes' AND tablename = 'group_discussion_votes'
  ) THEN
    CREATE POLICY "Users can remove own group votes"
      ON public.group_discussion_votes FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  Group Discussion Endorsements (Insightful / Scholarly endorsement)     ║
-- ║  Heavier: carries reputation weight.                                    ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.group_discussion_endorsements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endorser_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  discussion_id uuid NOT NULL REFERENCES public.group_discussions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (endorser_id, discussion_id)
);

ALTER TABLE public.group_discussion_endorsements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Group endorsements are viewable by everyone' AND tablename = 'group_discussion_endorsements'
  ) THEN
    CREATE POLICY "Group endorsements are viewable by everyone"
      ON public.group_discussion_endorsements FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can endorse group discussions' AND tablename = 'group_discussion_endorsements'
  ) THEN
    CREATE POLICY "Users can endorse group discussions"
      ON public.group_discussion_endorsements FOR INSERT
      WITH CHECK (auth.uid() = endorser_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can remove own group endorsements' AND tablename = 'group_discussion_endorsements'
  ) THEN
    CREATE POLICY "Users can remove own group endorsements"
      ON public.group_discussion_endorsements FOR DELETE
      USING (auth.uid() = endorser_id);
  END IF;
END $$;


-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_group_discussion_votes_discussion
  ON public.group_discussion_votes (discussion_id);

CREATE INDEX IF NOT EXISTS idx_group_discussion_endorsements_discussion
  ON public.group_discussion_endorsements (discussion_id);

GRANT SELECT, INSERT, DELETE ON public.group_discussion_votes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.group_discussion_endorsements TO authenticated;
GRANT SELECT ON public.group_discussion_votes TO anon;
GRANT SELECT ON public.group_discussion_endorsements TO anon;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  Verification:                                                          ║
-- ║    SELECT count(*) FROM group_discussion_votes;    -- should be 0       ║
-- ║    SELECT count(*) FROM group_discussion_endorsements;  -- should be 0  ║
-- ╚════════════════════════════════════════════════════════════════════════════╝
