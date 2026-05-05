-- ============================================================================
-- SIDDHANT: Revision History Infrastructure Enhancement
-- Section 14 Compliance — Permanent, Transparent, Verifiable Version Control
-- ============================================================================
-- Run this ENTIRE file in the Supabase SQL Editor.
-- It will:
--   1. Add content_size column to revisions for character-delta tracking
--   2. Backfill existing revisions with computed content sizes
--   3. Update the recent_changes_view to include size info
-- ============================================================================

-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 1: Add content_size to revisions                                  ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- Stores character count of report_content at time of save.
-- Enables fast delta computation ("+342 chars" / "−128 chars") in the UI
-- without fetching full content of every revision.
ALTER TABLE public.revisions 
  ADD COLUMN IF NOT EXISTS content_size integer DEFAULT 0;

-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 2: Backfill existing revisions                                    ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- Compute content_size from existing content for all revisions that have it
UPDATE public.revisions 
SET content_size = COALESCE(
  LENGTH(report_content), 
  LENGTH(tier1_content), 
  0
)
WHERE content_size = 0 OR content_size IS NULL;

-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 3: Update recent_changes_view to include size info                ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE VIEW public.recent_changes_view AS

-- 1. Revisions (now with size delta info)
SELECT 
  r.id AS activity_id,
  r.node_id,
  n.title AS node_title,
  n.slug AS node_slug,
  r.author_id,
  p.username AS author_username,
  p.role AS author_role,
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
-- ║  DONE                                                                   ║
-- ║  Verify: SELECT id, content_size FROM revisions LIMIT 10;               ║
-- ╚════════════════════════════════════════════════════════════════════════════╝
