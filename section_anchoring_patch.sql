-- ============================================================================
-- SIDDHANT: Section Anchoring & Pedagogical Edge Removal Patch
-- ============================================================================
-- Run this ENTIRE file in the Supabase SQL Editor.
-- It will:
--   1. Create the `article_sections` table for stable rendering/navigation identities.
--   2. Add `target_section_id` to `cross_references`.
--   3. Remove pedagogical edge types from `cross_references_relationship_type_check`.
-- ============================================================================

-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 1: Create 'article_sections' table                                ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.article_sections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  node_id uuid REFERENCES public.nodes(id) ON DELETE CASCADE NOT NULL,
  slug text NOT NULL, -- Opaque immutable identifier (e.g. 'sec_a81f2c')
  title text NOT NULL,
  level integer NOT NULL,
  order_index integer NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  deleted_at timestamptz,
  UNIQUE(node_id, slug)
);

-- Indices for common queries
CREATE INDEX IF NOT EXISTS idx_article_sections_node_id_deleted_at ON public.article_sections (node_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_article_sections_node_id_order_index ON public.article_sections (node_id, order_index);

ALTER TABLE public.article_sections ENABLE ROW LEVEL SECURITY;

-- Everyone can read active sections
CREATE POLICY "Article sections viewable by everyone." 
  ON public.article_sections FOR SELECT USING (true);

-- Authors/Admins can modify via service roles / direct triggers.
-- Assuming standard access for authenticated users or service role usage.


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 2: Add 'target_section_id' to 'cross_references'                  ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.cross_references 
  ADD COLUMN IF NOT EXISTS target_section_id uuid REFERENCES public.article_sections(id) ON DELETE SET NULL;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 3: Remove pedagogical edge types                                  ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- Drop existing constraint
ALTER TABLE public.cross_references 
  DROP CONSTRAINT IF EXISTS cross_references_relationship_type_check;

-- Re-add constraint WITHOUT pedagogical types:
-- Removed: 'prerequisite', 'distinguish_from', 'related_to', 'grouped_with', 'analogous_to'
ALTER TABLE public.cross_references 
  ADD CONSTRAINT cross_references_relationship_type_check 
  CHECK (relationship_type IN (
    -- Structural (1)
    'part_of',
    -- Legislative Lineage (5)
    'replaces', 'amends', 'repeals', 'subordinate_to', 'overrides',
    -- Judicial Treatment (9)
    'followed', 'applied', 'approved', 'explained', 'referred_to',
    'distinguished', 'doubted', 'not_followed', 'overruled',
    -- Conceptual (3)
    'interprets', 'establishes', 'codifies',
    'exception_to', 'governed_by'
  ));

-- Note: If existing data had those pedagogical edge types, this constraint addition might fail.
-- You would need to DELETE or UPDATE those rows first.
-- E.g. DELETE FROM public.cross_references WHERE relationship_type IN ('prerequisite', 'distinguish_from', 'related_to', 'grouped_with', 'analogous_to');
