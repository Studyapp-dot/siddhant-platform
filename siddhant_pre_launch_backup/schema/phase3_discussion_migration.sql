-- ============================================================
-- SIDDHANT: PHASE 3 — INTELLIGENCE + TRUST LAYER
-- Adds answer/reply semantics, reference support, consensus
-- strength, thread follows, and impact tracking.
-- ============================================================
-- Run this entire script in the Supabase SQL Editor.
-- It is idempotent — safe to run multiple times.
-- ============================================================


-- ╔════════════════════════════════════════════════════════════╗
-- ║  1. RESPONSE TYPE (answer vs reply)                      ║
-- ║  Backward compatible: all existing rows → 'reply'        ║
-- ╚════════════════════════════════════════════════════════════╝

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discussions' AND column_name = 'response_type'
  ) THEN
    ALTER TABLE public.discussions
      ADD COLUMN response_type text DEFAULT 'reply'
      CHECK (response_type IN ('answer', 'reply'));
  END IF;
END $$;


-- ╔════════════════════════════════════════════════════════════╗
-- ║  2. REFERENCE SUPPORT                                     ║
-- ║  Optional citation text + type for root threads & answers ║
-- ╚════════════════════════════════════════════════════════════╝

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discussions' AND column_name = 'reference_text'
  ) THEN
    ALTER TABLE public.discussions ADD COLUMN reference_text text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discussions' AND column_name = 'reference_type'
  ) THEN
    ALTER TABLE public.discussions ADD COLUMN reference_type text;
    -- Note: CHECK constraint added separately to handle NULL gracefully
    ALTER TABLE public.discussions
      ADD CONSTRAINT discussions_reference_type_check
      CHECK (reference_type IS NULL OR reference_type IN ('case', 'section', 'article', 'statute', 'commentary'));
  END IF;
END $$;


-- ╔════════════════════════════════════════════════════════════╗
-- ║  3. CITED PARTICIPANTS (stored on thread close)           ║
-- ║  Enables consensus strength derivation                    ║
-- ╚════════════════════════════════════════════════════════════╝

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discussions' AND column_name = 'cited_participants'
  ) THEN
    ALTER TABLE public.discussions ADD COLUMN cited_participants uuid[];
  END IF;
END $$;


-- ╔════════════════════════════════════════════════════════════╗
-- ║  4. IMPACT SUMMARY (stored on thread close)               ║
-- ║  "What changed due to this discussion?"                   ║
-- ╚════════════════════════════════════════════════════════════╝

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discussions' AND column_name = 'impact_summary'
  ) THEN
    ALTER TABLE public.discussions ADD COLUMN impact_summary text;
  END IF;
END $$;


-- ╔════════════════════════════════════════════════════════════╗
-- ║  5. THREAD FOLLOWS TABLE                                  ║
-- ║  Simple user → discussion_id follow relationship          ║
-- ╚════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.thread_follows (
  user_id uuid REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  discussion_id uuid REFERENCES public.discussions ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, discussion_id)
);

ALTER TABLE public.thread_follows ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users see own follows.' AND tablename = 'thread_follows'
  ) THEN
    CREATE POLICY "Users see own follows."
      ON public.thread_follows FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can follow threads.' AND tablename = 'thread_follows'
  ) THEN
    CREATE POLICY "Users can follow threads."
      ON public.thread_follows FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can unfollow threads.' AND tablename = 'thread_follows'
  ) THEN
    CREATE POLICY "Users can unfollow threads."
      ON public.thread_follows FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;


-- ╔════════════════════════════════════════════════════════════╗
-- ║  6. UPDATE close_discussion RPC                           ║
-- ║  Now accepts + stores cited_participants and              ║
-- ║  impact_summary                                           ║
-- ╚════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.close_discussion(
  p_discussion_id uuid,
  p_closer_id uuid,
  p_closing_summary text,
  p_cited_participants uuid[] DEFAULT NULL,
  p_impact_summary text DEFAULT NULL
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
      closing_summary = p_closing_summary,
      cited_participants = COALESCE(p_cited_participants, cited_participants),
      impact_summary = p_impact_summary
  WHERE id = p_discussion_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_discussion(uuid, uuid, text, uuid[], text) TO authenticated;


-- ╔════════════════════════════════════════════════════════════╗
-- ║  7. RECURSIVE THREAD PARTICIPANTS                         ║
-- ║  Returns ALL author_ids in a thread (root + all depth)    ║
-- ╚════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.get_thread_participants(p_root_id uuid)
RETURNS TABLE(author_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE thread_tree AS (
    SELECT d.id, d.author_id
    FROM public.discussions d
    WHERE d.id = p_root_id
    UNION ALL
    SELECT d.id, d.author_id
    FROM public.discussions d
    INNER JOIN thread_tree t ON d.parent_id = t.id
  )
  SELECT DISTINCT tt.author_id FROM thread_tree tt;
$$;

GRANT EXECUTE ON FUNCTION public.get_thread_participants(uuid) TO authenticated;


-- ╔════════════════════════════════════════════════════════════╗
-- ║  8. ENDORSEMENT INTEGRITY                                  ║
-- ║  Ensure 1 vote per user per discussion at DB level         ║
-- ╚════════════════════════════════════════════════════════════╝

-- Add unique constraint if not already present (PK may already cover this)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'consensus_votes_user_discussion_unique'
  ) THEN
    -- Check if PK already covers (user_id, discussion_id)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'consensus_votes'::regclass AND contype = 'p'
    ) THEN
      ALTER TABLE public.consensus_votes
        ADD CONSTRAINT consensus_votes_user_discussion_unique
        UNIQUE (user_id, discussion_id);
    END IF;
  END IF;
END $$;


-- ============================================================
-- DONE. Verify by running:
--   SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'discussions'
--   ORDER BY ordinal_position;
-- ============================================================
