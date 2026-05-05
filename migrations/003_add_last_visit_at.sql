-- ============================================================================
-- SIDDHANT: Engagement Infrastructure Migration
-- Phase 1A — Add last_visit_at tracking to profiles
-- 
-- This column enables the "since your last visit" dashboard features:
--   - Watchlist delta detection
--   - Recognition received since last visit
--   - New messages since last visit
--   - Personal activity summary
--
-- Run this migration in the Supabase SQL Editor.
-- This is a non-destructive ADD COLUMN — no existing data is affected.
-- ============================================================================

-- Add last_visit_at to profiles for tracking user return frequency
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ DEFAULT NULL;

-- Add a comment explaining the column's purpose
COMMENT ON COLUMN profiles.last_visit_at IS 
  'Timestamp of user''s last dashboard visit. Used for "since your last visit" delta features. NULL means user has never visited the dashboard.';
