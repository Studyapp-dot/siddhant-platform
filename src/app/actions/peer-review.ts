'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { REVIEW_CONFIG, RUBRIC_VERSION } from '@/app/actions/peer-review-constants';
import type { ReviewableTier, Recommendation, Confidence, CriterionKey } from '@/app/actions/peer-review-constants';

// ============================================================================
// SIDDHANT: Peer Review — Server Actions
//
// Peer review applies ONLY to Good Article and Featured tiers.
// Good Article: 1 independent Recognized Contributor (L3+) reviewer
// Featured: 2 independent Senior Scholars (L4+) — consensus required
// ============================================================================

const ROLE_LEVELS: Record<string, number> = {
  reader: 1,
  contributor: 2,
  recognized: 3,
  senior_scholar: 4,
  steward: 5,
  governance_council: 6,
};

// --------------------------------------------------------------------------
// 1. Initiate a review cycle
// --------------------------------------------------------------------------
export async function initiateReviewCycle(
  nodeId: string,
  targetTier: ReviewableTier,
  slug?: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Validate target tier
  const config = REVIEW_CONFIG[targetTier];
  if (!config) return { error: 'Invalid target tier for peer review' };

  // Get the node's current tier
  const { data: node } = await supabase
    .from('nodes')
    .select('id, quality_tier')
    .eq('id', nodeId)
    .single();

  if (!node) return { error: 'Node not found' };

  // Node must be at the prerequisite tier
  if (node.quality_tier !== config.prerequisiteTier) {
    const prereqLabel = targetTier === 'good_article' ? 'Solid' : 'Good Article';
    return { error: `Node must be at "${prereqLabel}" tier to be nominated for ${config.label} review` };
  }

  // Get user's level
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) return { error: 'Profile not found' };
  const userLevel = ROLE_LEVELS[profile.role] || 1;

  // Level gate for nomination: L2+ for Good Article, L3+ for Featured
  const nominationLevel = targetTier === 'good_article' ? 2 : 3;
  if (userLevel < nominationLevel) {
    return { error: `Level ${nominationLevel}+ required to nominate for ${config.label} review` };
  }

  // Check no open or awaiting-conclusion cycle exists for this node
  const { data: existingCycle } = await supabase
    .from('review_cycles')
    .select('id, status')
    .eq('node_id', nodeId)
    .in('status', ['open', 'awaiting_conclusion'])
    .maybeSingle();

  if (existingCycle) {
    return { error: existingCycle.status === 'awaiting_conclusion'
      ? 'A review cycle for this node is awaiting formal conclusion by a Senior Scholar.'
      : 'A review cycle is already open for this node' };
  }

  // Snapshot the latest revision — this is what the reviewer will assess
  const { data: latestRevision } = await supabase
    .from('revisions')
    .select('id')
    .eq('node_id', nodeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Create the cycle
  const { data: cycle, error } = await supabase
    .from('review_cycles')
    .insert({
      node_id: nodeId,
      target_tier: targetTier,
      initiated_by: user.id,
      min_reviews: config.minReviews,
      snapshot_revision_id: latestRevision?.id || null,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  if (slug) revalidatePath(`/topic/${slug}`);
  return { success: true, cycleId: cycle.id };
}


// --------------------------------------------------------------------------
// 1b. Initiate a CHALLENGE cycle (re-review an existing tier)
// --------------------------------------------------------------------------
export async function initiateChallengeCycle(
  nodeId: string,
  challengedTier: ReviewableTier,
  slug?: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const config = REVIEW_CONFIG[challengedTier];
  if (!config) return { error: 'Invalid tier for challenge' };

  // Node must currently BE at the tier being challenged
  const { data: node } = await supabase
    .from('nodes')
    .select('id, quality_tier')
    .eq('id', nodeId)
    .single();

  if (!node) return { error: 'Node not found' };

  if (node.quality_tier !== challengedTier) {
    return { error: `Node is not currently at ${config.label} tier` };
  }

  // Level gate: same as reviewer level (L3+ for GA, L4+ for Featured)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) return { error: 'Profile not found' };
  const userLevel = ROLE_LEVELS[profile.role] || 1;

  if (userLevel < config.minReviewerLevel) {
    return { error: `Level ${config.minReviewerLevel}+ required to challenge ${config.label} status` };
  }

  // Check no open or awaiting-conclusion cycle exists
  const { data: existingCycle } = await supabase
    .from('review_cycles')
    .select('id, status')
    .eq('node_id', nodeId)
    .in('status', ['open', 'awaiting_conclusion'])
    .maybeSingle();

  if (existingCycle) {
    return { error: existingCycle.status === 'awaiting_conclusion'
      ? 'A review cycle for this node is awaiting formal conclusion by a Senior Scholar.'
      : 'A review cycle is already open for this node' };
  }

  // Snapshot the latest revision
  const { data: latestRevision } = await supabase
    .from('revisions')
    .select('id')
    .eq('node_id', nodeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Create the challenge cycle
  const { data: cycle, error } = await supabase
    .from('review_cycles')
    .insert({
      node_id: nodeId,
      target_tier: challengedTier,
      initiated_by: user.id,
      min_reviews: config.minReviews,
      cycle_type: 'challenge',
      snapshot_revision_id: latestRevision?.id || null,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  if (slug) revalidatePath(`/topic/${slug}`);
  return { success: true, cycleId: cycle.id };
}


// --------------------------------------------------------------------------
// 2. Submit a peer review
// --------------------------------------------------------------------------
export async function submitPeerReview(
  cycleId: string,
  criteriaScores: Record<CriterionKey, { score: number; comment?: string }>,
  recommendation: Recommendation,
  confidence: Confidence,
  overallComment: string,
  slug?: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Validate comment
  if (!overallComment || overallComment.trim().length < 20) {
    return { error: 'Overall comment must be at least 20 characters' };
  }

  // Get the cycle
  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('id, node_id, target_tier, status, min_reviews, initiated_by')
    .eq('id', cycleId)
    .single();

  if (!cycle) return { error: 'Review cycle not found' };
  if (cycle.status === 'awaiting_conclusion') return { error: 'This review cycle is no longer accepting reviews. It is awaiting formal conclusion by a Senior Scholar.' };
  if (cycle.status !== 'open') return { error: 'This review cycle is already closed' };

  const config = REVIEW_CONFIG[cycle.target_tier as ReviewableTier];
  if (!config) return { error: 'Invalid review cycle configuration' };

  // Get user's role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) return { error: 'Profile not found' };
  const userLevel = ROLE_LEVELS[profile.role] || 1;

  // Level gate for reviewing
  if (userLevel < config.minReviewerLevel) {
    const roleLabel = config.minReviewerLevel === 3 ? 'Recognized Contributor (L3+)' : 'Senior Scholar (L4+)';
    return { error: `Only ${roleLabel} can review for ${config.label} tier` };
  }

  // Independence check: reviewer must not have contributed to the node
  if (config.requiresIndependence) {
    const { count } = await supabase
      .from('revisions')
      .select('id', { count: 'exact', head: true })
      .eq('node_id', cycle.node_id)
      .eq('author_id', user.id);

    if (count && count > 0) {
      return { error: 'You cannot review a node you have contributed to. An independent reviewer is required.' };
    }
  }

  // Nominator cannot review their own cycle — prevents self-serving nominations
  if (cycle.initiated_by === user.id) {
    return { error: 'You cannot review a cycle you nominated. An independent reviewer is required.' };
  }

  // Validate criteria scores — all 6 must be present with score 1-5
  const criterionKeys = ['legal_accuracy', 'settled_vs_contested', 'citation_quality', 'completeness', 'clarity', 'currency'];
  for (const key of criterionKeys) {
    const entry = criteriaScores[key as CriterionKey];
    if (!entry || typeof entry.score !== 'number' || entry.score < 1 || entry.score > 5) {
      return { error: `Invalid score for criterion: ${key}. Must be 1-5.` };
    }
  }

  // Fetch the latest revision ID so we record what the reviewer is looking at
  const { data: currentRevision } = await supabase
    .from('revisions')
    .select('id')
    .eq('node_id', cycle.node_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Submit via RPC
  const { data, error } = await supabase.rpc('submit_peer_review', {
    p_cycle_id: cycleId,
    p_node_id: cycle.node_id,
    p_reviewer_id: user.id,
    p_recommendation: recommendation,
    p_confidence: confidence,
    p_overall_comment: overallComment.trim(),
    p_criteria_scores: criteriaScores,
    p_rubric_version: RUBRIC_VERSION,
    p_reviewed_revision_id: currentRevision?.id || null,
  });

  if (error) return { error: error.message };

  const result = data as { success: boolean; error?: string; review_count?: number; min_reviews?: number };
  if (!result?.success) return { error: result?.error || 'Failed to submit review' };

  // Check if we should transition to awaiting_conclusion
  // Review cycles are no longer auto-closed. A neutral Senior Scholar (L4+) must
  // formally conclude the cycle — matching the research principle that advancement
  // requires a named human who takes accountability for the decision.
  const reviewCount = result.review_count || 0;
  const minReviews = result.min_reviews || config.minReviews;

  if (reviewCount >= minReviews) {
    // For Good Article with low confidence, keep open for second reviewer
    if (cycle.target_tier === 'good_article' && confidence === 'low' && reviewCount === 1) {
      // Don't transition — wait for second reviewer
    } else {
      // Transition to awaiting_conclusion — a Senior Scholar must now conclude
      await supabase
        .from('review_cycles')
        .update({ status: 'awaiting_conclusion' })
        .eq('id', cycleId);
    }
  }

  if (slug) revalidatePath(`/topic/${slug}`);
  return { success: true };
}


// --------------------------------------------------------------------------
// 3. Conclude a review cycle — Senior Scholar (L4+) formal sign-off
//
// The concluder must:
//   - Be Level 4+ (Senior Scholar, Steward, or Governance Council)
//   - NOT have submitted a review in this cycle (neutrality)
//   - NOT have contributed content to the node (independence)
//   - Provide a qualitative consensus summary (50+ characters)
//
// This mirrors the "Close Discussion" principle from the research:
//   "the person who closes must not have participated"
// --------------------------------------------------------------------------
export async function concludeReviewCycle(
  cycleId: string,
  consensusSummary: string,
  slug?: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Validate consensus summary
  if (!consensusSummary || consensusSummary.trim().length < 50) {
    return { error: 'Consensus summary must be at least 50 characters. Explain what the reviewers found and why the outcome is justified.' };
  }

  // Get cycle
  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('id, node_id, target_tier, status, initiated_by')
    .eq('id', cycleId)
    .single();

  if (!cycle) return { error: 'Review cycle not found' };
  if (cycle.status !== 'awaiting_conclusion') {
    return { error: 'This cycle is not ready for conclusion. It must have received the required number of reviews first.' };
  }

  // Level gate: L4+ only
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) return { error: 'Profile not found' };
  const userLevel = ROLE_LEVELS[profile.role] || 1;

  if (userLevel < 4) {
    return { error: 'Only Senior Scholars (Level 4+) can conclude review cycles.' };
  }

  // Neutrality check: concluder must not have reviewed in this cycle
  const { count: reviewCount } = await supabase
    .from('peer_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('cycle_id', cycleId)
    .eq('reviewer_id', user.id);

  if (reviewCount && reviewCount > 0) {
    return { error: 'You cannot conclude a cycle you reviewed. A neutral Senior Scholar is required.' };
  }

  // Independence check: concluder must not have contributed to the node
  const { count: contributionCount } = await supabase
    .from('revisions')
    .select('id', { count: 'exact', head: true })
    .eq('node_id', cycle.node_id)
    .eq('author_id', user.id);

  if (contributionCount && contributionCount > 0) {
    return { error: 'You cannot conclude a cycle for a node you contributed to. An independent Senior Scholar is required.' };
  }

  // Execute the close via RPC (handles consensus calculation, tier change, rep awards)
  const { data, error } = await supabase.rpc('close_review_cycle', {
    p_cycle_id: cycleId,
  });

  if (error) {
    console.error('[peer-review] conclude cycle error:', error);
    return { error: error.message };
  }

  const result = data as { success: boolean; outcome?: string; result_summary?: string; error?: string };
  if (!result?.success) {
    console.error('[peer-review] conclude cycle failed:', result?.error);
    return { error: result?.error || 'Failed to conclude review cycle' };
  }

  // Record who concluded and their consensus summary
  await supabase
    .from('review_cycles')
    .update({
      concluded_by: user.id,
      consensus_summary: consensusSummary.trim(),
    })
    .eq('id', cycleId);

  if (slug) revalidatePath(`/topic/${slug}`);
  return { success: true, outcome: result.outcome, summary: result.result_summary };
}


// --------------------------------------------------------------------------
// 4. Get review cycles for a node
// --------------------------------------------------------------------------
export async function getReviewCycles(nodeId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('review_cycles')
    .select(`
      id, node_id, target_tier, status, outcome, min_reviews, cycle_type,
      result_summary, snapshot_revision_id, created_at, closed_at,
      initiated_by, concluded_by, consensus_summary,
      profiles!review_cycles_initiated_by_fkey ( username, role )
    `)
    .eq('node_id', nodeId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('[peer-review] get cycles error:', error);
    return [];
  }

  // For each cycle, get the review count
  const cyclesWithCounts = await Promise.all(
    (data || []).map(async (cycle: any) => {
      const { count } = await supabase
        .from('peer_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('cycle_id', cycle.id);

      return { ...cycle, review_count: count || 0 };
    })
  );

  return cyclesWithCounts;
}


// --------------------------------------------------------------------------
// 5. Get review details for a cycle (anchoring-safe)
// --------------------------------------------------------------------------
export async function getReviewDetails(cycleId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('id, status, outcome, target_tier, result_summary')
    .eq('id', cycleId)
    .single();

  if (!cycle) return { cycle: null, reviews: [] };

  // RLS handles visibility: open cycles only show the current user's review
  // Closed cycles show all reviews
  const { data: reviews, error } = await supabase
    .from('peer_reviews')
    .select(`
      id, recommendation, confidence, overall_comment,
      criteria_scores, rubric_version, aligned_with_outcome, created_at,
      profiles!peer_reviews_reviewer_id_fkey ( username, role )
    `)
    .eq('cycle_id', cycleId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[peer-review] get review details error:', error);
  }

  return {
    cycle,
    reviews: reviews || [],
    currentUserId: user?.id || null,
  };
}
