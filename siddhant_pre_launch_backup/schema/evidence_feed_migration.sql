-- ============================================================================
-- SIDDHANT: Evidence-Based Feed Migration
-- ============================================================================
-- Upgrades the recognition_feed_view from "summary-based" to "evidence-based":
--   1. Adds source_revision_id to every feed item (deep-link to exact diff)
--   2. Adds source_commit_message (what the revision actually did)
--   3. Adds category column to scholar_stars table (structured storage)
--   4. Exposes category in feed view for Scholar Stars
--
-- Run this ENTIRE file in the Supabase SQL Editor.
-- It is idempotent — safe to run multiple times.
-- ============================================================================


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 1: Add category column to scholar_stars                           ║
-- ║  Previously only stored in reputation_events.description as text.       ║
-- ║  Now stored as structured data for querying/filtering/display.          ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.scholar_stars
  ADD COLUMN IF NOT EXISTS category text;

-- Backfill existing stars from reputation_events descriptions if possible
-- (best-effort — matches the category label pattern in the description)
-- This is optional and won't fail if no matches are found.


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 2: Recreate recognition_feed_view with evidence columns           ║
-- ║  New columns:                                                           ║
-- ║    source_revision_id   — the exact revision being recognized           ║
-- ║    source_commit_message — what the revision actually changed           ║
-- ║  These enable deep-linking and inline diff in feed cards.               ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

DROP VIEW IF EXISTS public.recognition_feed_view;

CREATE OR REPLACE VIEW public.recognition_feed_view AS

-- 1. Revisions (edits) — source_revision_id is self (the revision IS the item)
SELECT
  r.id AS activity_id,
  'revision' AS activity_type,
  r.author_id AS actor_id,
  p.username AS actor_username,
  p.role AS actor_role,
  p.reputation_score AS actor_reputation,
  NULL::uuid AS recipient_id,
  NULL::text AS recipient_username,
  r.node_id,
  n.title AS node_title,
  n.slug AS node_slug,
  r.commit_message AS detail_text,
  NULL::text AS detail_category,
  COALESCE(r.content_size, 0) AS detail_size,
  COALESCE(r.is_revert, false) AS is_revert,
  COALESCE(r.is_reverted, false) AS is_reverted,
  COALESCE(r.is_flagged, false) AS is_flagged,
  -- ── NEW: Evidence columns ──
  r.id AS source_revision_id,
  r.commit_message AS source_commit_message,
  r.created_at
FROM public.revisions r
JOIN public.nodes n ON r.node_id = n.id
JOIN public.profiles p ON r.author_id = p.id

UNION ALL

-- 2. Scholar Stars — source_revision_id from source_id when source_type = 'revision'
SELECT
  ss.id AS activity_id,
  'scholar_star' AS activity_type,
  ss.giver_id AS actor_id,
  gp.username AS actor_username,
  gp.role AS actor_role,
  gp.reputation_score AS actor_reputation,
  ss.recipient_id,
  rp.username AS recipient_username,
  COALESCE(rev_node.node_id, NULL) AS node_id,
  COALESCE(rev_node.node_title, NULL) AS node_title,
  COALESCE(rev_node.node_slug, NULL) AS node_slug,
  ss.reason AS detail_text,
  COALESCE(ss.category, ss.source_type) AS detail_category,
  0 AS detail_size,
  false AS is_revert,
  false AS is_reverted,
  false AS is_flagged,
  -- ── NEW: Evidence columns ──
  CASE WHEN ss.source_type = 'revision' THEN ss.source_id ELSE NULL END AS source_revision_id,
  rev_node.commit_message AS source_commit_message,
  ss.created_at
FROM public.scholar_stars ss
JOIN public.profiles gp ON ss.giver_id = gp.id
JOIN public.profiles rp ON ss.recipient_id = rp.id
LEFT JOIN LATERAL (
  SELECT r.node_id, nd.title AS node_title, nd.slug AS node_slug, r.commit_message
  FROM public.revisions r
  JOIN public.nodes nd ON r.node_id = nd.id
  WHERE r.id = ss.source_id AND ss.source_type = 'revision'
  LIMIT 1
) rev_node ON true

UNION ALL

-- 3. Insightful Endorsements — source_revision_id from the endorsed revision
SELECT
  e.id AS activity_id,
  'endorsement' AS activity_type,
  e.endorser_id AS actor_id,
  ep.username AS actor_username,
  ep.role AS actor_role,
  ep.reputation_score AS actor_reputation,
  r.author_id AS recipient_id,
  rp.username AS recipient_username,
  r.node_id,
  n.title AS node_title,
  n.slug AS node_slug,
  'Insightful endorsement' AS detail_text,
  NULL AS detail_category,
  0 AS detail_size,
  false AS is_revert,
  false AS is_reverted,
  false AS is_flagged,
  -- ── NEW: Evidence columns ──
  e.revision_id AS source_revision_id,
  r.commit_message AS source_commit_message,
  e.created_at
FROM public.endorsements e
JOIN public.profiles ep ON e.endorser_id = ep.id
JOIN public.revisions r ON e.revision_id = r.id
JOIN public.profiles rp ON r.author_id = rp.id
JOIN public.nodes n ON r.node_id = n.id

UNION ALL

-- 4. Acknowledges — source_revision_id from the acknowledged revision
SELECT
  uuid_generate_v5(uuid_nil(), cv.user_id::text || ':' || cv.revision_id::text) AS activity_id,
  'acknowledge' AS activity_type,
  cv.user_id AS actor_id,
  ap.username AS actor_username,
  ap.role AS actor_role,
  ap.reputation_score AS actor_reputation,
  r.author_id AS recipient_id,
  rp.username AS recipient_username,
  r.node_id,
  n.title AS node_title,
  n.slug AS node_slug,
  'Acknowledged contribution' AS detail_text,
  NULL AS detail_category,
  0 AS detail_size,
  false AS is_revert,
  false AS is_reverted,
  false AS is_flagged,
  -- ── NEW: Evidence columns ──
  cv.revision_id AS source_revision_id,
  r.commit_message AS source_commit_message,
  cv.created_at
FROM public.contribution_votes cv
JOIN public.profiles ap ON cv.user_id = ap.id
JOIN public.revisions r ON cv.revision_id = r.id
JOIN public.profiles rp ON r.author_id = rp.id
JOIN public.nodes n ON r.node_id = n.id

UNION ALL

-- 5. Quality Votes — no direct revision link (node-level)
SELECT
  qv.id AS activity_id,
  'quality_vote' AS activity_type,
  qv.voter_id AS actor_id,
  vp.username AS actor_username,
  vp.role AS actor_role,
  vp.reputation_score AS actor_reputation,
  NULL::uuid AS recipient_id,
  NULL::text AS recipient_username,
  qv.node_id,
  n.title AS node_title,
  n.slug AS node_slug,
  COALESCE(qv.justification, 'Voted: ' || qv.voted_tier) AS detail_text,
  qv.voted_tier AS detail_category,
  0 AS detail_size,
  false AS is_revert,
  false AS is_reverted,
  false AS is_flagged,
  -- ── NEW: Evidence columns (quality votes reference revision_id optionally) ──
  qv.revision_id AS source_revision_id,
  NULL::text AS source_commit_message,
  qv.created_at
FROM public.quality_votes qv
JOIN public.profiles vp ON qv.voter_id = vp.id
JOIN public.nodes n ON qv.node_id = n.id

UNION ALL

-- 6. Quality Assessments — no direct revision link
SELECT
  qa.id AS activity_id,
  'quality_assessment' AS activity_type,
  qa.assessor_id AS actor_id,
  ap.username AS actor_username,
  ap.role AS actor_role,
  ap.reputation_score AS actor_reputation,
  NULL::uuid AS recipient_id,
  NULL::text AS recipient_username,
  qa.node_id,
  n.title AS node_title,
  n.slug AS node_slug,
  qa.previous_tier || ' → ' || qa.new_tier || ': ' || COALESCE(qa.justification, '') AS detail_text,
  qa.new_tier AS detail_category,
  0 AS detail_size,
  false AS is_revert,
  false AS is_reverted,
  false AS is_flagged,
  -- ── NEW: Evidence columns ──
  NULL::uuid AS source_revision_id,
  NULL::text AS source_commit_message,
  qa.created_at
FROM public.quality_assessments qa
JOIN public.profiles ap ON qa.assessor_id = ap.id
JOIN public.nodes n ON qa.node_id = n.id;

GRANT SELECT ON public.recognition_feed_view TO anon, authenticated;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  DONE                                                                   ║
-- ║  Verify:                                                                ║
-- ║    SELECT activity_type, source_revision_id, source_commit_message      ║
-- ║    FROM recognition_feed_view LIMIT 10;                                 ║
-- ╚════════════════════════════════════════════════════════════════════════════╝
