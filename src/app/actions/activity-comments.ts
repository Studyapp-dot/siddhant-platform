'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// ============================================================================
// SIDDHANT: Activity Comments — Server Actions
//
// Lightweight comment threads on any feed item:
//   - Revisions (edits)
//   - Scholar Stars
//   - Quality Votes
//   - Quality Assessments (tier promotions)
//   - Endorsements
//   - Discussion Citations
//
// Uses the post_activity_comment RPC (SECURITY DEFINER) for safe insertion.
// Rate-limited to 20 comments per hour per user (enforced in SQL).
// ============================================================================

export type ActivityCommentTargetType =
  | 'revision'
  | 'scholar_star'
  | 'quality_vote'
  | 'quality_assessment'
  | 'endorsement'
  | 'discussion_citation'
  | 'group_post'
  | 'mentorship_started';

export interface ActivityComment {
  id: string;
  target_type: ActivityCommentTargetType;
  target_id: string;
  author_id: string;
  content: string;
  created_at: string;
  // Joined profile data
  profiles?: {
    username: string;
    role: string;
    reputation_score: number;
  };
}


/**
 * Post a comment on a feed activity item.
 * 
 * @param targetType - The type of activity being commented on
 * @param targetId - The UUID of the target item
 * @param content - Comment text (3-2000 chars)
 * @param revalidateSlug - Optional node slug to revalidate after posting
 */
export async function postActivityComment(
  targetType: ActivityCommentTargetType,
  targetId: string,
  content: string,
  revalidateSlug?: string,
): Promise<{ success: boolean; error?: string; commentId?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Client-side validation (SQL also validates)
  const trimmed = content.trim();
  if (trimmed.length < 3) {
    return { success: false, error: 'Comment must be at least 3 characters' };
  }
  if (trimmed.length > 2000) {
    return { success: false, error: 'Comment must be under 2000 characters' };
  }

  try {
    const { data, error } = await supabase.rpc('post_activity_comment', {
      p_author_id: user.id,
      p_target_type: targetType,
      p_target_id: targetId,
      p_content: trimmed,
    });

    if (error) {
      console.error('[activity-comments] RPC error:', error);
      return { success: false, error: error.message };
    }

    if (data && !data.success) {
      return { success: false, error: data.error };
    }

    // Revalidate paths
    revalidatePath('/recognition');
    if (revalidateSlug) {
      revalidatePath(`/topic/${revalidateSlug}`);
      revalidatePath(`/topic/${revalidateSlug}/history`);
    }

    return { success: true, commentId: data?.comment_id };
  } catch (err: any) {
    console.error('[activity-comments] Unexpected error:', err);
    return { success: false, error: 'Failed to post comment' };
  }
}


/**
 * Fetch comments for a specific feed item.
 * Returns comments with author profile data, newest first.
 * 
 * @param targetType - The type of activity
 * @param targetId - The UUID of the target item
 * @param limit - Max comments to return (default 10)
 */
export async function getActivityComments(
  targetType: ActivityCommentTargetType,
  targetId: string,
  limit: number = 10,
): Promise<{ comments: ActivityComment[]; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('activity_comments')
    .select(`
      id, target_type, target_id, author_id, content, created_at,
      profiles!activity_comments_author_id_fkey (
        username, role, reputation_score
      )
    `)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[activity-comments] Fetch error:', error);
    return { comments: [], error: error.message };
  }

  return { comments: (data || []) as unknown as ActivityComment[] };
}


/**
 * Get the total comment count for a specific feed item.
 * Used for showing "3 comments" badges on feed cards.
 */
export async function getActivityCommentCount(
  targetType: ActivityCommentTargetType,
  targetId: string,
): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from('activity_comments')
    .select('id', { count: 'exact', head: true })
    .eq('target_type', targetType)
    .eq('target_id', targetId);

  if (error) {
    console.error('[activity-comments] Count error:', error);
    return 0;
  }

  return count ?? 0;
}


/**
 * Batch-fetch comment counts for multiple feed items.
 * Useful for the feed page to show comment badges on all cards at once.
 * 
 * @param items - Array of { targetType, targetId } pairs
 * @returns Map of "targetType:targetId" → count
 */
export async function batchGetCommentCounts(
  items: { targetType: ActivityCommentTargetType; targetId: string }[]
): Promise<Record<string, number>> {
  if (items.length === 0) return {};

  const supabase = await createClient();
  const counts: Record<string, number> = {};

  // Group by target_type for efficient querying
  const grouped: Record<string, string[]> = {};
  for (const item of items) {
    if (!grouped[item.targetType]) grouped[item.targetType] = [];
    grouped[item.targetType].push(item.targetId);
  }

  for (const [type, ids] of Object.entries(grouped)) {
    const { data, error } = await supabase
      .from('activity_comments')
      .select('target_id')
      .eq('target_type', type)
      .in('target_id', ids);

    if (error) {
      console.error('[activity-comments] Batch count error:', error);
      continue;
    }

    // Count occurrences per target_id
    for (const row of data || []) {
      const key = `${type}:${row.target_id}`;
      counts[key] = (counts[key] || 0) + 1;
    }
  }

  return counts;
}


/**
 * Delete a comment (own comments only — enforced by RLS).
 */
export async function deleteActivityComment(
  commentId: string,
  revalidateSlug?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('activity_comments')
    .delete()
    .eq('id', commentId)
    .eq('author_id', user.id); // Extra safety — RLS also enforces this

  if (error) {
    console.error('[activity-comments] Delete error:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/recognition');
  if (revalidateSlug) {
    revalidatePath(`/topic/${revalidateSlug}`);
  }

  return { success: true };
}
