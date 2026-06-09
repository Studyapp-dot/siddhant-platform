'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { computeVisibleTextSize, normalizeForComparison } from '@/utils/content-size'
import { hasReferenceTargetChanges } from '@/utils/revision-presentation'

export interface Paragraph {
  id: string;
  node_id: string;
  stable_id: string;
  display_number: number;
  marginal_note: string | null;
  content: string;
  group_label: string | null;
  order_index: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type ParagraphResult = {
  success?: boolean;
  error?: string;
  paragraphId?: string;
};

export interface ParagraphAuthorityInput {
  anchor_text: string;
  context_before?: string;
  context_after?: string;
  paragraph_index?: number;
  authority_type: string;
  authority_title: string;
  authority_citation?: string | null;
  authority_url?: string | null;
  authority_node_id?: string | null;
  source_tier?: string | null;
}

const MIN_DELTA = 5;

export async function getParagraphs(nodeId: string): Promise<Paragraph[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('paragraphs')
    .select('*')
    .eq('node_id', nodeId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true });

  if (error) {
    console.error('getParagraphs error:', error);
    return [];
  }
  return (data || []) as Paragraph[];
}

export async function resolveStableId(nodeId: string, stableId: string): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('paragraphs')
    .select('display_number')
    .eq('node_id', nodeId)
    .eq('stable_id', stableId)
    .is('deleted_at', null)
    .single();

  if (error || !data) return null;
  return data.display_number;
}

function generateStableId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'p_';
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function sanitizeAuthorityAnchors(anchors: ParagraphAuthorityInput[] = []) {
  return anchors
    .map(anchor => ({
      anchor_text: (anchor.anchor_text || '').trim(),
      context_before: (anchor.context_before || '').trim(),
      context_after: (anchor.context_after || '').trim(),
      paragraph_index: Number.isFinite(anchor.paragraph_index) ? anchor.paragraph_index : 0,
      authority_type: (anchor.authority_type || '').trim(),
      authority_title: (anchor.authority_title || '').trim(),
      authority_citation: anchor.authority_citation?.trim() || null,
      authority_url: anchor.authority_url?.trim() || null,
      authority_node_id: anchor.authority_node_id?.trim() || null,
      source_tier: anchor.source_tier || 'primary',
    }))
    .filter(anchor => anchor.anchor_text && anchor.authority_type && anchor.authority_title);
}

function rpcMigrationError(error: { message?: string; code?: string } | null): string {
  const message = error?.message || '';
  if (
    error?.code === '42883' ||
    message.includes('save_paragraph_with_revision') ||
    message.includes('insert_paragraph_with_revision') ||
    message.includes('delete_paragraph_with_revision')
  ) {
    return 'Database migration required: apply migrations/paragraph_authoring_stabilization.sql before editing paragraphs.';
  }
  return message || 'Paragraph write failed.';
}

export async function saveParagraph(
  paragraphId: string,
  content: string,
  marginalNote: string | null,
  commitMessage: string,
  slug: string,
  authorityAnchors: ParagraphAuthorityInput[] = [],
): Promise<ParagraphResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in to edit.' };
  if (!commitMessage.trim()) return { error: 'Please describe your edit.' };

  const { data: paragraph, error: fetchErr } = await supabase
    .from('paragraphs')
    .select('*')
    .eq('id', paragraphId)
    .is('deleted_at', null)
    .single();

  if (fetchErr || !paragraph) return { error: 'Paragraph not found.' };

  const oldNorm = normalizeForComparison(paragraph.content);
  const newNorm = normalizeForComparison(content);
  const referencesChanged = hasReferenceTargetChanges(paragraph.content, content);

  if (oldNorm === newNorm && !referencesChanged && (paragraph.marginal_note || '') === (marginalNote || '')) {
    return { error: 'No visible changes detected.' };
  }

  const oldSize = computeVisibleTextSize(paragraph.content);
  const newSize = computeVisibleTextSize(content);
  const delta = Math.abs(newSize - oldSize);

  let revisionType = 'content_edit';
  if (oldNorm === newNorm && (paragraph.marginal_note || '') !== (marginalNote || '')) {
    revisionType = 'marginal_note_edit';
  }

  if (revisionType === 'content_edit' && delta < MIN_DELTA && oldNorm !== newNorm) {
    console.log(JSON.stringify({
      event: 'paragraph_small_edit',
      paragraph_id: paragraphId,
      user_id: user.id,
      visible_delta: delta,
      timestamp: new Date().toISOString(),
    }));
  }

  const { error: saveErr } = await supabase.rpc('save_paragraph_with_revision', {
    p_paragraph_id: paragraphId,
    p_content: content,
    p_marginal_note: marginalNote || null,
    p_commit_message: commitMessage.trim(),
    p_revision_type: revisionType,
    p_content_size: newSize,
    p_author_id: user.id,
    p_authority_anchors: sanitizeAuthorityAnchors(authorityAnchors),
  });

  if (saveErr) {
    console.error('save_paragraph_with_revision error:', saveErr);
    return { error: rpcMigrationError(saveErr) };
  }

  revalidatePath(`/topic/${slug}`);
  return { success: true, paragraphId };
}

export async function insertParagraph(
  nodeId: string,
  afterOrderIndex: number,
  content: string,
  marginalNote: string | null,
  groupLabel: string | null,
  slug: string,
  authorityAnchors: ParagraphAuthorityInput[] = [],
): Promise<ParagraphResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in to add a paragraph.' };
  if (!content.trim()) return { error: 'Paragraph content cannot be empty.' };

  const { data, error: insertErr } = await supabase.rpc('insert_paragraph_with_revision', {
    p_node_id: nodeId,
    p_after_order: afterOrderIndex,
    p_content: content,
    p_marginal_note: marginalNote || null,
    p_group_label: groupLabel || null,
    p_stable_id: generateStableId(),
    p_author_id: user.id,
    p_content_size: computeVisibleTextSize(content),
    p_authority_anchors: sanitizeAuthorityAnchors(authorityAnchors),
  });

  if (insertErr) {
    console.error('insert_paragraph_with_revision error:', insertErr);
    return { error: rpcMigrationError(insertErr) };
  }

  const paragraphId = typeof data === 'object' && data && 'paragraph_id' in data
    ? String((data as { paragraph_id: string }).paragraph_id)
    : undefined;

  revalidatePath(`/topic/${slug}`);
  return { success: true, paragraphId };
}

export async function deleteParagraph(
  paragraphId: string,
  slug: string,
): Promise<ParagraphResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in.' };

  const { error: deleteErr } = await supabase.rpc('delete_paragraph_with_revision', {
    p_paragraph_id: paragraphId,
    p_author_id: user.id,
  });

  if (deleteErr) {
    console.error('delete_paragraph_with_revision error:', deleteErr);
    return { error: rpcMigrationError(deleteErr) };
  }

  revalidatePath(`/topic/${slug}`);
  return { success: true };
}
