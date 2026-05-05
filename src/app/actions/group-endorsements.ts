'use server';

import { createClient } from '@/utils/supabase/server';
import { awardReputation } from '@/app/actions/reputation';
import { createNotification } from '@/app/actions/notifications';

// ============================================================================
// SIDDHANT: Group Discussion Endorsement — Server Actions (Phase 2)
//
// Provides Endorse (toggle) functionality for group forum posts.
// Mirrors the revision-level endorsement system but operates on
// group_discussions via group_discussion_votes.
//
// Anti-farming:
//   - Cannot endorse your own posts
//   - Reputation awarded only once per post (on first vote)
//   - Uses same weighted calculation as main endorsement system
// ============================================================================


/**
 * Toggle endorsement on a group discussion post.
 * If already endorsed, removes the endorsement.
 * If not endorsed, adds the endorsement + awards reputation.
 */
export async function toggleGroupEndorsement(discussionId: string, groupSlug: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Fetch the discussion to check authorship
  const { data: discussion } = await supabase
    .from('group_discussions')
    .select('id, author_id, group_id')
    .eq('id', discussionId)
    .single();

  if (!discussion) {
    return { success: false, error: 'Discussion not found' };
  }

  // Cannot endorse your own posts
  if (discussion.author_id === user.id) {
    return { success: false, error: 'You cannot endorse your own post' };
  }

  // Check if already endorsed
  const { data: existing } = await supabase
    .from('group_discussion_votes')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('discussion_id', discussionId)
    .maybeSingle();

  if (existing) {
    // Remove endorsement
    const { error } = await supabase
      .from('group_discussion_votes')
      .delete()
      .eq('user_id', user.id)
      .eq('discussion_id', discussionId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, action: 'removed' };
  }

  // Add endorsement
  const { error } = await supabase
    .from('group_discussion_votes')
    .insert({
      user_id: user.id,
      discussion_id: discussionId,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  // Award reputation to the post author (3 points for group endorsement)
  try {
    await awardReputation(
      discussion.author_id,
      'group_endorsement_received',
      discussionId,
      'group_discussion',
      `Forum post endorsed in ${groupSlug}`,
    );

    // Notify the post author
    const { data: endorserProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();

    await createNotification(
      discussion.author_id,
      'group_reply',  // reusing reply type for lightweight endorsement notice
      `@${endorserProfile?.username || 'Someone'} endorsed your forum post`,
      'Your contribution was recognized by a peer.',
      `/groups/${groupSlug}`,
      discussionId,
      'group_discussion',
    );
  } catch (err) {
    console.error('[group-endorsements] Failed to award reputation:', err);
  }

  return { success: true, action: 'added' };
}


/**
 * Fetch endorsement counts and user's vote state for a batch of discussion IDs.
 * Used by the server component to hydrate the DiscussionEngine with vote data.
 */
export async function getGroupEndorsementData(discussionIds: string[], userId?: string) {
  if (discussionIds.length === 0) return {};

  const supabase = await createClient();

  // Fetch all votes for these discussions
  const { data: allVotes } = await supabase
    .from('group_discussion_votes')
    .select('discussion_id, user_id')
    .in('discussion_id', discussionIds);

  // Build vote counts and user-voted state
  const result: Record<string, { count: number; userVoted: boolean }> = {};

  for (const id of discussionIds) {
    result[id] = { count: 0, userVoted: false };
  }

  for (const vote of (allVotes || [])) {
    if (!result[vote.discussion_id]) {
      result[vote.discussion_id] = { count: 0, userVoted: false };
    }
    result[vote.discussion_id].count++;
    if (userId && vote.user_id === userId) {
      result[vote.discussion_id].userVoted = true;
    }
  }

  return result;
}
