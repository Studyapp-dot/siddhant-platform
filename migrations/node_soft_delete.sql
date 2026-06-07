-- ============================================================================
-- SOFT DELETE SUPPORT FOR NODES
--
-- Adds deleted_at column to enable safe, reversible node deletion.
-- Nodes with deleted_at set are excluded from all queries.
-- ============================================================================

-- Add soft delete column
ALTER TABLE public.nodes
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add created_by column if missing (needed for ownership checks)
ALTER TABLE public.nodes
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) DEFAULT NULL;

-- Index for efficient filtering of non-deleted nodes
CREATE INDEX IF NOT EXISTS idx_nodes_deleted_at
  ON public.nodes (deleted_at)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'nodes' AND column_name IN ('deleted_at', 'created_by');
