-- ============================================================================
-- SIDDHANT: Knowledge Graph Schema Migration
-- ============================================================================
-- Run this ENTIRE file in the Supabase SQL Editor.
-- It will:
--   1. Wipe all dummy data (nodes, edges, revisions, etc.)
--   2. Enhance the 'nodes' table with node_type, metadata, parent_node_id
--   3. Expand 'cross_references' to support 20 relationship types
--   4. Create 'categories' and 'node_categories' tables
--   5. Create 'learning_paths' and 'learning_path_nodes' tables
--   6. Seed Level 1 category taxonomy
-- ============================================================================

-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 0: CLEAN SLATE — Wipe all dummy data                              ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- Order matters due to foreign keys: children first, then parents
DELETE FROM public.consensus_votes;
DELETE FROM public.inline_tags;
DELETE FROM public.watchlist;
DELETE FROM public.cross_references;
DELETE FROM public.discussions;
DELETE FROM public.revisions;
DELETE FROM public.nodes;

-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 1: Enhance 'nodes' table                                          ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- Add node type discriminator (defaults to 'topic' for backward compatibility)
ALTER TABLE public.nodes 
  ADD COLUMN IF NOT EXISTS node_type text DEFAULT 'topic';

-- Add constraint for valid node types
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nodes_node_type_check'
  ) THEN
    ALTER TABLE public.nodes ADD CONSTRAINT nodes_node_type_check 
      CHECK (node_type IN (
        'statute', 'chapter', 'section', 'constitutional_provision',
        'judgment', 'doctrine', 'concept', 'topic'
      ));
  END IF;
END $$;

-- Add JSONB metadata for type-specific fields
ALTER TABLE public.nodes 
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Add parent_node_id for structural hierarchy (Section → Chapter → Statute)
ALTER TABLE public.nodes 
  ADD COLUMN IF NOT EXISTS parent_node_id uuid REFERENCES public.nodes ON DELETE SET NULL;

-- Index for efficient hierarchy queries
CREATE INDEX IF NOT EXISTS idx_nodes_parent ON public.nodes (parent_node_id);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON public.nodes (node_type);

-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 2: Expand 'cross_references' relationship types                   ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- Drop old constraint
ALTER TABLE public.cross_references 
  DROP CONSTRAINT IF EXISTS cross_references_relationship_type_check;

-- Add new constraint with all 20 relationship types
ALTER TABLE public.cross_references 
  ADD CONSTRAINT cross_references_relationship_type_check 
  CHECK (relationship_type IN (
    -- Structural (2)
    'part_of', 'grouped_with',
    -- Legislative Lineage (5)
    'replaces', 'amends', 'repeals', 'subordinate_to', 'overrides',
    -- Judicial Treatment (9) — matches SCC Online / Manupatra citator terms
    'followed', 'applied', 'approved', 'explained', 'referred_to',
    'distinguished', 'doubted', 'not_followed', 'overruled',
    -- Conceptual (9)
    'interprets', 'establishes', 'codifies',
    'prerequisite', 'distinguish_from', 'related_to',
    'exception_to', 'governed_by', 'analogous_to'
  ));

-- Add description field for optional context on an edge
ALTER TABLE public.cross_references 
  ADD COLUMN IF NOT EXISTS description text;

-- Add signal field for quick filtering of judicial treatment edges
ALTER TABLE public.cross_references 
  ADD COLUMN IF NOT EXISTS signal text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cross_references_signal_check'
  ) THEN
    ALTER TABLE public.cross_references ADD CONSTRAINT cross_references_signal_check 
      CHECK (signal IN ('positive', 'neutral', 'cautionary', 'negative'));
  END IF;
END $$;

-- Drop old unique constraint (source, target, type) 
-- and recreate to accommodate the new types
ALTER TABLE public.cross_references 
  DROP CONSTRAINT IF EXISTS cross_references_source_node_id_target_node_id_relationship_key;

ALTER TABLE public.cross_references 
  ADD CONSTRAINT cross_references_source_target_type_unique 
  UNIQUE (source_node_id, target_node_id, relationship_type);

-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 3: Create 'categories' table                                      ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  parent_id uuid REFERENCES public.categories ON DELETE CASCADE,
  depth_level integer NOT NULL CHECK (depth_level BETWEEN 1 AND 4),
  description text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT NOW()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Everyone can read categories
CREATE POLICY "Categories viewable by everyone." 
  ON public.categories FOR SELECT USING (true);

-- Only admins can manage categories  
CREATE POLICY "Admins can manage categories."
  ON public.categories FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 4: Create 'node_categories' junction table                        ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.node_categories (
  node_id uuid REFERENCES public.nodes ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES public.categories ON DELETE CASCADE NOT NULL,
  is_primary boolean DEFAULT false,
  PRIMARY KEY (node_id, category_id)
);

ALTER TABLE public.node_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Node categories viewable by everyone."
  ON public.node_categories FOR SELECT USING (true);

CREATE POLICY "Registered users can categorize nodes."
  ON public.node_categories FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Enforce exactly one primary category per node
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_primary_category 
  ON public.node_categories (node_id) WHERE is_primary = true;

-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 5: Create 'learning_paths' tables                                 ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.learning_paths (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  category_id uuid REFERENCES public.categories,
  difficulty text CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  exam_relevance text[],
  estimated_hours integer,
  created_by uuid REFERENCES public.profiles,
  is_official boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW()
);

ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Learning paths viewable by everyone."
  ON public.learning_paths FOR SELECT USING (true);

CREATE POLICY "Registered users can create learning paths."
  ON public.learning_paths FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS public.learning_path_nodes (
  path_id uuid REFERENCES public.learning_paths ON DELETE CASCADE NOT NULL,
  node_id uuid REFERENCES public.nodes ON DELETE CASCADE NOT NULL,
  sequence_order integer NOT NULL,
  PRIMARY KEY (path_id, node_id)
);

ALTER TABLE public.learning_path_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Learning path nodes viewable by everyone."
  ON public.learning_path_nodes FOR SELECT USING (true);

-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 6: Seed Level 1 Category Taxonomy                                ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

INSERT INTO public.categories (name, slug, depth_level, display_order, description) VALUES
  ('Constitutional Law', 'constitutional-law', 1, 1, 'The supreme law of India — Articles, Parts, Schedules, Fundamental Rights, Directive Principles, and constitutional doctrines.'),
  ('Criminal Law (Substantive)', 'criminal-law-substantive', 1, 2, 'Offences and punishments — Bharatiya Nyaya Sanhita (BNS), formerly Indian Penal Code (IPC).'),
  ('Criminal Procedure', 'criminal-procedure', 1, 3, 'Procedure for criminal cases — Bharatiya Nagarik Suraksha Sanhita (BNSS), formerly Code of Criminal Procedure (CrPC).'),
  ('Civil Law', 'civil-law', 1, 4, 'Law of Contracts, Torts, Property, and related civil matters.'),
  ('Family & Personal Law', 'family-personal-law', 1, 5, 'Hindu Law, Muslim Personal Law, Christian Law, Special Marriage Act, and related personal matters.'),
  ('Law of Evidence', 'law-of-evidence', 1, 6, 'Bharatiya Sakshya Adhiniyam (BSA), formerly Indian Evidence Act — rules governing proof in court.'),
  ('Civil Procedure', 'civil-procedure', 1, 7, 'Code of Civil Procedure (CPC) — procedure for civil cases, suits, appeals, and execution.'),
  ('Administrative Law', 'administrative-law', 1, 8, 'Government accountability, judicial review of administrative action, natural justice, and delegated legislation.'),
  ('Commercial & Corporate Law', 'commercial-corporate-law', 1, 9, 'Companies Act, Banking Law, Insurance Law, Intellectual Property, and commercial transactions.'),
  ('Labour & Industrial Law', 'labour-industrial-law', 1, 10, 'Labour codes, industrial disputes, social security, wages, and workplace regulation.'),
  ('Environmental Law', 'environmental-law', 1, 11, 'Environmental protection, pollution control, wildlife, and sustainability laws.'),
  ('Cyber Law & IT', 'cyber-law-it', 1, 12, 'Information Technology Act, data protection, digital privacy, and cyber crimes.'),
  ('Tax Law', 'tax-law', 1, 13, 'Income Tax, GST, customs, and fiscal legislation.'),
  ('International Law', 'international-law', 1, 14, 'Public International Law, treaties, private international law, and conflict of laws.'),
  ('Jurisprudence & Legal Theory', 'jurisprudence-legal-theory', 1, 15, 'Schools of legal thought, philosophy of law, legal reasoning, and interpretation.')
ON CONFLICT (slug) DO NOTHING;

-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  DONE — Verify by running:                                              ║
-- ║    SELECT column_name, data_type FROM information_schema.columns         ║
-- ║    WHERE table_name = 'nodes';                                           ║
-- ║                                                                          ║
-- ║    SELECT * FROM categories ORDER BY display_order;                      ║
-- ╚════════════════════════════════════════════════════════════════════════════╝
