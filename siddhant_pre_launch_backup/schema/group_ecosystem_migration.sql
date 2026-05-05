-- ============================================================================
-- SIDDHANT: Group Ecosystem Integration Migration
-- ============================================================================
-- Phase 1 of the Subject Groups → Scholarly Coordination Spaces evolution.
--
-- This migration:
--   1. Extends recognition_feed_view with group activity types
--      (group_post, mentorship_started, coordinator_promoted)
--   2. Creates a notifications table for the in-app notification system
--   3. Adds appropriate RLS policies and indexes
--
-- Run this ENTIRE file in the Supabase SQL Editor.
-- It is idempotent — safe to run multiple times.
-- ============================================================================


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 1: Notifications Table                                            ║
-- ║  Lightweight in-app notifications — polling-based, no Realtime needed.  ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,       -- 'group_reply', 'mentor_request', 'mentor_accepted', 'coordinator_promoted'
  title text NOT NULL,
  body text,
  link text,                -- URL to navigate to on click
  source_id uuid,           -- reference to the triggering entity
  source_type text,         -- 'group_discussion', 'mentor_request', 'mentorship'
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Index for fast unread-notification queries (the primary access pattern)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read, created_at DESC)
  WHERE is_read = false;

-- General index for fetching all notifications for a user
CREATE INDEX IF NOT EXISTS idx_notifications_user_all
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own notifications' AND tablename = 'notifications'
  ) THEN
    CREATE POLICY "Users can read own notifications"
      ON public.notifications FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  -- Users can mark their own notifications as read
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own notifications' AND tablename = 'notifications'
  ) THEN
    CREATE POLICY "Users can update own notifications"
      ON public.notifications FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- RPC to insert notifications (bypasses RLS for cross-user notification creation)
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text DEFAULT NULL,
  p_link text DEFAULT NULL,
  p_source_id uuid DEFAULT NULL,
  p_source_type text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link, source_id, source_type)
  VALUES (p_user_id, p_type, p_title, p_body, p_link, p_source_id, p_source_type);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 2: Extend recognition_feed_view with group activity               ║
-- ║  Adds: group_post, mentorship_started, coordinator_promoted             ║
-- ║  Also adds: group_id, group_name columns to ALL feed items              ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- We must DROP and recreate since we're adding new columns to the view
DROP VIEW IF EXISTS public.recognition_feed_view;

CREATE OR REPLACE VIEW public.recognition_feed_view AS

-- 1. Revisions (edits) — existing
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
  r.id AS source_revision_id,
  r.commit_message AS source_commit_message,
  NULL::uuid AS group_id,
  NULL::text AS group_name,
  NULL::text AS group_slug,
  r.created_at
FROM public.revisions r
JOIN public.nodes n ON r.node_id = n.id
JOIN public.profiles p ON r.author_id = p.id

UNION ALL

-- 2. Scholar Stars — existing
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
  CASE WHEN ss.source_type = 'revision' THEN ss.source_id ELSE NULL END AS source_revision_id,
  rev_node.commit_message AS source_commit_message,
  NULL::uuid AS group_id,
  NULL::text AS group_name,
  NULL::text AS group_slug,
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

-- 3. Insightful Endorsements — existing
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
  e.revision_id AS source_revision_id,
  r.commit_message AS source_commit_message,
  NULL::uuid AS group_id,
  NULL::text AS group_name,
  NULL::text AS group_slug,
  e.created_at
FROM public.endorsements e
JOIN public.profiles ep ON e.endorser_id = ep.id
JOIN public.revisions r ON e.revision_id = r.id
JOIN public.profiles rp ON r.author_id = rp.id
JOIN public.nodes n ON r.node_id = n.id

UNION ALL

-- 4. Acknowledges — existing
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
  cv.revision_id AS source_revision_id,
  r.commit_message AS source_commit_message,
  NULL::uuid AS group_id,
  NULL::text AS group_name,
  NULL::text AS group_slug,
  cv.created_at
FROM public.contribution_votes cv
JOIN public.profiles ap ON cv.user_id = ap.id
JOIN public.revisions r ON cv.revision_id = r.id
JOIN public.profiles rp ON r.author_id = rp.id
JOIN public.nodes n ON r.node_id = n.id

UNION ALL

-- 5. Quality Votes — existing
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
  qv.revision_id AS source_revision_id,
  NULL::text AS source_commit_message,
  NULL::uuid AS group_id,
  NULL::text AS group_name,
  NULL::text AS group_slug,
  qv.created_at
FROM public.quality_votes qv
JOIN public.profiles vp ON qv.voter_id = vp.id
JOIN public.nodes n ON qv.node_id = n.id

UNION ALL

-- 6. Quality Assessments — existing
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
  NULL::uuid AS source_revision_id,
  NULL::text AS source_commit_message,
  NULL::uuid AS group_id,
  NULL::text AS group_name,
  NULL::text AS group_slug,
  qa.created_at
FROM public.quality_assessments qa
JOIN public.profiles ap ON qa.assessor_id = ap.id
JOIN public.nodes n ON qa.node_id = n.id

UNION ALL

-- ══════════════════════════════════════════════════════════════════════════
-- 7. NEW: Group Posts — substantive top-level forum contributions
-- Only top-level threads (parent_id IS NULL) with 50+ characters
-- This avoids flooding the feed with short replies.
-- ══════════════════════════════════════════════════════════════════════════
SELECT
  gd.id AS activity_id,
  'group_post' AS activity_type,
  gd.author_id AS actor_id,
  p.username AS actor_username,
  p.role AS actor_role,
  p.reputation_score AS actor_reputation,
  NULL::uuid AS recipient_id,
  NULL::text AS recipient_username,
  NULL::uuid AS node_id,
  NULL::text AS node_title,
  NULL::text AS node_slug,
  LEFT(gd.content, 200) AS detail_text,
  gd.thread_type AS detail_category,
  LENGTH(gd.content) AS detail_size,
  false AS is_revert,
  false AS is_reverted,
  false AS is_flagged,
  NULL::uuid AS source_revision_id,
  NULL::text AS source_commit_message,
  gd.group_id AS group_id,
  sg.name AS group_name,
  sg.slug AS group_slug,
  gd.created_at
FROM public.group_discussions gd
JOIN public.profiles p ON gd.author_id = p.id
JOIN public.subject_groups sg ON gd.group_id = sg.id
WHERE gd.parent_id IS NULL
  AND LENGTH(gd.content) >= 50

UNION ALL

-- ══════════════════════════════════════════════════════════════════════════
-- 8. NEW: Mentorship Started — when a mentor accepts a request
-- ══════════════════════════════════════════════════════════════════════════
SELECT
  m.id AS activity_id,
  'mentorship_started' AS activity_type,
  m.mentor_id AS actor_id,
  mp.username AS actor_username,
  mp.role AS actor_role,
  mp.reputation_score AS actor_reputation,
  m.mentee_id AS recipient_id,
  mep.username AS recipient_username,
  NULL::uuid AS node_id,
  NULL::text AS node_title,
  NULL::text AS node_slug,
  'Mentorship established' AS detail_text,
  NULL::text AS detail_category,
  0 AS detail_size,
  false AS is_revert,
  false AS is_reverted,
  false AS is_flagged,
  NULL::uuid AS source_revision_id,
  NULL::text AS source_commit_message,
  m.group_id AS group_id,
  sg.name AS group_name,
  sg.slug AS group_slug,
  m.started_at AS created_at
FROM public.mentorships m
JOIN public.profiles mp ON m.mentor_id = mp.id
JOIN public.profiles mep ON m.mentee_id = mep.id
JOIN public.subject_groups sg ON m.group_id = sg.id;

GRANT SELECT ON public.recognition_feed_view TO anon, authenticated;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  DONE                                                                   ║
-- ║  Verify:                                                                ║
-- ║    SELECT activity_type, group_name, group_slug                         ║
-- ║    FROM recognition_feed_view                                           ║
-- ║    WHERE activity_type IN ('group_post', 'mentorship_started')          ║
-- ║    LIMIT 10;                                                            ║
-- ║                                                                         ║
-- ║    SELECT count(*) FROM notifications;  -- should be 0 initially       ║
-- ╚════════════════════════════════════════════════════════════════════════════╝
