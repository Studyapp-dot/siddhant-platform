-- ============================================================================
-- SIDDHANT: Activity & Recognition Feed Migration
-- ============================================================================
-- Adds:
--   1. activity_comments table — lightweight comments on any feed item
--   2. recognition_feed_view — unified feed of all endorsable activity
--   3. Updated recent_changes_view — now includes endorsement/recognition events
--   4. post_activity_comment RPC — SECURITY DEFINER for RLS bypass
--   5. get_article_endorsement_stats — aggregate endorsement counts per node
--
-- Run this ENTIRE file in the Supabase SQL Editor.
-- It is idempotent — safe to run multiple times.
-- ============================================================================


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 1: Create activity_comments table                                 ║
-- ║  Lightweight comments on any feed item (revision, star, vote, etc.)      ║
-- ║  This is NOT the same as the node-scoped `discussions` table.            ║
-- ║  These are revision-scoped / event-scoped comments for the feed.        ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.activity_comments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  -- The thing being commented on
  target_type text NOT NULL CHECK (target_type IN (
    'revision',           -- Comment on a specific edit
    'scholar_star',       -- Comment on a scholar star award
    'quality_vote',       -- Comment on a quality vote
    'quality_assessment', -- Comment on a tier promotion
    'endorsement',        -- Comment on an insightful endorsement
    'discussion_citation' -- Comment on a discussion citation event
  )),
  target_id uuid NOT NULL,  -- ID of the target item
  -- Comment content
  author_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL CHECK (char_length(content) >= 3 AND char_length(content) <= 2000),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_activity_comments_target
  ON public.activity_comments (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_activity_comments_author
  ON public.activity_comments (author_id);
CREATE INDEX IF NOT EXISTS idx_activity_comments_created
  ON public.activity_comments (created_at DESC);

ALTER TABLE public.activity_comments ENABLE ROW LEVEL SECURITY;

-- Everyone can read activity comments (radical transparency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Activity comments are viewable by everyone.'
      AND tablename = 'activity_comments'
  ) THEN
    CREATE POLICY "Activity comments are viewable by everyone."
      ON public.activity_comments FOR SELECT USING (true);
  END IF;

  -- Authenticated users can post comments (via RPC for safety)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can insert activity comments.'
      AND tablename = 'activity_comments'
  ) THEN
    CREATE POLICY "Authenticated users can insert activity comments."
      ON public.activity_comments FOR INSERT
      WITH CHECK (auth.uid() = author_id);
  END IF;

  -- Users can delete their own comments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can delete own activity comments.'
      AND tablename = 'activity_comments'
  ) THEN
    CREATE POLICY "Users can delete own activity comments."
      ON public.activity_comments FOR DELETE
      USING (auth.uid() = author_id);
  END IF;
END $$;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 2: post_activity_comment RPC                                      ║
-- ║  SECURITY DEFINER so it can insert regardless of RLS edge cases.        ║
-- ║  Validates input and prevents abuse.                                    ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.post_activity_comment(
  p_author_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_content text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment_id uuid;
  v_comment_count integer;
BEGIN
  -- Validate target_type
  IF p_target_type NOT IN ('revision', 'scholar_star', 'quality_vote', 'quality_assessment', 'endorsement', 'discussion_citation') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid target_type');
  END IF;

  -- Validate content length
  IF char_length(p_content) < 3 THEN
    RETURN json_build_object('success', false, 'error', 'Comment too short (min 3 chars)');
  END IF;

  IF char_length(p_content) > 2000 THEN
    RETURN json_build_object('success', false, 'error', 'Comment too long (max 2000 chars)');
  END IF;

  -- Rate limit: max 20 comments per user per hour
  SELECT COUNT(*) INTO v_comment_count
  FROM public.activity_comments
  WHERE author_id = p_author_id
    AND created_at > (NOW() - INTERVAL '1 hour');

  IF v_comment_count >= 20 THEN
    RETURN json_build_object('success', false, 'error', 'Rate limit exceeded. Max 20 comments per hour.');
  END IF;

  -- Insert the comment
  INSERT INTO public.activity_comments (author_id, target_type, target_id, content)
  VALUES (p_author_id, p_target_type, p_target_id, p_content)
  RETURNING id INTO v_comment_id;

  RETURN json_build_object('success', true, 'comment_id', v_comment_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_activity_comment TO authenticated;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 3: recognition_feed_view — Unified Activity Feed                  ║
-- ║  Combines edits, endorsements, scholar stars, quality events            ║
-- ║  into a single chronological feed.                                      ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

DROP VIEW IF EXISTS public.recognition_feed_view;

CREATE OR REPLACE VIEW public.recognition_feed_view AS

-- 1. Revisions (edits) — the core actions viewers need to judge
SELECT
  r.id AS activity_id,
  'revision' AS activity_type,
  r.author_id AS actor_id,
  p.username AS actor_username,
  p.role AS actor_role,
  p.reputation_score AS actor_reputation,
  -- Recipient is the same as actor for edits
  NULL::uuid AS recipient_id,
  NULL::text AS recipient_username,
  -- Node context
  r.node_id,
  n.title AS node_title,
  n.slug AS node_slug,
  -- Activity detail
  r.commit_message AS detail_text,
  NULL::text AS detail_category,
  COALESCE(r.content_size, 0) AS detail_size,
  -- Flags
  COALESCE(r.is_revert, false) AS is_revert,
  COALESCE(r.is_reverted, false) AS is_reverted,
  COALESCE(r.is_flagged, false) AS is_flagged,
  r.created_at
FROM public.revisions r
JOIN public.nodes n ON r.node_id = n.id
JOIN public.profiles p ON r.author_id = p.id

UNION ALL

-- 2. Scholar Stars — the highest-value recognition events
SELECT
  ss.id AS activity_id,
  'scholar_star' AS activity_type,
  ss.giver_id AS actor_id,
  gp.username AS actor_username,
  gp.role AS actor_role,
  gp.reputation_score AS actor_reputation,
  -- Recipient
  ss.recipient_id,
  rp.username AS recipient_username,
  -- Node context (via source revision → node)
  COALESCE(rev_node.node_id, NULL) AS node_id,
  COALESCE(rev_node.node_title, NULL) AS node_title,
  COALESCE(rev_node.node_slug, NULL) AS node_slug,
  -- Activity detail
  ss.reason AS detail_text,
  ss.source_type AS detail_category,
  0 AS detail_size,
  false AS is_revert,
  false AS is_reverted,
  false AS is_flagged,
  ss.created_at
FROM public.scholar_stars ss
JOIN public.profiles gp ON ss.giver_id = gp.id
JOIN public.profiles rp ON ss.recipient_id = rp.id
LEFT JOIN LATERAL (
  SELECT r.node_id, nd.title AS node_title, nd.slug AS node_slug
  FROM public.revisions r
  JOIN public.nodes nd ON r.node_id = nd.id
  WHERE r.id = ss.source_id AND ss.source_type = 'revision'
  LIMIT 1
) rev_node ON true

UNION ALL

-- 3. Insightful Endorsements (💡) — high-value recognition
SELECT
  e.id AS activity_id,
  'endorsement' AS activity_type,
  e.endorser_id AS actor_id,
  ep.username AS actor_username,
  ep.role AS actor_role,
  ep.reputation_score AS actor_reputation,
  -- Recipient is the revision author
  r.author_id AS recipient_id,
  rp.username AS recipient_username,
  -- Node context
  r.node_id,
  n.title AS node_title,
  n.slug AS node_slug,
  -- Activity detail
  'Insightful endorsement' AS detail_text,
  NULL AS detail_category,
  0 AS detail_size,
  false AS is_revert,
  false AS is_reverted,
  false AS is_flagged,
  e.created_at
FROM public.endorsements e
JOIN public.profiles ep ON e.endorser_id = ep.id
JOIN public.revisions r ON e.revision_id = r.id
JOIN public.profiles rp ON r.author_id = rp.id
JOIN public.nodes n ON r.node_id = n.id

UNION ALL

-- 4. Acknowledges (👏) — lightweight nods
-- contribution_votes has composite PK (user_id, revision_id), not a UUID.
-- Use uuid_generate_v5 with a namespace to create a deterministic activity_id.
SELECT
  uuid_generate_v5(uuid_nil(), cv.user_id::text || ':' || cv.revision_id::text) AS activity_id,
  'acknowledge' AS activity_type,
  cv.user_id AS actor_id,
  ap.username AS actor_username,
  ap.role AS actor_role,
  ap.reputation_score AS actor_reputation,
  -- Recipient is the revision author
  r.author_id AS recipient_id,
  rp.username AS recipient_username,
  -- Node context
  r.node_id,
  n.title AS node_title,
  n.slug AS node_slug,
  -- Activity detail
  'Acknowledged contribution' AS detail_text,
  NULL AS detail_category,
  0 AS detail_size,
  false AS is_revert,
  false AS is_reverted,
  false AS is_flagged,
  cv.created_at
FROM public.contribution_votes cv
JOIN public.profiles ap ON cv.user_id = ap.id
JOIN public.revisions r ON cv.revision_id = r.id
JOIN public.profiles rp ON r.author_id = rp.id
JOIN public.nodes n ON r.node_id = n.id

UNION ALL

-- 5. Quality Votes (with justification) — community assessment
SELECT
  qv.id AS activity_id,
  'quality_vote' AS activity_type,
  qv.voter_id AS actor_id,
  vp.username AS actor_username,
  vp.role AS actor_role,
  vp.reputation_score AS actor_reputation,
  NULL::uuid AS recipient_id,
  NULL::text AS recipient_username,
  -- Node context
  qv.node_id,
  n.title AS node_title,
  n.slug AS node_slug,
  -- Activity detail
  COALESCE(qv.justification, 'Voted: ' || qv.voted_tier) AS detail_text,
  qv.voted_tier AS detail_category,
  0 AS detail_size,
  false AS is_revert,
  false AS is_reverted,
  false AS is_flagged,
  qv.created_at
FROM public.quality_votes qv
JOIN public.profiles vp ON qv.voter_id = vp.id
JOIN public.nodes n ON qv.node_id = n.id

UNION ALL

-- 6. Quality Assessments (tier promotions) — formal advancement
SELECT
  qa.id AS activity_id,
  'quality_assessment' AS activity_type,
  qa.assessor_id AS actor_id,
  ap.username AS actor_username,
  ap.role AS actor_role,
  ap.reputation_score AS actor_reputation,
  NULL::uuid AS recipient_id,
  NULL::text AS recipient_username,
  -- Node context
  qa.node_id,
  n.title AS node_title,
  n.slug AS node_slug,
  -- Activity detail
  qa.previous_tier || ' → ' || qa.new_tier || ': ' || COALESCE(qa.justification, '') AS detail_text,
  qa.new_tier AS detail_category,
  0 AS detail_size,
  false AS is_revert,
  false AS is_reverted,
  false AS is_flagged,
  qa.created_at
FROM public.quality_assessments qa
JOIN public.profiles ap ON qa.assessor_id = ap.id
JOIN public.nodes n ON qa.node_id = n.id;

GRANT SELECT ON public.recognition_feed_view TO anon, authenticated;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 4: Update recent_changes_view — Add recognition events            ║
-- ║  Adds Scholar Stars and Insightful endorsements to the firehose.        ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

DROP VIEW IF EXISTS public.recent_changes_view;

CREATE OR REPLACE VIEW public.recent_changes_view AS

-- 1. Revisions (with revert + flag distinction)
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
    WHEN COALESCE(r.is_flagged, false) THEN '⚑ [flagged] ' || r.commit_message
      || ' (' || COALESCE(r.content_size, 0) || ' chars)'
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

-- 4. Peer Reviews (existing)
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
  'submitted peer review' AS action_summary,
  pr.created_at
FROM public.peer_reviews pr
JOIN public.nodes n ON pr.node_id = n.id
JOIN public.profiles p ON pr.reviewer_id = p.id

UNION ALL

-- 5. Scholar Stars (NEW — recognition events in the firehose)
SELECT
  ss.id AS activity_id,
  COALESCE(rev.node_id, NULL) AS node_id,
  COALESCE(nd.title, 'Profile Recognition') AS node_title,
  COALESCE(nd.slug, '') AS node_slug,
  ss.giver_id AS author_id,
  gp.username AS author_username,
  gp.role AS author_role,
  gp.reputation_score AS author_reputation,
  'recognition' AS activity_type,
  '⭐ Scholar Star → @' || rp.username || ': "' ||
    CASE WHEN char_length(ss.reason) > 80 THEN substring(ss.reason from 1 for 80) || '…'
         ELSE ss.reason END
    || '"' AS action_summary,
  ss.created_at
FROM public.scholar_stars ss
JOIN public.profiles gp ON ss.giver_id = gp.id
JOIN public.profiles rp ON ss.recipient_id = rp.id
LEFT JOIN public.revisions rev ON ss.source_id = rev.id AND ss.source_type = 'revision'
LEFT JOIN public.nodes nd ON rev.node_id = nd.id

UNION ALL

-- 6. Insightful Endorsements (NEW — recognition in firehose)
SELECT
  e.id AS activity_id,
  r.node_id,
  n.title AS node_title,
  n.slug AS node_slug,
  e.endorser_id AS author_id,
  ep.username AS author_username,
  ep.role AS author_role,
  ep.reputation_score AS author_reputation,
  'recognition' AS activity_type,
  '💡 Insightful → @' || rp.username || '''s edit on "' || n.title || '"' AS action_summary,
  e.created_at
FROM public.endorsements e
JOIN public.profiles ep ON e.endorser_id = ep.id
JOIN public.revisions r ON e.revision_id = r.id
JOIN public.profiles rp ON r.author_id = rp.id
JOIN public.nodes n ON r.node_id = n.id;

GRANT SELECT ON public.recent_changes_view TO anon, authenticated;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 5: get_article_endorsement_stats — Aggregate counts per node      ║
-- ║  Used by the ArticleEndorsementBar on the topic page.                   ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.get_article_endorsement_stats(p_node_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acknowledge_count integer;
  v_insightful_count integer;
  v_star_count integer;
  v_unique_endorsers integer;
  v_revision_ids uuid[];
BEGIN
  -- Get all revision IDs for this node
  SELECT ARRAY_AGG(id) INTO v_revision_ids
  FROM public.revisions
  WHERE node_id = p_node_id;

  IF v_revision_ids IS NULL THEN
    RETURN json_build_object(
      'acknowledges', 0,
      'insightful', 0,
      'scholar_stars', 0,
      'unique_endorsers', 0
    );
  END IF;

  -- Count acknowledges (👏)
  SELECT COUNT(*) INTO v_acknowledge_count
  FROM public.contribution_votes
  WHERE revision_id = ANY(v_revision_ids);

  -- Count insightful endorsements (💡)
  SELECT COUNT(*) INTO v_insightful_count
  FROM public.endorsements
  WHERE revision_id = ANY(v_revision_ids);

  -- Count scholar stars (⭐) linked to revisions of this node
  SELECT COUNT(*) INTO v_star_count
  FROM public.scholar_stars
  WHERE source_type = 'revision'
    AND source_id = ANY(v_revision_ids);

  -- Count unique endorsers across all types
  SELECT COUNT(DISTINCT endorser) INTO v_unique_endorsers
  FROM (
    SELECT user_id AS endorser FROM public.contribution_votes WHERE revision_id = ANY(v_revision_ids)
    UNION
    SELECT endorser_id AS endorser FROM public.endorsements WHERE revision_id = ANY(v_revision_ids)
    UNION
    SELECT giver_id AS endorser FROM public.scholar_stars WHERE source_type = 'revision' AND source_id = ANY(v_revision_ids)
  ) all_endorsers;

  RETURN json_build_object(
    'acknowledges', v_acknowledge_count,
    'insightful', v_insightful_count,
    'scholar_stars', v_star_count,
    'unique_endorsers', v_unique_endorsers
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_article_endorsement_stats TO anon, authenticated;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  DONE                                                                   ║
-- ║  Verify by running:                                                     ║
-- ║    SELECT * FROM recognition_feed_view ORDER BY created_at DESC LIMIT 5;║
-- ║    SELECT * FROM recent_changes_view                                    ║
-- ║      WHERE activity_type = 'recognition' LIMIT 5;                       ║
-- ║    SELECT get_article_endorsement_stats('<some-node-id>');               ║
-- ║    SELECT * FROM activity_comments LIMIT 5;                             ║
-- ╚════════════════════════════════════════════════════════════════════════════╝
