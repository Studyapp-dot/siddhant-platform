'use server';

import { createClient } from '@/utils/supabase/server';
import { REPUTATION_POINTS, LEVEL_THRESHOLDS, ROLE_LABELS } from './reputation-constants';

// ============================================================================
// SIDDHANT: Reputation Engine — Server Actions
// Awards reputation points, checks level advancement, logs all events.
//
// Uses Postgres RPC functions (SECURITY DEFINER) to bypass RLS for
// cross-user operations. Without these, RLS blocks:
//   - INSERT into reputation_events (no INSERT policy for auth users)
//   - UPDATE on profiles for another user (policy: auth.uid() = id)
// ============================================================================


/**
 * Award reputation points to a user and log the event.
 * Uses the award_reputation_points RPC function to bypass RLS.
 */
export async function awardReputation(
  userId: string,
  eventType: keyof typeof REPUTATION_POINTS,
  sourceId?: string,
  sourceType?: string,
  description?: string,
  customPoints?: number,
) {
  const supabase = await createClient();
  const points = customPoints ?? REPUTATION_POINTS[eventType];

  if (points === 0 && !customPoints) return { success: true, points: 0 };

  try {
    const { data, error } = await supabase.rpc('award_reputation_points', {
      p_user_id: userId,
      p_event_type: eventType,
      p_points: points,
      p_source_id: sourceId || null,
      p_source_type: sourceType || null,
      p_description: description || null,
    });

    if (error) {
      console.error('[reputation] Failed to award points:', error);
      return { success: false, error: error.message };
    }

    // Check if user qualifies for level advancement
    await checkLevelAdvancement(userId);

    return { success: true, points };
  } catch (err: any) {
    console.error('[reputation] Exception in awardReputation:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}


/**
 * Check if a user's stats qualify them for a level advancement.
 * Only advances algorithmic levels (contributor → recognized → senior_scholar).
 * Steward and Governance Council require community nomination/election.
 */
export async function checkLevelAdvancement(userId: string) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, reputation_score, accepted_edits_count, total_edits_count')
    .eq('id', userId)
    .single();

  if (!profile) return { advanced: false };

  const acceptanceRate = profile.total_edits_count > 0
    ? (profile.accepted_edits_count / profile.total_edits_count) * 100
    : 0;

  let newRole = profile.role;

  // Check advancement from contributor → recognized
  if (profile.role === 'contributor') {
    const threshold = LEVEL_THRESHOLDS.recognized;
    if (
      profile.accepted_edits_count >= threshold.accepted_edits &&
      acceptanceRate >= threshold.acceptance_rate &&
      profile.reputation_score >= threshold.reputation
    ) {
      newRole = 'recognized';
    }
  }

  // Check advancement from recognized → senior_scholar
  if (profile.role === 'recognized') {
    const threshold = LEVEL_THRESHOLDS.senior_scholar;
    if (
      profile.accepted_edits_count >= threshold.accepted_edits &&
      acceptanceRate >= threshold.acceptance_rate &&
      profile.reputation_score >= threshold.reputation
    ) {
      newRole = 'senior_scholar';
    }
  }

  // Apply advancement if qualified — uses RPC to bypass RLS
  if (newRole !== profile.role) {
    await supabase.rpc('update_user_role', {
      p_user_id: userId,
      p_new_role: newRole,
    });

    // Log the advancement as a reputation event
    await supabase.rpc('award_reputation_points', {
      p_user_id: userId,
      p_event_type: 'tier_advancement_bonus',
      p_points: 0,
      p_source_id: null,
      p_source_type: null,
      p_description: `Advanced from ${ROLE_LABELS[profile.role]?.label} to ${ROLE_LABELS[newRole]?.label}`,
    });

    return { advanced: true, from: profile.role, to: newRole };
  }

  return { advanced: false };
}


/**
 * Increment a user's edit counts when they submit an edit.
 */
export async function incrementEditCount(userId: string) {
  const supabase = await createClient();

  try {
    await supabase.rpc('increment_profile_counter', {
      p_user_id: userId,
      p_column_name: 'total_edits_count',
      p_amount: 1,
    });
  } catch (err) {
    console.error('[reputation] Failed to increment edit count:', err);
  }
}


/**
 * Mark an edit as accepted — called after the 72h window passes
 * without the edit being reverted or flagged.
 * Awards reputation based on whether it's minor or substantive.
 */
export async function acceptEdit(userId: string, revisionId: string, charDelta: number) {
  const supabase = await createClient();

  // Determine if minor or substantive based on character delta
  const isMinor = Math.abs(charDelta) < 50;
  const eventType = isMinor ? 'edit_accepted_minor' : 'edit_accepted_substantive';

  // Increment accepted edits count via RPC
  await supabase.rpc('increment_profile_counter', {
    p_user_id: userId,
    p_column_name: 'accepted_edits_count',
    p_amount: 1,
  });

  // Award reputation
  const result = await awardReputation(
    userId,
    eventType,
    revisionId,
    'revision',
    `Edit ${isMinor ? '(minor)' : '(substantive)'} accepted after community review window`,
  );

  return result;
}


/**
 * Get a user's full reputation breakdown.
 * Returns all the data needed for the profile display.
 */
export async function getReputationBreakdown(userId: string) {
  const supabase = await createClient();

  // Fetch profile stats
  const { data: profile } = await supabase
    .from('profiles')
    .select('reputation_score, accepted_edits_count, total_edits_count, endorsements_received, peer_reviews_completed, scholar_stars_received, role')
    .eq('id', userId)
    .single();

  if (!profile) return null;

  // Fetch recent reputation events (last 20)
  const { data: events } = await supabase
    .from('reputation_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Fetch Scholar Stars with written reasons
  const { data: stars } = await supabase
    .from('scholar_stars')
    .select(`
      id, reason, source_type, created_at,
      giver:profiles!scholar_stars_giver_id_fkey ( username )
    `)
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  const acceptanceRate = profile.total_edits_count > 0
    ? Math.round((profile.accepted_edits_count / profile.total_edits_count) * 1000) / 10
    : 0;

  const roleInfo = ROLE_LABELS[profile.role] || { label: profile.role, level: 0 };

  // Calculate next level requirements
  let nextLevel = null;
  if (profile.role === 'contributor') {
    const t = LEVEL_THRESHOLDS.recognized;
    nextLevel = {
      name: 'Recognized Contributor',
      requirements: {
        accepted_edits: { current: profile.accepted_edits_count, needed: t.accepted_edits },
        acceptance_rate: { current: acceptanceRate, needed: t.acceptance_rate },
        reputation: { current: profile.reputation_score, needed: t.reputation },
      },
    };
  } else if (profile.role === 'recognized') {
    const t = LEVEL_THRESHOLDS.senior_scholar;
    nextLevel = {
      name: 'Senior Scholar',
      requirements: {
        accepted_edits: { current: profile.accepted_edits_count, needed: t.accepted_edits },
        acceptance_rate: { current: acceptanceRate, needed: t.acceptance_rate },
        reputation: { current: profile.reputation_score, needed: t.reputation },
      },
    };
  }

  return {
    reputation_score: profile.reputation_score,
    accepted_edits: profile.accepted_edits_count,
    total_edits: profile.total_edits_count,
    acceptance_rate: acceptanceRate,
    endorsements: profile.endorsements_received,
    peer_reviews: profile.peer_reviews_completed,
    scholar_stars_count: profile.scholar_stars_received,
    role: profile.role,
    role_label: roleInfo.label,
    role_level: roleInfo.level,
    next_level: nextLevel,
    recent_events: events || [],
    scholar_stars: stars || [],
  };
}
