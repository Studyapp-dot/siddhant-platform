'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function getFormText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function buildStructuredCommitMessage(formData: FormData): string {
  const type = getFormText(formData, 'contribution_type');
  const summary = getFormText(formData, 'scholarly_summary');
  const legacyCommit = getFormText(formData, 'commit_message'); // fallback

  if (type && summary) {
    return `[${type}] ${summary}`;
  }
  
  if (legacyCommit) return legacyCommit;
  return 'Updated article content.';
}

export async function submitRevision(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const slug = getFormText(formData, 'slug');
  const node_id = getFormText(formData, 'node_id');
  const report_content = getFormText(formData, 'report_content');
  const commit = buildStructuredCommitMessage(formData);

  const content_size = report_content ? report_content.length : 0;

  const { data: insertedRevision, error } = await supabase.from('revisions').insert({
    node_id: node_id,
    author_id: user.id,
    report_content: report_content,
    commit_message: commit,
    content_size: content_size
  }).select('id').single();

  if (error) {
    throw new Error(error.message);
  }

  // Track this edit submission in the reputation system (inlined to avoid cross-server-action import)
  const { data: profile } = await supabase
    .from('profiles')
    .select('total_edits_count')
    .eq('id', user.id)
    .single();
  if (profile) {
    await supabase
      .from('profiles')
      .update({ total_edits_count: (profile.total_edits_count || 0) + 1 })
      .eq('id', user.id);
  }

  // Await metadata extraction before redirecting
  // This ensures Vercel's serverless function stays alive until extraction completes
  try {
    const { extractMetadata } = await import('@/utils/ai/extract-metadata')
    await extractMetadata(node_id)
  } catch (err) {
    // Extraction failure should not block the edit — log and continue
    console.error('[edit-node] AI re-extraction failed:', err)
  }

  if (insertedRevision?.id) {
    try {
      const { extractRevisionSemantics } = await import('@/utils/ai/extract-revision-semantics')
      await extractRevisionSemantics(insertedRevision.id)
    } catch (err) {
      console.error('[edit-node] Revision semantic extraction failed:', err)
    }
  }

  revalidatePath(`/topic/${slug}`, 'layout');
  redirect(`/topic/${slug}`);
}
