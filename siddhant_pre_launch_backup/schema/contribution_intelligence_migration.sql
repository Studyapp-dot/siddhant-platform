-- ============================================================================
-- SIDDHANT: Contribution Intelligence Migration
-- ============================================================================
-- Adds revision-level semantic extraction storage and exposes it to the
-- recognition feed. AI describes the intellectual change; humans still validate
-- it through endorsements, Scholar Stars, and quality processes.
--
-- Run this ENTIRE file in the Supabase SQL Editor.
-- It is idempotent and safe to run multiple times.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.revision_semantics (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  revision_id uuid REFERENCES public.revisions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  contribution_thesis text NOT NULL,
  contribution_type text NOT NULL CHECK (contribution_type IN (
    'citation_addition',
    'doctrinal_expansion',
    'conceptual_clarification',
    'precedent_synthesis',
    'contradiction_resolution',
    'structural_reorganization',
    'historical_context',
    'analytical_improvement',
    'terminology_standardization',
    'evidence_strengthening',
    'mixed'
  )),
  contribution_scope text NOT NULL CHECK (contribution_scope IN (
    'local',
    'section_wide',
    'article_wide',
    'doctrinal',
    'cross_node'
  )),
  significance text NOT NULL CHECK (significance IN (
    'minor',
    'meaningful',
    'substantial',
    'foundational'
  )),
  claims_added text[] DEFAULT '{}'::text[] NOT NULL,
  concepts_introduced text[] DEFAULT '{}'::text[] NOT NULL,
  evidence_quality text NOT NULL CHECK (evidence_quality IN (
    'citation_backed',
    'reasoning_backed',
    'assertion_only',
    'incomplete',
    'mixed'
  )),
  reasoning text,
  extraction_model text,
  extracted_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revision_semantics_revision_id
  ON public.revision_semantics (revision_id);
CREATE INDEX IF NOT EXISTS idx_revision_semantics_type
  ON public.revision_semantics (contribution_type);
CREATE INDEX IF NOT EXISTS idx_revision_semantics_significance
  ON public.revision_semantics (significance);

ALTER TABLE public.revision_semantics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Revision semantics are viewable by everyone.'
      AND tablename = 'revision_semantics'
  ) THEN
    CREATE POLICY "Revision semantics are viewable by everyone."
      ON public.revision_semantics FOR SELECT USING (true);
  END IF;
END $$;

GRANT SELECT ON public.revision_semantics TO anon, authenticated;

DROP VIEW IF EXISTS public.recognition_feed_view;

CREATE OR REPLACE VIEW public.recognition_feed_view AS

-- 1. Revisions
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
  ap.role AS actor_role,
  ap.reputation_score AS actor_reputation,
  NULL::uuid AS recipient_id,
  NULL::text AS recipient_username,
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
  qa.created_at
FROM public.quality_assessments qa
JOIN public.profiles ap ON qa.assessor_id = ap.id
JOIN public.nodes n ON qa.node_id = n.id;

GRANT SELECT ON public.recognition_feed_view TO anon, authenticated;

-- Verify:
-- SELECT activity_type, contribution_thesis, contribution_type, scholarly_significance
-- FROM public.recognition_feed_view
-- ORDER BY created_at DESC
-- LIMIT 10;
