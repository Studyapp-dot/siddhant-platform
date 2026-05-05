-- ============================================================
-- SIDDHANT: DISCUSSION TYPE SYSTEM
-- Adds thread_type to discussions for structured legal reasoning
-- ============================================================
-- Run this in the Supabase SQL Editor.
-- It is idempotent — safe to run multiple times.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discussions' AND column_name = 'thread_type'
  ) THEN
    ALTER TABLE public.discussions
      ADD COLUMN thread_type text DEFAULT 'general'
      CHECK (thread_type IN ('question', 'interpretation', 'improvement', 'issue', 'general'));
  END IF;
END $$;

-- ============================================================
-- DONE. Verify by running:
--   SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'discussions' AND column_name = 'thread_type';
-- ============================================================
