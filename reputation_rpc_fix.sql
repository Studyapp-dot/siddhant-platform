-- ============================================================================
-- SIDDHANT: Reputation RPC Functions (SECURITY DEFINER)
-- These functions bypass RLS to allow server actions to award reputation
-- to OTHER users. Without these, RLS blocks:
--   1. INSERT into reputation_events (no INSERT policy)
--   2. UPDATE on profiles for another user (policy: auth.uid() = id)
-- Run this in Supabase SQL Editor.
-- ============================================================================


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  Function 1: award_reputation_points                                    ║
-- ║  Inserts an audit event + increments the user's reputation_score.       ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.award_reputation_points(
  p_user_id uuid,
  p_event_type text,
  p_points integer,
  p_source_id uuid DEFAULT NULL,
  p_source_type text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_score integer;
BEGIN
  -- 1. Insert the reputation event (audit trail)
  INSERT INTO public.reputation_events (user_id, event_type, points, source_id, source_type, description)
  VALUES (p_user_id, p_event_type, p_points, p_source_id, p_source_type, p_description);

  -- 2. Increment the user's reputation score
  UPDATE public.profiles
  SET reputation_score = COALESCE(reputation_score, 0) + p_points
  WHERE id = p_user_id
  RETURNING reputation_score INTO v_new_score;

  RETURN json_build_object('success', true, 'new_score', v_new_score);
END;
$$;

-- Grant execute to authenticated users (server actions run as authenticated)
GRANT EXECUTE ON FUNCTION public.award_reputation_points TO authenticated;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  Function 2: increment_profile_counter                                  ║
-- ║  Increments a named counter column on another user's profile.           ║
-- ║  Used for: endorsements_received, scholar_stars_received, etc.          ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.increment_profile_counter(
  p_user_id uuid,
  p_column_name text,
  p_amount integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow known counter columns to prevent SQL injection
  IF p_column_name NOT IN (
    'endorsements_received',
    'scholar_stars_received',
    'peer_reviews_completed',
    'accepted_edits_count',
    'total_edits_count',
    'reputation_score'
  ) THEN
    RAISE EXCEPTION 'Invalid column name: %', p_column_name;
  END IF;

  EXECUTE format(
    'UPDATE public.profiles SET %I = COALESCE(%I, 0) + $1 WHERE id = $2',
    p_column_name, p_column_name
  ) USING p_amount, p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_profile_counter TO authenticated;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  Function 3: update_user_role                                           ║
-- ║  Updates a user's role (for level advancement).                         ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.update_user_role(
  p_user_id uuid,
  p_new_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET role = p_new_role
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_role TO authenticated;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  DONE — Run this, then restart your dev server.                         ║
-- ╚════════════════════════════════════════════════════════════════════════════╝
