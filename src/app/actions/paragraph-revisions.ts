'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { computeVisibleTextSize } from '@/utils/content-size'

// ============================================================================
// PARAGRAPH REVISION ACTIONS — History and revert operations
// ============================================================================

export interface ParagraphRevision {
  id: string;
  paragraph_id: string;
  node_id: string;
  author_id: string;
  content: string;
  marginal_note: string | null;
  commit_message: string;
  revision_type: string;
  content_size: number | null;
  created_at: string;
}

export type RevisionResult = {
  success?: boolean;
  error?: string;
};

/**
 * Fetch all revisions for a paragraph, newest first.
 */
export async function getParagraphRevisions(paragraphId: string): Promise<ParagraphRevision[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('paragraph_revisions')
    .select('*')
    .eq('paragraph_id', paragraphId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getParagraphRevisions error:', error);
    return [];
  }

  return (data || []) as ParagraphRevision[];
}

/**
 * Revert a paragraph to a previous revision.
 * Creates a new 'revert' revision with the old content.
 */
export async function revertParagraph(
  paragraphId: string,
  revisionId: string,
  slug: string,
): Promise<RevisionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in.' };

  // Fetch the target revision
  const { data: revision, error: revErr } = await supabase
    .from('paragraph_revisions')
    .select('*')
    .eq('id', revisionId)
    .single();

  if (revErr || !revision) return { error: 'Revision not found.' };

  // Update paragraph to the old content
  const { error: updateErr } = await supabase
    .from('paragraphs')
    .update({
      content: revision.content,
      marginal_note: revision.marginal_note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paragraphId);

  if (updateErr) return { error: 'Failed to revert paragraph.' };

  // Create revert revision
  const { error: insertErr } = await supabase
    .from('paragraph_revisions')
    .insert({
      paragraph_id: paragraphId,
      node_id: revision.node_id,
      author_id: user.id,
      content: revision.content,
      marginal_note: revision.marginal_note,
      commit_message: `Reverted to revision from ${new Date(revision.created_at).toLocaleDateString('en-IN')}`,
      revision_type: 'revert',
      content_size: computeVisibleTextSize(revision.content),
    });

  if (insertErr) {
    console.error('revert revision insert error:', insertErr);
  }

  revalidatePath(`/topic/${slug}`);
  return { success: true };
}
