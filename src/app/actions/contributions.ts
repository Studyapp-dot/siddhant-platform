'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { awardReputation } from '@/app/actions/reputation';
import {
  REPUTATION_POINTS,
  ROLE_LABELS,
  GIVER_LEVEL_MULTIPLIERS,
  SCHOLAR_STAR_CATEGORIES,
  ScholarStarCategory,
} from '@/app/actions/reputation-constants';

// ============================================================================
// SIDDHANT: Community Recognition — Server Actions
//
// Three tiers of peer recognition:
//   👏 Acknowledge (+1 base)  — Quick professional nod. "I see your work."
//   💡 Insightful  (+10 base) — "This deepened my understanding of the law."
//   ⭐ Scholar Star (+15 base) — The pinnacle — categorized, rare, meaningful.
//
// Anti-farming protections:
//   - Self-recognition blocked at every level
//   - Toggle-off does NOT re-award on toggle-on (dedup via reputation_events)
//   - Scholar Stars: rate-limited (1 per giver→recipient per 30 days)
//   - Insightful & Scholar Star: L2+ (Contributor) minimum to give
//   - Weighted endorsements: giver level × diminishing returns for repeat pairs
//   - All recognition is auditable via reputation_events table
// ============================================================================


/**
 * Calculate weighted reputation points using the endorsement weight formula:
 *   effective_points = base_points × giver_level_multiplier × (1 / repeat_count)
 *
 * Where:
 *   - giver_level_multiplier: scales with the giver's platform level (L1=0.5 → L5=2.5)
 *   - repeat_count: how many times this giver has recognized this specific recipient
 *     (across all revisions/sources), applying diminishing returns to repeat pairs
 *
 * This implements the audit's recommendation adapted from X's Community Notes:
 * "Not all raters are equal" + "Diminishing returns for repeated agreement."
 */
async function calculateWeightedPoints(
  supabase: any,
  giverId: string,
  giverRole: string,
  recipientId: string,
  basePoints: number,
  recognitionType: 'acknowledge' | 'insightful' | 'scholar_star',
): Promise<number> {
  // Giver level multiplier
  const giverLevel = ROLE_LABELS[giverRole]?.level || 1;
  const levelMultiplier = GIVER_LEVEL_MULTIPLIERS[giverLevel] || 0.5;

  // Count repeat recognitions from this giver to this recipient
  let repeatCount = 1;

  if (recognitionType === 'acknowledge' || recognitionType === 'insightful') {
    // Count existing recognitions of this type for revisions authored by the recipient
    const { data: recipientRevisions } = await supabase
      .from('revisions')
      .select('id')
      .eq('author_id', recipientId);

    const revisionIds = (recipientRevisions || []).map((r: any) => r.id);

    if (revisionIds.length > 0) {
      const table = recognitionType === 'acknowledge' ? 'contribution_votes' : 'endorsements';
      const userCol = recognitionType === 'acknowledge' ? 'user_id' : 'endorser_id';

      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq(userCol, giverId)
        .in('revision_id', revisionIds);

      repeatCount = Math.max(1, count || 1);
    }
  } else if (recognitionType === 'scholar_star') {
    const { count } = await supabase
      .from('scholar_stars')
      .select('*', { count: 'exact', head: true })
      .eq('giver_id', giverId)
      .eq('recipient_id', recipientId);

    repeatCount = Math.max(1, count || 1);
  }

  return Math.max(1, Math.round(basePoints * levelMultiplier * (1 / repeatCount)));
}


/**
 * Toggle an Acknowledgment on a revision.
 * +1 base reputation to the revision author — weighted by giver level & diminishing returns.
 * Awarded ONCE per user per revision (dedup via reputation_events).
 */
export async function toggleAcknowledge(revisionId: string, slug: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  let awardedPoints = 0;

  // Check if already acknowledged
  const { data: existing } = await supabase
    .from('contribution_votes')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('revision_id', revisionId)
    .maybeSingle();

  if (existing) {
    // Remove the acknowledgment
    await supabase
      .from('contribution_votes')
      .delete()
      .eq('user_id', user.id)
      .eq('revision_id', revisionId);

    revalidatePath(`/topic/${slug}/history`);
    return { action: 'removed' };
  }

  // Prevent self-acknowledgment
  const { data: revision } = await supabase
    .from('revisions')
    .select('author_id')
    .eq('id', revisionId)
    .single();

  if (revision?.author_id === user.id) {
    return { error: 'Cannot acknowledge your own contribution' };
  }

  // Add the acknowledgment
  const { error } = await supabase
    .from('contribution_votes')
    .insert({ user_id: user.id, revision_id: revisionId });

  if (error) return { error: error.message };

  // Award weighted reputation to the revision author — but ONLY if not already awarded
  // This prevents the toggle-on/off exploit
  if (revision?.author_id) {
    // Dedup check: has this exact user already generated an upvote_received event for this revision?
    const { count: existingAward } = await supabase
      .from('reputation_events')
      .select('id', { count: 'exact', head: true })
      .eq('source_id', revisionId)
      .eq('source_type', 'revision')
      .eq('event_type', 'upvote_received')
      .eq('description', `Acknowledgment from ${user.id}`);

    if (!existingAward || existingAward === 0) {
      try {
        // Fetch giver's role for weighted calculation
        const { data: giverProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        const weightedPoints = await calculateWeightedPoints(
          supabase, user.id, giverProfile?.role || 'reader',
          revision.author_id, REPUTATION_POINTS.upvote_received, 'acknowledge'
        );

        const awardResult = await awardReputation(
          revision.author_id,
          'upvote_received',
          revisionId,
          'revision',
          `Acknowledgment from ${user.id}`,
          weightedPoints,
        );
        if (awardResult.success) awardedPoints = awardResult.points ?? 0;
      } catch (err) {
        console.error('[contributions] Failed to award acknowledge reputation:', err);
      }
    }
  }

  revalidatePath(`/topic/${slug}/history`);
  revalidatePath('/recognition');
  return { action: 'added', awardedPoints, awardedTo: 'author' as const };
}


/**
 * Toggle an "Insightful" endorsement on a revision.
 * +10 base reputation to the revision author — weighted by giver level & diminishing returns.
 * Awarded ONCE per user per revision (dedup via reputation_events).
 * Requires Level 2+ (Contributor) to give — you must have contributed to judge insight.
 */
export async function toggleInsightful(revisionId: string, slug: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  let awardedPoints = 0;

  // Level gate: L2+ required to give Insightful endorsements
  const { data: giverProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const giverLevel = ROLE_LABELS[giverProfile?.role]?.level || 1;
  if (giverLevel < 2) {
    return { error: 'You must be at least a Contributor (Level 2) to mark contributions as Insightful. Start by contributing edits to build your platform experience.' };
  }

  // Check if already endorsed
  const { data: existing } = await supabase
    .from('endorsements')
    .select('id')
    .eq('endorser_id', user.id)
    .eq('revision_id', revisionId)
    .maybeSingle();

  if (existing) {
    // Remove the endorsement
    await supabase
      .from('endorsements')
      .delete()
      .eq('endorser_id', user.id)
      .eq('revision_id', revisionId);

    const { data: revision } = await supabase
      .from('revisions')
      .select('author_id')
      .eq('id', revisionId)
      .single();

    if (revision?.author_id) {
      const { data: recipientProfile } = await supabase
        .from('profiles')
        .select('endorsements_received')
        .eq('id', revision.author_id)
        .single();

      if ((recipientProfile?.endorsements_received || 0) > 0) {
        await supabase.rpc('increment_profile_counter', {
          p_user_id: revision.author_id,
          p_column_name: 'endorsements_received',
          p_amount: -1,
        });
      }
    }

    revalidatePath(`/topic/${slug}/history`);
    revalidatePath('/recognition');
    return { action: 'removed' };
  }

  // Prevent self-endorsement
  const { data: revision } = await supabase
    .from('revisions')
    .select('author_id')
    .eq('id', revisionId)
    .single();

  if (revision?.author_id === user.id) {
    return { error: 'Cannot endorse your own contribution' };
  }

  // Add the endorsement
  const { error } = await supabase
    .from('endorsements')
    .insert({ revision_id: revisionId, endorser_id: user.id });

  if (error) return { error: error.message };

  // Award weighted reputation — but ONLY if not already awarded for this user+revision
  if (revision?.author_id) {
    const { count: existingAward } = await supabase
      .from('reputation_events')
      .select('id', { count: 'exact', head: true })
      .eq('source_id', revisionId)
      .eq('source_type', 'revision')
      .eq('event_type', 'endorsement_received')
      .eq('description', `Insightful endorsement from ${user.id}`);

    if (!existingAward || existingAward === 0) {
      try {
        const weightedPoints = await calculateWeightedPoints(
          supabase, user.id, giverProfile?.role || 'reader',
          revision.author_id, REPUTATION_POINTS.endorsement_received, 'insightful'
        );

        const awardResult = await awardReputation(
          revision.author_id,
          'endorsement_received',
          revisionId,
          'revision',
          `Insightful endorsement from ${user.id}`,
          weightedPoints,
        );
        if (awardResult.success) awardedPoints = awardResult.points ?? 0;

        // Increment endorsements_received counter via RPC
        await supabase.rpc('increment_profile_counter', {
          p_user_id: revision.author_id,
          p_column_name: 'endorsements_received',
          p_amount: 1,
        });
      } catch (err) {
        console.error('[contributions] Failed to award insightful reputation:', err);
      }
    }
  }

  revalidatePath(`/topic/${slug}/history`);
  revalidatePath('/recognition');
  return { action: 'added', awardedPoints, awardedTo: 'author' as const };
}


/**
 * Award a Scholar Star to another contributor.
 * +15 base reputation — the highest single-action value, weighted by giver level & diminishing returns.
 *
 * Anti-farming protections:
 *   - Requires Level 2+ (Contributor) to give
 *   - Requires a written reason (50+ characters, non-negotiable)
 *   - Rate-limited: 1 star per giver → recipient per 30 days
 *   - Self-award blocked
 *   - Must select a specific category (not generic)
 *   - Weighted by giver level and diminishing returns for repeat pairs
 */
export async function awardScholarStar(
  recipientId: string,
  reason: string,
  category: ScholarStarCategory,
  sourceId?: string,
  sourceType?: 'revision' | 'discussion' | 'peer_review' | 'mentoring' | 'other',
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Validate category
  if (!SCHOLAR_STAR_CATEGORIES[category]) {
    return { error: 'Please select a valid Scholar Star category.' };
  }

  // Validate reason is meaningful (raised from 20 to 50)
  if (!reason || reason.trim().length < 50) {
    return { error: 'Please provide a meaningful written reason (at least 50 characters). Explain exactly what made this contribution exceptional.' };
  }

  // Prevent self-award
  if (recipientId === user.id) {
    return { error: 'Cannot award a Scholar Star to yourself' };
  }

  // Level gate: L2+ required to award Scholar Stars
  const { data: giverProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const giverLevel = ROLE_LABELS[giverProfile?.role]?.level || 1;
  if (giverLevel < 2) {
    return { error: 'You must be at least a Contributor (Level 2) to award Scholar Stars. Start by contributing edits to build your platform experience.' };
  }

  // Rate limit: check if this giver already gave a star to this recipient in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { count: recentStars } = await supabase
    .from('scholar_stars')
    .select('id', { count: 'exact', head: true })
    .eq('giver_id', user.id)
    .eq('recipient_id', recipientId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (recentStars && recentStars > 0) {
    return { error: 'You can only award one Scholar Star per person every 30 days. This ensures each star carries real weight.' };
  }

  const categoryInfo = SCHOLAR_STAR_CATEGORIES[category];

  // Insert the star
  const { error } = await supabase
    .from('scholar_stars')
    .insert({
      recipient_id: recipientId,
      giver_id: user.id,
      reason: reason.trim(),
      source_id: sourceId || null,
      source_type: sourceType || null,
      category: category,  // Structured storage (evidence_feed_migration.sql)
    });

  if (error) return { error: error.message };

  // Award weighted reputation to recipient
  try {
    const weightedPoints = await calculateWeightedPoints(
      supabase, user.id, giverProfile?.role || 'reader',
      recipientId, REPUTATION_POINTS.scholar_star_received, 'scholar_star'
    );

    await awardReputation(
      recipientId,
      'scholar_star_received',
      sourceId,
      sourceType || 'scholar_star',
      `${categoryInfo.icon} ${categoryInfo.label}: "${reason.trim().substring(0, 100)}..."`,
      weightedPoints,
    );

    // Increment star count via RPC
    await supabase.rpc('increment_profile_counter', {
      p_user_id: recipientId,
      p_column_name: 'scholar_stars_received',
      p_amount: 1,
    });
  } catch (err) {
    console.error('[contributions] Failed to award star reputation:', err);
  }

  return { success: true };
}

/**
 * Unified Recognition Action for the Spotlight Review Drawer.
 * Handles Acknowledge or Insightful endorsements, awards weighted reputation,
 * and optionally posts a professional comment to the Discussion board.
 * Insightful requires Level 2+ (Contributor).
 */
export async function submitRecognition(
  revisionId: string,
  slug: string,
  type: 'acknowledge' | 'insightful',
  comment?: string,
  postToDiscussion: boolean = true
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // 1. Fetch revision & node context
  const { data: revision } = await supabase
    .from('revisions')
    .select('author_id, node_id, commit_message')
    .eq('id', revisionId)
    .single();

  if (!revision) return { error: 'Revision not found' };
  if (revision.author_id === user.id) return { error: 'Cannot recognize your own work' };

  const nodeId = revision.node_id;

  // 2. Fetch giver's profile for level gate + weighting
  const { data: giverProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const giverRole = giverProfile?.role || 'reader';

  // Level gate for Insightful
  if (type === 'insightful') {
    const giverLevel = ROLE_LABELS[giverRole]?.level || 1;
    if (giverLevel < 2) {
      return { error: 'You must be at least a Contributor (Level 2) to mark contributions as Insightful.' };
    }
  }

  // 3. Perform the recognition logic (similar to toggle but unified)
  if (type === 'acknowledge') {
    // Check if already acknowledged
    const { data: existing } = await supabase
      .from('contribution_votes')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('revision_id', revisionId)
      .maybeSingle();

    if (!existing) {
      await supabase.from('contribution_votes').insert({ user_id: user.id, revision_id: revisionId });
      
      // Award weighted reputation (+1 base)
      const { count: existingAward } = await supabase
        .from('reputation_events')
        .select('id', { count: 'exact', head: true })
        .eq('source_id', revisionId)
        .eq('source_type', 'revision')
        .eq('event_type', 'upvote_received')
        .eq('description', `Acknowledgment from ${user.id}`);

      if (!existingAward) {
        const weightedPoints = await calculateWeightedPoints(
          supabase, user.id, giverRole, revision.author_id,
          REPUTATION_POINTS.upvote_received, 'acknowledge'
        );
        await awardReputation(revision.author_id, 'upvote_received', revisionId, 'revision', `Acknowledgment from ${user.id}`, weightedPoints);
      }
    }
  } else if (type === 'insightful') {
    // Check if already endorsed
    const { data: existing } = await supabase
      .from('endorsements')
      .select('id')
      .eq('endorser_id', user.id)
      .eq('revision_id', revisionId)
      .maybeSingle();

    if (!existing) {
      await supabase.from('endorsements').insert({ revision_id: revisionId, endorser_id: user.id });

      // Award weighted reputation (+10 base)
      const { count: existingAward } = await supabase
        .from('reputation_events')
        .select('id', { count: 'exact', head: true })
        .eq('source_id', revisionId)
        .eq('source_type', 'revision')
        .eq('event_type', 'endorsement_received')
        .eq('description', `Insightful endorsement from ${user.id}`);

      if (!existingAward) {
        const weightedPoints = await calculateWeightedPoints(
          supabase, user.id, giverRole, revision.author_id,
          REPUTATION_POINTS.endorsement_received, 'insightful'
        );
        await awardReputation(revision.author_id, 'endorsement_received', revisionId, 'revision', `Insightful endorsement from ${user.id}`, weightedPoints);
        await supabase.rpc('increment_profile_counter', {
          p_user_id: revision.author_id,
          p_column_name: 'endorsements_received',
          p_amount: 1,
        });
      }
    }
  }

  // 4. Discussion/Social Integration
  if (postToDiscussion && comment && comment.trim().length > 0) {
    const icon = type === 'acknowledge' ? '👏' : '💡';
    const typeLabel = type === 'acknowledge' ? 'acknowledged' : 'marked as insightful';
    
    // Construct a rich social post
    const postContent = `${icon} **Professional Recognition**\n\nI ${typeLabel} this contribution: *"${revision.commit_message}"*\n\n> "${comment.trim()}"\n\n[View Revision Details](/topic/${slug}/compare?rev=${revisionId})`;

    await supabase.from('discussions').insert({
      node_id: nodeId,
      author_id: user.id,
      content: postContent,
      // Metadata/tags could be added here if the schema supported it
    });
  }

  revalidatePath(`/topic/${slug}`);
  revalidatePath(`/topic/${slug}/discussion`);
  revalidatePath(`/topic/${slug}/history`);
  revalidatePath('/recognition');
  return { success: true };
}
