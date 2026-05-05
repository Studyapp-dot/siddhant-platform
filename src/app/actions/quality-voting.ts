'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// ============================================================================
// SIDDHANT: Quality Voting — Server Actions
//
// Replaces the old individual "Assess Quality" system for lower tiers
// (stub → b_class) with a community BLIND voting mechanism.
//
// Key principles:
//   - Contributors to a node cannot vote on its quality (independence)
//   - Vote tallies are NOT shown before voting (blind voting, prevents herding)
//   - 3+ votes required before the tier moves above 'stub' (consensus)
//   - Alignment points (+2) when your vote matches consensus (reviewer training)
//   - Votes carry over across revisions but are marked with revision_id
// ============================================================================

const ROLE_LEVELS: Record<string, number> = {
  reader: 1,
  contributor: 2,
  recognized: 3,
  senior_scholar: 4,
  steward: 5,
  governance_council: 6,
};

// Tier display labels for messages
const TIER_LABELS: Record<string, string> = {
  stub: 'Draft',
  start: 'Developing',
  c_class: 'Useful',
  b_class: 'Solid',
};

// All L2+ users can vote for any tier
// Independence (can't vote on own node) + 3-vote consensus threshold prevents gaming
const TIER_MIN_LEVEL: Record<string, number> = {
  stub: 2,
  start: 2,
  c_class: 2,
  b_class: 2,
};

/**
 * Cast a quality vote on a node.
 * - Independence: voter cannot have contributed to the node
 * - Level gate: L2+ for most tiers, L3+ for Solid
 * - Upsert: if user already voted, their vote is updated
 * - Tier recomputed via RPC after each vote
 */
export async function castQualityVote(
  nodeId: string,
  votedTier: string,
  justification?: string,
  slug?: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Validate tier value
  if (!['stub', 'start', 'c_class', 'b_class'].includes(votedTier)) {
    return { error: 'Invalid quality tier for voting' };
  }

  // Get user's role and level
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) return { error: 'Profile not found' };
  const userLevel = ROLE_LEVELS[profile.role] || 1;

  if (userLevel < 2) {
    return { error: 'Only Contributors (Level 2+) can vote on quality' };
  }

  // Level gate for Solid tier
  const requiredLevel = TIER_MIN_LEVEL[votedTier] || 2;
  if (userLevel < requiredLevel) {
    return { error: `Level ${requiredLevel}+ required to vote for "${TIER_LABELS[votedTier]}" tier` };
  }

  // Get the latest revision ID to record what the voter is seeing
  const { data: latestRevision } = await supabase
    .from('revisions')
    .select('id')
    .eq('node_id', nodeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Cast the vote via RPC (handles independence check, consensus computation, rep awards)
  const { data, error } = await supabase.rpc('cast_quality_vote', {
    p_node_id: nodeId,
    p_voter_id: user.id,
    p_voted_tier: votedTier,
    p_justification: justification?.trim() || null,
    p_revision_id: latestRevision?.id || null,
  });

  if (error) return { error: error.message };

  const result = data as {
    success: boolean;
    error?: string;
    vote_count?: number;
    consensus_tier?: string;
    previous_tier?: string;
    is_update?: boolean;
  };

  if (!result?.success) return { error: result?.error || 'Failed to cast vote' };

  if (slug) revalidatePath(`/topic/${slug}`);

  return {
    success: true,
    voteCount: result.vote_count,
    consensusTier: result.consensus_tier,
    previousTier: result.previous_tier,
    isUpdate: result.is_update,
  };
}


/**
 * Get the quality vote summary for a node.
 * Returns: total votes, user's current vote (if any).
 * Vote breakdown is only included if the user has already voted (blind before, transparent after).
 */
export async function getQualityVoteSummary(nodeId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc('get_quality_vote_summary', {
    p_node_id: nodeId,
    p_user_id: user?.id || null,
  });

  if (error) {
    console.error('[quality-voting] get summary error:', error);
    return { totalVotes: 0, userVote: null, userVoteRevisionId: null, breakdown: {} as Record<string, number> };
  }

  const result = data as {
    total_votes: number;
    user_vote: string | null;
    user_vote_revision_id: string | null;
    breakdown: Record<string, number>;
  };

  return {
    totalVotes: result?.total_votes || 0,
    userVote: result?.user_vote || null,
    userVoteRevisionId: result?.user_vote_revision_id || null,
    breakdown: result?.breakdown || {},
  };
}
