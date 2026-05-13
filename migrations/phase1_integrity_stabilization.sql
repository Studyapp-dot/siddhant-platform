-- ============================================================================
-- SIDDHANT: Phase 1 + 1.5 — Integrity Stabilization Migration
-- ============================================================================
-- This migration adds:
--   1. Soft-delete columns to authority_anchors (scholarly audit trail)
--   2. Structured revision_type column to revisions (revision taxonomy)
--   3. node_type_at_save snapshot on revisions (ontology history)
--   4. is_orphaned flag on authority_anchors (orphan detection)
--   5. Backfills existing reverts/restores with proper type labels
--
-- Run this ENTIRE file in the Supabase SQL Editor.
-- It is idempotent and safe to run multiple times.
-- ============================================================================

-- ============================================================================
-- 1. AUTHORITY ANCHORS: Soft Delete Support
-- ============================================================================
-- Authority removal must be auditable for scholarly integrity.
-- Hard deletes are replaced with soft deletes (deleted_at + deleted_by).

ALTER TABLE public.authority_anchors
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.authority_anchors
  ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL
    REFERENCES public.profiles(id);

-- Index for efficient filtering of active anchors
CREATE INDEX IF NOT EXISTS idx_authority_anchors_active
  ON public.authority_anchors (node_id)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. AUTHORITY ANCHORS: Orphan Detection
-- ============================================================================
-- Anchors can silently orphan after prose rewrites. This flag enables
-- governance visibility without auto-repair (detect, mark, do NOT delete).

ALTER TABLE public.authority_anchors
  ADD COLUMN IF NOT EXISTS is_orphaned BOOLEAN DEFAULT false;

-- ============================================================================
-- 3. REVISIONS: Structured Revision Type Taxonomy
-- ============================================================================
-- Moves from implicit type detection (parsing commit messages) to explicit
-- structured classification. This is the foundation of institutional
-- revision ontology.
--
-- Types:
--   content_edit  — Semantic prose change (the default)
--   type_change   — Node type reclassification (ontology mutation)
--   revert        — Administrative rollback of a previous revision
--   restore       — Restoration to a specific historical state
--
-- NOTE: formatting_only is intentionally EXCLUDED from this taxonomy.
-- Formatting-only edits do not create revisions at all.
-- If no revision is created, there should be no revision type.

ALTER TABLE public.revisions
  ADD COLUMN IF NOT EXISTS revision_type TEXT DEFAULT 'content_edit';

-- Add check constraint only if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'revisions_revision_type_check'
  ) THEN
    ALTER TABLE public.revisions
      ADD CONSTRAINT revisions_revision_type_check
      CHECK (revision_type IN (
        'content_edit', 'type_change', 'revert', 'restore'
      ));
  END IF;
END $$;

-- Index for filtering by revision type
CREATE INDEX IF NOT EXISTS idx_revisions_type
  ON public.revisions (revision_type);

-- ============================================================================
-- 4. REVISIONS: Node Type Snapshot at Save Time
-- ============================================================================
-- Historical ontology reconstruction: records what type the node was
-- at the time each revision was saved. Without this, historical topology
-- is partially lossy.

ALTER TABLE public.revisions
  ADD COLUMN IF NOT EXISTS node_type_at_save TEXT DEFAULT NULL;

-- Backfill existing revisions with current node type (best-effort)
UPDATE public.revisions r
SET node_type_at_save = n.node_type
FROM public.nodes n
WHERE r.node_id = n.id
  AND r.node_type_at_save IS NULL;

-- ============================================================================
-- 5. BACKFILL: Classify existing revisions
-- ============================================================================
-- Reverts and restores already have is_revert=true. We can further
-- distinguish them by parsing the commit_message prefix.

UPDATE public.revisions
SET revision_type = 'revert'
WHERE is_revert = true
  AND commit_message LIKE 'Revert:%'
  AND revision_type = 'content_edit';

UPDATE public.revisions
SET revision_type = 'restore'
WHERE is_revert = true
  AND commit_message LIKE 'Restore:%'
  AND revision_type = 'content_edit';

-- Catch any other is_revert=true that don't match the patterns above
UPDATE public.revisions
SET revision_type = 'revert'
WHERE is_revert = true
  AND revision_type = 'content_edit';

-- Type changes can be detected from commit message annotation
UPDATE public.revisions
SET revision_type = 'type_change'
WHERE commit_message LIKE '%[Type changed:%'
  AND revision_type = 'content_edit';

-- ============================================================================
-- GOVERNANCE QUERIES (run periodically, not automatically)
-- ============================================================================

-- Detect orphaned authority anchors:
-- Anchors whose anchor_text no longer appears in the current revision.
-- Run this periodically and review results before marking is_orphaned = true.
--
-- UPDATE public.authority_anchors aa
-- SET is_orphaned = true
-- FROM (
--   SELECT aa2.id
--   FROM public.authority_anchors aa2
--   JOIN public.nodes n ON aa2.node_id = n.id
--   JOIN LATERAL (
--     SELECT report_content FROM public.revisions
--     WHERE node_id = n.id ORDER BY created_at DESC LIMIT 1
--   ) latest_rev ON true
--   WHERE aa2.deleted_at IS NULL
--     AND aa2.is_orphaned = false
--     AND latest_rev.report_content NOT LIKE '%' || aa2.anchor_text || '%'
-- ) orphans
-- WHERE aa.id = orphans.id;

-- ============================================================================
-- VERIFY
-- ============================================================================
-- SELECT revision_type, COUNT(*) FROM public.revisions GROUP BY revision_type;
-- SELECT node_type_at_save, COUNT(*) FROM public.revisions GROUP BY node_type_at_save;
-- SELECT id, deleted_at, deleted_by FROM public.authority_anchors WHERE deleted_at IS NOT NULL LIMIT 5;
-- SELECT id, is_orphaned FROM public.authority_anchors WHERE is_orphaned = true LIMIT 5;
