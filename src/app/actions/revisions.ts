'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { toPublicRevisionText } from '@/utils/revision-presentation';

/**
 * Fetch full revision content and its immediate predecessor for diffing.
 */
export async function getRevisionDetails(revisionId: string) {
  const supabase = await createClient();
  
  // 1. Fetch current revision with flagging and author info
  const { data: revision, error: revError } = await supabase
    .from('revisions')
    .select(`
      id, report_content, tier1_content, author_id, created_at, node_id, commit_message,
      is_flagged, flag_reason, flagged_by,
      is_revert, is_reverted,
      profiles!revisions_author_id_fkey ( username, role )
    `)
    .eq('id', revisionId)
    .single();

  if (revError || !revision) return { error: 'Revision not found' };

  // 2. Fetch predecessor
  const { data: previous, error: prevError } = await supabase
    .from('revisions')
    .select('report_content, tier1_content, content_size')
    .eq('node_id', revision.node_id)
    .lt('created_at', revision.created_at)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    revision: {
      ...revision,
      report_content: toPublicRevisionText(revision.report_content),
      tier1_content: toPublicRevisionText(revision.tier1_content),
    },
    previous: previous
      ? {
          ...previous,
          report_content: toPublicRevisionText(previous.report_content),
          tier1_content: toPublicRevisionText(previous.tier1_content),
        }
      : null
  };
}

/**
 * Flag a revision as problematic. (L1+)
 */
export async function flagRevision(revisionId: string, reason: string, slug: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  if (!reason || reason.trim().length < 10) {
    return { error: 'A reason is required (minimum 10 characters)' };
  }

  const { data, error } = await supabase.rpc('resolve_revision_flag', {
    p_revision_id: revisionId,
    p_flag: true,
    p_flagger_id: user.id,
    p_reason: reason.trim()
  });

  if (error) return { error: error.message };
  
  revalidatePath(`/topic/${slug}/history`);
  return { success: true };
}

/**
 * Clear a flag from a revision (L3+ gated).
 */
export async function clearRevisionFlag(revisionId: string, slug: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Permission check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const CAN_RESOLVE = ['recognized', 'senior_scholar', 'steward', 'governance_council'];
  if (!profile || !CAN_RESOLVE.includes(profile.role)) {
    return { error: 'Insufficient permissions — Level 3+ required to clear flags' };
  }

  const { data, error } = await supabase.rpc('resolve_revision_flag', {
    p_revision_id: revisionId,
    p_flag: false
  });

  if (error) return { error: error.message };
  
  revalidatePath(`/topic/${slug}/history`);
  return { success: true };
}
