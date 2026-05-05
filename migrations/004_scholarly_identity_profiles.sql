-- ============================================================================
-- SIDDHANT: Scholarly Identity Profile Layer
-- ============================================================================
-- Adds restrained scholarly profile fields and exposes them to recognition
-- surfaces. Siddhant remains the primary identity environment; external links
-- are optional supporting references.
--
-- Run this file in the Supabase SQL Editor after the existing recognition feed
-- migrations.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_display_name text,
  ADD COLUMN IF NOT EXISTS institution_name text,
  ADD COLUMN IF NOT EXISTS scholarly_role text,
  ADD COLUMN IF NOT EXISTS areas_of_interest text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS short_bio text,
  ADD COLUMN IF NOT EXISTS profile_photo text,
  ADD COLUMN IF NOT EXISTS linkedin_url text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_scholarly_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_scholarly_role_check
  CHECK (
    scholarly_role IS NULL OR scholarly_role IN (
      'Law Student',
      'Advocate',
      'Academic',
      'Researcher',
      'Independent Scholar'
    )
  );

COMMENT ON COLUMN public.profiles.full_display_name IS
  'Contributor name displayed on Siddhant scholarly identity records.';
COMMENT ON COLUMN public.profiles.institution_name IS
  'Institutional affiliation or scholarly home, supplied by the contributor.';
COMMENT ON COLUMN public.profiles.scholarly_role IS
  'Restrained scholarly role taxonomy for contributor identity.';
COMMENT ON COLUMN public.profiles.areas_of_interest IS
  'Constitutional or legal areas the contributor wants associated with their Siddhant record.';
COMMENT ON COLUMN public.profiles.short_bio IS
  'Short scholarly biography for the Siddhant profile.';
COMMENT ON COLUMN public.profiles.profile_photo IS
  'Optional profile image URL; Siddhant profile remains primary identity.';
COMMENT ON COLUMN public.profiles.linkedin_url IS
  'Optional external reference link. Never used as the primary profile destination.';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    username,
    full_display_name,
    profile_photo
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    NULLIF(COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), ''),
    NULLIF(COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_display_name = COALESCE(public.profiles.full_display_name, EXCLUDED.full_display_name),
    profile_photo = COALESCE(public.profiles.profile_photo, EXCLUDED.profile_photo);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the recognition feed with contributor identity columns.
-- This preserves existing semantic, group, and recognition fields while adding
-- profile depth for actor/recipient rendering.
DROP VIEW IF EXISTS public.recognition_feed_view;

CREATE OR REPLACE VIEW public.recognition_feed_view AS

-- 1. Revisions
SELECT
  r.id AS activity_id,
  'revision' AS activity_type,
  r.author_id AS actor_id,
  p.username AS actor_username,
  p.full_display_name AS actor_full_display_name,
  p.institution_name AS actor_institution_name,
  p.scholarly_role AS actor_scholarly_role,
  p.areas_of_interest AS actor_areas_of_interest,
  p.profile_photo AS actor_profile_photo,
  p.role AS actor_role,
  p.reputation_score AS actor_reputation,
  NULL::uuid AS recipient_id,
  NULL::text AS recipient_username,
  NULL::text AS recipient_full_display_name,
  NULL::text AS recipient_institution_name,
  NULL::text AS recipient_scholarly_role,
  NULL::text[] AS recipient_areas_of_interest,
  NULL::text AS recipient_profile_photo,
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
  rs.contribution_thesis,
  rs.contribution_type,
  rs.contribution_scope,
  rs.significance AS scholarly_significance,
  rs.claims_added,
  rs.concepts_introduced,
  rs.evidence_quality,
  rs.reasoning AS semantic_reasoning,
  rs.extraction_model AS semantic_extraction_model,
  rs.extracted_at AS semantic_extracted_at,
  NULL::uuid AS group_id,
  NULL::text AS group_name,
  NULL::text AS group_slug,
  r.created_at
FROM public.revisions r
JOIN public.nodes n ON r.node_id = n.id
JOIN public.profiles p ON r.author_id = p.id
LEFT JOIN public.revision_semantics rs ON rs.revision_id = r.id

UNION ALL

-- 2. Scholar Stars
SELECT
  ss.id AS activity_id,
  'scholar_star' AS activity_type,
  ss.giver_id AS actor_id,
  gp.username AS actor_username,
  gp.full_display_name AS actor_full_display_name,
  gp.institution_name AS actor_institution_name,
  gp.scholarly_role AS actor_scholarly_role,
  gp.areas_of_interest AS actor_areas_of_interest,
  gp.profile_photo AS actor_profile_photo,
  gp.role AS actor_role,
  gp.reputation_score AS actor_reputation,
  ss.recipient_id,
  rp.username AS recipient_username,
  rp.full_display_name AS recipient_full_display_name,
  rp.institution_name AS recipient_institution_name,
  rp.scholarly_role AS recipient_scholarly_role,
  rp.areas_of_interest AS recipient_areas_of_interest,
  rp.profile_photo AS recipient_profile_photo,
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
  rev_node.contribution_thesis,
  rev_node.contribution_type,
  rev_node.contribution_scope,
  rev_node.scholarly_significance,
  rev_node.claims_added,
  rev_node.concepts_introduced,
  rev_node.evidence_quality,
  rev_node.semantic_reasoning,
  rev_node.semantic_extraction_model,
  rev_node.semantic_extracted_at,
  NULL::uuid AS group_id,
  NULL::text AS group_name,
  NULL::text AS group_slug,
  ss.created_at
FROM public.scholar_stars ss
JOIN public.profiles gp ON ss.giver_id = gp.id
JOIN public.profiles rp ON ss.recipient_id = rp.id
LEFT JOIN LATERAL (
  SELECT
    r.node_id,
    nd.title AS node_title,
    nd.slug AS node_slug,
    r.commit_message,
    rs.contribution_thesis,
    rs.contribution_type,
    rs.contribution_scope,
    rs.significance AS scholarly_significance,
    rs.claims_added,
    rs.concepts_introduced,
    rs.evidence_quality,
    rs.reasoning AS semantic_reasoning,
    rs.extraction_model AS semantic_extraction_model,
    rs.extracted_at AS semantic_extracted_at
  FROM public.revisions r
  JOIN public.nodes nd ON r.node_id = nd.id
  LEFT JOIN public.revision_semantics rs ON rs.revision_id = r.id
  WHERE r.id = ss.source_id AND ss.source_type = 'revision'
  LIMIT 1
) rev_node ON true

UNION ALL

-- 3. Insightful Endorsements
SELECT
  e.id AS activity_id,
  'endorsement' AS activity_type,
  e.endorser_id AS actor_id,
  ep.username AS actor_username,
  ep.full_display_name AS actor_full_display_name,
  ep.institution_name AS actor_institution_name,
  ep.scholarly_role AS actor_scholarly_role,
  ep.areas_of_interest AS actor_areas_of_interest,
  ep.profile_photo AS actor_profile_photo,
  ep.role AS actor_role,
  ep.reputation_score AS actor_reputation,
  r.author_id AS recipient_id,
  rp.username AS recipient_username,
  rp.full_display_name AS recipient_full_display_name,
  rp.institution_name AS recipient_institution_name,
  rp.scholarly_role AS recipient_scholarly_role,
  rp.areas_of_interest AS recipient_areas_of_interest,
  rp.profile_photo AS recipient_profile_photo,
  r.node_id,
  n.title AS node_title,
  n.slug AS node_slug,
  'Insightful endorsement' AS detail_text,
  NULL::text AS detail_category,
  0 AS detail_size,
  false AS is_revert,
  false AS is_reverted,
  false AS is_flagged,
  e.revision_id AS source_revision_id,
  r.commit_message AS source_commit_message,
  rs.contribution_thesis,
  rs.contribution_type,
  rs.contribution_scope,
  rs.significance AS scholarly_significance,
  rs.claims_added,
  rs.concepts_introduced,
  rs.evidence_quality,
  rs.reasoning AS semantic_reasoning,
  rs.extraction_model AS semantic_extraction_model,
  rs.extracted_at AS semantic_extracted_at,
  NULL::uuid AS group_id,
  NULL::text AS group_name,
  NULL::text AS group_slug,
  e.created_at
FROM public.endorsements e
JOIN public.profiles ep ON e.endorser_id = ep.id
JOIN public.revisions r ON e.revision_id = r.id
JOIN public.profiles rp ON r.author_id = rp.id
JOIN public.nodes n ON r.node_id = n.id
LEFT JOIN public.revision_semantics rs ON rs.revision_id = r.id

UNION ALL

-- 4. Acknowledges
SELECT
  uuid_generate_v5(uuid_nil(), cv.user_id::text || ':' || cv.revision_id::text) AS activity_id,
  'acknowledge' AS activity_type,
  cv.user_id AS actor_id,
  ap.username AS actor_username,
  ap.full_display_name AS actor_full_display_name,
  ap.institution_name AS actor_institution_name,
  ap.scholarly_role AS actor_scholarly_role,
  ap.areas_of_interest AS actor_areas_of_interest,
  ap.profile_photo AS actor_profile_photo,
  ap.role AS actor_role,
  ap.reputation_score AS actor_reputation,
  r.author_id AS recipient_id,
  rp.username AS recipient_username,
  rp.full_display_name AS recipient_full_display_name,
  rp.institution_name AS recipient_institution_name,
  rp.scholarly_role AS recipient_scholarly_role,
  rp.areas_of_interest AS recipient_areas_of_interest,
  rp.profile_photo AS recipient_profile_photo,
  r.node_id,
  n.title AS node_title,
  n.slug AS node_slug,
  'Acknowledged contribution' AS detail_text,
  NULL::text AS detail_category,
  0 AS detail_size,
  false AS is_revert,
  false AS is_reverted,
  false AS is_flagged,
  cv.revision_id AS source_revision_id,
  r.commit_message AS source_commit_message,
  rs.contribution_thesis,
  rs.contribution_type,
  rs.contribution_scope,
  rs.significance AS scholarly_significance,
  rs.claims_added,
  rs.concepts_introduced,
  rs.evidence_quality,
  rs.reasoning AS semantic_reasoning,
  rs.extraction_model AS semantic_extraction_model,
  rs.extracted_at AS semantic_extracted_at,
  NULL::uuid AS group_id,
  NULL::text AS group_name,
  NULL::text AS group_slug,
  cv.created_at
FROM public.contribution_votes cv
JOIN public.profiles ap ON cv.user_id = ap.id
JOIN public.revisions r ON cv.revision_id = r.id
JOIN public.profiles rp ON r.author_id = rp.id
JOIN public.nodes n ON r.node_id = n.id
LEFT JOIN public.revision_semantics rs ON rs.revision_id = r.id

UNION ALL

-- 5. Quality Votes
SELECT
  qv.id AS activity_id,
  'quality_vote' AS activity_type,
  qv.voter_id AS actor_id,
  vp.username AS actor_username,
  vp.full_display_name AS actor_full_display_name,
  vp.institution_name AS actor_institution_name,
  vp.scholarly_role AS actor_scholarly_role,
  vp.areas_of_interest AS actor_areas_of_interest,
  vp.profile_photo AS actor_profile_photo,
  vp.role AS actor_role,
  vp.reputation_score AS actor_reputation,
  NULL::uuid AS recipient_id,
  NULL::text AS recipient_username,
  NULL::text AS recipient_full_display_name,
  NULL::text AS recipient_institution_name,
  NULL::text AS recipient_scholarly_role,
  NULL::text[] AS recipient_areas_of_interest,
  NULL::text AS recipient_profile_photo,
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
  r.commit_message AS source_commit_message,
  rs.contribution_thesis,
  rs.contribution_type,
  rs.contribution_scope,
  rs.significance AS scholarly_significance,
  rs.claims_added,
  rs.concepts_introduced,
  rs.evidence_quality,
  rs.reasoning AS semantic_reasoning,
  rs.extraction_model AS semantic_extraction_model,
  rs.extracted_at AS semantic_extracted_at,
  NULL::uuid AS group_id,
  NULL::text AS group_name,
  NULL::text AS group_slug,
  qv.created_at
FROM public.quality_votes qv
JOIN public.profiles vp ON qv.voter_id = vp.id
JOIN public.nodes n ON qv.node_id = n.id
LEFT JOIN public.revisions r ON qv.revision_id = r.id
LEFT JOIN public.revision_semantics rs ON rs.revision_id = r.id

UNION ALL

-- 6. Quality Assessments
SELECT
  qa.id AS activity_id,
  'quality_assessment' AS activity_type,
  qa.assessor_id AS actor_id,
  ap.username AS actor_username,
  ap.full_display_name AS actor_full_display_name,
  ap.institution_name AS actor_institution_name,
  ap.scholarly_role AS actor_scholarly_role,
  ap.areas_of_interest AS actor_areas_of_interest,
  ap.profile_photo AS actor_profile_photo,
  ap.role AS actor_role,
  ap.reputation_score AS actor_reputation,
  NULL::uuid AS recipient_id,
  NULL::text AS recipient_username,
  NULL::text AS recipient_full_display_name,
  NULL::text AS recipient_institution_name,
  NULL::text AS recipient_scholarly_role,
  NULL::text[] AS recipient_areas_of_interest,
  NULL::text AS recipient_profile_photo,
  qa.node_id,
  n.title AS node_title,
  n.slug AS node_slug,
  qa.previous_tier || ' -> ' || qa.new_tier || ': ' || COALESCE(qa.justification, '') AS detail_text,
  qa.new_tier AS detail_category,
  0 AS detail_size,
  false AS is_revert,
  false AS is_reverted,
  false AS is_flagged,
  NULL::uuid AS source_revision_id,
  NULL::text AS source_commit_message,
  NULL::text AS contribution_thesis,
  NULL::text AS contribution_type,
  NULL::text AS contribution_scope,
  NULL::text AS scholarly_significance,
  NULL::text[] AS claims_added,
  NULL::text[] AS concepts_introduced,
  NULL::text AS evidence_quality,
  NULL::text AS semantic_reasoning,
  NULL::text AS semantic_extraction_model,
  NULL::timestamptz AS semantic_extracted_at,
  NULL::uuid AS group_id,
  NULL::text AS group_name,
  NULL::text AS group_slug,
  qa.created_at
FROM public.quality_assessments qa
JOIN public.profiles ap ON qa.assessor_id = ap.id
JOIN public.nodes n ON qa.node_id = n.id

UNION ALL

-- 7. Group Posts
SELECT
  gd.id AS activity_id,
  'group_post' AS activity_type,
  gd.author_id AS actor_id,
  p.username AS actor_username,
  p.full_display_name AS actor_full_display_name,
  p.institution_name AS actor_institution_name,
  p.scholarly_role AS actor_scholarly_role,
  p.areas_of_interest AS actor_areas_of_interest,
  p.profile_photo AS actor_profile_photo,
  p.role AS actor_role,
  p.reputation_score AS actor_reputation,
  NULL::uuid AS recipient_id,
  NULL::text AS recipient_username,
  NULL::text AS recipient_full_display_name,
  NULL::text AS recipient_institution_name,
  NULL::text AS recipient_scholarly_role,
  NULL::text[] AS recipient_areas_of_interest,
  NULL::text AS recipient_profile_photo,
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
  NULL::text AS contribution_thesis,
  NULL::text AS contribution_type,
  NULL::text AS contribution_scope,
  NULL::text AS scholarly_significance,
  NULL::text[] AS claims_added,
  NULL::text[] AS concepts_introduced,
  NULL::text AS evidence_quality,
  NULL::text AS semantic_reasoning,
  NULL::text AS semantic_extraction_model,
  NULL::timestamptz AS semantic_extracted_at,
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

-- 8. Mentorship Started
SELECT
  m.id AS activity_id,
  'mentorship_started' AS activity_type,
  m.mentor_id AS actor_id,
  mp.username AS actor_username,
  mp.full_display_name AS actor_full_display_name,
  mp.institution_name AS actor_institution_name,
  mp.scholarly_role AS actor_scholarly_role,
  mp.areas_of_interest AS actor_areas_of_interest,
  mp.profile_photo AS actor_profile_photo,
  mp.role AS actor_role,
  mp.reputation_score AS actor_reputation,
  m.mentee_id AS recipient_id,
  mep.username AS recipient_username,
  mep.full_display_name AS recipient_full_display_name,
  mep.institution_name AS recipient_institution_name,
  mep.scholarly_role AS recipient_scholarly_role,
  mep.areas_of_interest AS recipient_areas_of_interest,
  mep.profile_photo AS recipient_profile_photo,
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
  NULL::text AS contribution_thesis,
  NULL::text AS contribution_type,
  NULL::text AS contribution_scope,
  NULL::text AS scholarly_significance,
  NULL::text[] AS claims_added,
  NULL::text[] AS concepts_introduced,
  NULL::text AS evidence_quality,
  NULL::text AS semantic_reasoning,
  NULL::text AS semantic_extraction_model,
  NULL::timestamptz AS semantic_extracted_at,
  m.group_id AS group_id,
  sg.name AS group_name,
  sg.slug AS group_slug,
  m.started_at AS created_at
FROM public.mentorships m
JOIN public.profiles mp ON m.mentor_id = mp.id
JOIN public.profiles mep ON m.mentee_id = mep.id
JOIN public.subject_groups sg ON m.group_id = sg.id;

GRANT SELECT ON public.recognition_feed_view TO anon, authenticated;
