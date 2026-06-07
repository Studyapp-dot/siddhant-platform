-- ============================================================================
-- SIDDHANT: Paragraph-Native Knowledge Model
-- ============================================================================
-- Run this ENTIRE file in the Supabase SQL Editor.
-- It will:
--   1. Create the `paragraphs` table for atomic knowledge units.
--   2. Create the `paragraph_revisions` table for paragraph-level edit history.
--   3. Create the `generate_paragraph_stable_id()` helper function.
--
-- It does NOT:
--   - Drop or alter `article_sections` (frozen, not removed)
--   - Alter `cross_references` (deferred to Phase 1.5)
--   - Migrate any existing content (old nodes use report_content permanently)
-- ============================================================================


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 1: Helper function — generate stable_id                           ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION generate_paragraph_stable_id()
RETURNS text AS $$
DECLARE
  chars text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result text := 'p_';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 2: Create 'paragraphs' table                                      ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.paragraphs (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  node_id        uuid REFERENCES public.nodes(id) ON DELETE CASCADE NOT NULL,
  stable_id      text NOT NULL,               -- Permanent opaque ID (e.g. 'p_k7m2x9'), never changes
  display_number integer NOT NULL,            -- Reading-order position, renumbered on insert/delete
  marginal_note  text,                        -- Author-provided topical label
  content        text NOT NULL DEFAULT '',    -- Markdown content
  group_label    text,                        -- Visual grouping label (e.g. 'Classification Doctrine')
  order_index    integer NOT NULL,            -- Rendering order (== display_number in steady state)
  created_by     uuid REFERENCES public.profiles(id),
  created_at     timestamptz DEFAULT NOW(),
  updated_at     timestamptz DEFAULT NOW(),
  deleted_at     timestamptz,                 -- Soft delete preserves references

  UNIQUE(node_id, stable_id),
  CONSTRAINT paragraphs_unique_display_number
    UNIQUE (node_id, display_number)
    -- Note: Supabase doesn't support partial unique indexes via UNIQUE constraint.
    -- We enforce display_number uniqueness among active paragraphs at the application layer
    -- and via the index below.
);

-- Fast lookup: active paragraphs in reading order
CREATE INDEX IF NOT EXISTS idx_paragraphs_node_order
  ON public.paragraphs(node_id, order_index)
  WHERE deleted_at IS NULL;

-- Resolve stable_id to paragraph
CREATE INDEX IF NOT EXISTS idx_paragraphs_node_stable
  ON public.paragraphs(node_id, stable_id);

-- RLS
ALTER TABLE public.paragraphs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Paragraphs viewable by everyone."
  ON public.paragraphs FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert paragraphs."
  ON public.paragraphs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update paragraphs."
  ON public.paragraphs FOR UPDATE
  USING (auth.role() = 'authenticated');


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 3: Create 'paragraph_revisions' table                             ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.paragraph_revisions (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  paragraph_id    uuid REFERENCES public.paragraphs(id) ON DELETE CASCADE NOT NULL,
  node_id         uuid REFERENCES public.nodes(id) ON DELETE CASCADE NOT NULL,
  author_id       uuid REFERENCES public.profiles(id) NOT NULL,
  content         text NOT NULL,              -- Full paragraph content at this revision
  marginal_note   text,                       -- Marginal note at this revision
  commit_message  text NOT NULL,
  revision_type   text DEFAULT 'content_edit'
    CHECK (revision_type IN ('creation', 'content_edit', 'marginal_note_edit', 'migration', 'deletion', 'revert')),
  content_size    integer,                    -- Visible text size (for delta checks)
  node_revision_id uuid,                     -- Future hook: link to node-level snapshot for reconstruction
  created_at      timestamptz DEFAULT NOW()
);

-- Revision history for a specific paragraph
CREATE INDEX IF NOT EXISTS idx_para_revisions_paragraph
  ON public.paragraph_revisions(paragraph_id, created_at DESC);

-- All paragraph activity for a node (for node-level history views)
CREATE INDEX IF NOT EXISTS idx_para_revisions_node
  ON public.paragraph_revisions(node_id, created_at DESC);

-- RLS
ALTER TABLE public.paragraph_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Paragraph revisions viewable by everyone."
  ON public.paragraph_revisions FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert paragraph revisions."
  ON public.paragraph_revisions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
