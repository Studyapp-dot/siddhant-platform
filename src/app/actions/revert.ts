'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// ============================================================================
// SIDDHANT: Revert System — Server Action
//
// One-click revert for Level 3+ users.
//
// Design principles (from user design review):
//   1. A revert creates a NEW revision (radical transparency — nothing deleted)
//   2. The revert revision is marked is_revert=true
//   3. The reverted revision is marked is_reverted=true
//   4. Reverts do NOT earn the reverter any reputation or edit counts
//   5. Reverted edits do NOT earn the original author reputation
//   6. Both are excluded from the 72h acceptance timer
//   7. Reverts are visually distinct in history (labeled as revert action)
//
// Why a new revision instead of deletion:
//   - Radical transparency: every action is permanently recorded
//   - Accountability: the community can see who reverted and why
//   - Reversibility: a revert can itself be reverted if mistaken
// ============================================================================

// Roles at Level 3 and above
const CAN_REVERT = ['recognized', 'senior_scholar', 'steward', 'governance_council'];

/**
 * Revert a revision by restoring the previous revision's content.
 * Creates a new revision marked as is_revert=true.
 *
 * @param revisionId - The ID of the revision to revert
 * @param reason - Why the revert is happening (required for accountability)
 * @param slug - The node slug (for revalidation)
 */
export async function revertRevision(
  revisionId: string,
  reason: string,
  slug: string,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'Not authenticated' };

  // Validate reason
  if (!reason || reason.trim().length < 10) {
    return { error: 'A reason is required (minimum 10 characters)' };
  }

  // Check user level
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !CAN_REVERT.includes(profile.role)) {
    return { error: 'Insufficient permissions — Level 3+ (Recognized Contributor) required to revert edits' };
  }

  // Fetch the revision being reverted
  const { data: targetRevision } = await supabase
    .from('revisions')
    .select('id, node_id, author_id, report_content, content_size, created_at, is_revert, is_reverted')
    .eq('id', revisionId)
    .single();

  if (!targetRevision) {
    return { error: 'Revision not found' };
  }

  // Don't allow reverting an already-reverted revision
  if (targetRevision.is_reverted) {
    return { error: 'This revision has already been reverted' };
  }

  // Find the revision BEFORE the target (what we're restoring to)
  const { data: previousRevisions } = await supabase
    .from('revisions')
    .select('id, report_content, content_size')
    .eq('node_id', targetRevision.node_id)
    .lt('created_at', targetRevision.created_at)
    .order('created_at', { ascending: false })
    .limit(1);

  const previousRevision = previousRevisions?.[0];

  // If there's no previous revision, the target was the first edit.
  // Reverting the first edit restores to empty content.
  const restoredContent = previousRevision?.report_content || '';
  const restoredSize = restoredContent.length;

  const commitMessage = `Revert: ${reason.trim()}`;

  // Use RPC (SECURITY DEFINER) to atomically:
  //   1. Mark the target revision as is_reverted = true
  //   2. Create the new revert revision as is_revert = true
  // Both are pre-marked acceptance_processed = true (excluded from 72h timer).
  //
  // This bypasses the missing UPDATE policy on the revisions table.
  // Without RPC, the direct .update() call was silently blocked by RLS,
  // which is why the REVERTED badge was never appearing.
  const { data: rpcResult, error: rpcError } = await supabase.rpc('execute_revert', {
    p_target_revision_id: revisionId,
    p_reverter_id: user.id,
    p_restored_content: restoredContent,
    p_restored_size: restoredSize,
    p_commit_message: commitMessage,
    p_node_id: targetRevision.node_id,
  });

  if (rpcError) {
    console.error('[revert] RPC execute_revert failed:', rpcError);
    return { error: 'Failed to execute revert — ' + rpcError.message };
  }

  // NOTE: We intentionally do NOT:
  //   - Increment total_edits_count for the reverter
  //   - Award any reputation to the reverter
  //   - Let this pass through the acceptance timer
  // The revert is an administrative action, not a contribution.

  revalidatePath(`/topic/${slug}`, 'layout');
  revalidatePath(`/topic/${slug}/history`);

  return { success: true };
}

/**
 * Restore the article to the state of a specific older revision.
 * Unlike revertRevision (which restores to BEFORE the target),
 * this restores to the TARGET's content — jumping back to that point.
 *
 * Use case: "Restore to this version" on an older revision when
 * multiple bad edits have been made since.
 */
export async function restoreToVersion(
  revisionId: string,
  reason: string,
  slug: string,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'Not authenticated' };

  if (!reason || reason.trim().length < 10) {
    return { error: 'A reason is required (minimum 10 characters)' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !CAN_REVERT.includes(profile.role)) {
    return { error: 'Insufficient permissions — Level 3+ required' };
  }

  // Fetch the target revision (the version we're restoring TO)
  const { data: targetRevision } = await supabase
    .from('revisions')
    .select('id, node_id, report_content, content_size')
    .eq('id', revisionId)
    .single();

  if (!targetRevision) {
    return { error: 'Revision not found' };
  }

  const restoredContent = targetRevision.report_content || '';
  const restoredSize = restoredContent.length;
  const commitMessage = `Restore: ${reason.trim()}`;

  // Create a new revision with the content from the target version
  // This is NOT a revert (doesn't mark any edit as reverted) — it's a restore.
  // Marked as is_revert=true so it doesn't earn reputation.
  const { error: insertError } = await supabase
    .from('revisions')
    .insert({
      node_id: targetRevision.node_id,
      author_id: user.id,
      report_content: restoredContent,
      content_size: restoredSize,
      commit_message: commitMessage,
      is_revert: true, // Administrative action, not a contribution
      acceptance_processed: true,
    });

  if (insertError) {
    console.error('[restore] Failed to create restore revision:', insertError);
    return { error: 'Failed to restore — ' + insertError.message };
  }

  revalidatePath(`/topic/${slug}`, 'layout');
  revalidatePath(`/topic/${slug}/history`);

  return { success: true };
}
