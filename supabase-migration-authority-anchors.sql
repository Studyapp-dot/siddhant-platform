-- ============================================================================
-- SIDDHANT — Authority Anchors Migration
-- Contextual Authority Anchoring System (Phase 1)
-- 
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================================

-- The authority_anchors table stores text-range-to-authority mappings.
-- Uses resilient text matching (anchor_text + context) instead of fragile
-- character offsets — anchors survive edits gracefully.

CREATE TABLE IF NOT EXISTS public.authority_anchors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    node_id UUID NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
    revision_id UUID NOT NULL REFERENCES public.revisions(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id),
    
    -- Resilient text anchoring (NOT raw offsets)
    -- The system re-resolves positions dynamically using text matching
    anchor_text TEXT NOT NULL,                  -- The exact selected text being attributed
    context_before TEXT DEFAULT '',             -- ~40 chars before selection for re-matching
    context_after TEXT DEFAULT '',              -- ~40 chars after selection for re-matching
    paragraph_index INTEGER DEFAULT 0,         -- Paragraph number (0-indexed) for grouping
    
    -- Authority details  
    authority_type TEXT NOT NULL CHECK (authority_type IN (
        'case', 'statute', 'constitutional_provision', 
        'doctrine', 'concept', 'external_source'
    )),
    authority_title TEXT NOT NULL,              -- e.g., "Maneka Gandhi v. Union of India"
    authority_citation TEXT,                    -- e.g., "AIR 1978 SC 597" (optional)
    authority_url TEXT,                         -- External source URL (optional)
    authority_node_id UUID REFERENCES public.nodes(id),  -- Link to existing Siddhant node
    
    -- Future governance
    source_tier TEXT DEFAULT 'primary' CHECK (source_tier IN (
        'primary', 'secondary', 'tertiary'
    )),
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_authority_anchors_node ON public.authority_anchors(node_id);
CREATE INDEX IF NOT EXISTS idx_authority_anchors_revision ON public.authority_anchors(revision_id);
CREATE INDEX IF NOT EXISTS idx_authority_anchors_authority_node ON public.authority_anchors(authority_node_id);

-- Row Level Security
ALTER TABLE public.authority_anchors ENABLE ROW LEVEL SECURITY;

-- Anyone can read authorities (public knowledge)
CREATE POLICY "authority_anchors_select" ON public.authority_anchors
    FOR SELECT USING (true);

-- Authenticated users can create anchors
CREATE POLICY "authority_anchors_insert" ON public.authority_anchors
    FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Authors can update their own anchors
CREATE POLICY "authority_anchors_update" ON public.authority_anchors
    FOR UPDATE USING (auth.uid() = author_id);

-- Authors can delete their own anchors
CREATE POLICY "authority_anchors_delete" ON public.authority_anchors
    FOR DELETE USING (auth.uid() = author_id);

-- ============================================================================
-- VERIFICATION: Run this after the migration to confirm the table exists
-- ============================================================================
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'authority_anchors' ORDER BY ordinal_position;
