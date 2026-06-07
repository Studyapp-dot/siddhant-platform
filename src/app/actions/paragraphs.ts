'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { computeVisibleTextSize, normalizeForComparison } from '@/utils/content-size'

// ============================================================================
// PARAGRAPH SERVER ACTIONS — Read + Write operations
// ============================================================================

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

// ── Read ──

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

// ── Stable ID generator ──

function generateStableId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'p_';
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ── Renumber ──

async function renumberParagraphs(nodeId: string, slug: string): Promise<void> {
  const supabase = await createClient();

  const { data: paragraphs } = await supabase
    .from('paragraphs')
    .select('id, order_index')
    .eq('node_id', nodeId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true });

  if (!paragraphs || paragraphs.length === 0) return;

  // Two-pass renumbering to avoid unique constraint violations on (node_id, display_number).
  // Pass 1: Shift all display_numbers to high temporary values
  for (let i = 0; i < paragraphs.length; i++) {
    await supabase
      .from('paragraphs')
      .update({ display_number: 10000 + i })
      .eq('id', paragraphs[i].id);
  }

  // Pass 2: Assign final sequential numbers
  for (let i = 0; i < paragraphs.length; i++) {
    await supabase
      .from('paragraphs')
      .update({ display_number: i + 1, order_index: i + 1, updated_at: new Date().toISOString() })
      .eq('id', paragraphs[i].id);
  }

  revalidatePath(`/topic/${slug}`);
}

// ── Save (edit existing paragraph) ──

const MIN_DELTA = 5; // Minimum visible-text change to create a revision (characters)

export async function saveParagraph(
  paragraphId: string,
  content: string,
  marginalNote: string | null,
  commitMessage: string,
  slug: string,
): Promise<ParagraphResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in to edit.' };
  if (!commitMessage.trim()) return { error: 'Please describe your edit.' };

  // Fetch current paragraph
  const { data: paragraph, error: fetchErr } = await supabase
    .from('paragraphs')
    .select('*')
    .eq('id', paragraphId)
    .single();

  if (fetchErr || !paragraph) return { error: 'Paragraph not found.' };

  // Content-delta gate
  const oldNorm = normalizeForComparison(paragraph.content);
  const newNorm = normalizeForComparison(content);

  if (oldNorm === newNorm && (paragraph.marginal_note || '') === (marginalNote || '')) {
    return { error: 'No visible changes detected.' };
  }

  const oldSize = computeVisibleTextSize(paragraph.content);
  const newSize = computeVisibleTextSize(content);
  const delta = Math.abs(newSize - oldSize);

  // Determine revision type
  let revisionType = 'content_edit';
  if (oldNorm === newNorm && (paragraph.marginal_note || '') !== (marginalNote || '')) {
    revisionType = 'marginal_note_edit';
  }

  // Low-delta gate — warn but don't block for marginal note changes
  if (revisionType === 'content_edit' && delta < MIN_DELTA && oldNorm !== newNorm) {
    // Allow but log — very small edits are still valid for typo fixes
    console.log(JSON.stringify({
      event: 'paragraph_small_edit',
      paragraph_id: paragraphId,
      user_id: user.id,
      visible_delta: delta,
      timestamp: new Date().toISOString(),
    }));
  }

  // Update paragraph
  const { error: updateErr } = await supabase
    .from('paragraphs')
    .update({
      content,
      marginal_note: marginalNote || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paragraphId);

  if (updateErr) return { error: 'Failed to save paragraph.' };

  // Create revision
  const { error: revErr } = await supabase
    .from('paragraph_revisions')
    .insert({
      paragraph_id: paragraphId,
      node_id: paragraph.node_id,
      author_id: user.id,
      content,
      marginal_note: marginalNote || null,
      commit_message: commitMessage.trim(),
      revision_type: revisionType,
      content_size: newSize,
    });

  if (revErr) {
    console.error('paragraph_revision insert error:', revErr);
    // Non-fatal — paragraph was already updated
  }

  revalidatePath(`/topic/${slug}`);
  return { success: true, paragraphId };
}

// ── Insert (new paragraph) ──

export async function insertParagraph(
  nodeId: string,
  afterOrderIndex: number, // Insert after this order_index. Use 0 for first position.
  content: string,
  marginalNote: string | null,
  groupLabel: string | null,
  slug: string,
): Promise<ParagraphResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in to add a paragraph.' };
  if (!content.trim()) return { error: 'Paragraph content cannot be empty.' };

  // Shift order_index and display_number of all paragraphs after the insertion point.
  // Process from highest to lowest to avoid unique constraint violations.
  const { error: shiftErr } = await supabase.rpc('increment_paragraph_order', {
    p_node_id: nodeId,
    p_after_order: afterOrderIndex,
  });

  // If the RPC doesn't exist, do it manually
  if (shiftErr) {
    const { data: toShift } = await supabase
      .from('paragraphs')
      .select('id, order_index, display_number')
      .eq('node_id', nodeId)
      .is('deleted_at', null)
      .gt('order_index', afterOrderIndex)
      .order('order_index', { ascending: false }); // Process from end to avoid conflicts

    if (toShift) {
      for (const p of toShift) {
        await supabase
          .from('paragraphs')
          .update({ order_index: p.order_index + 1, display_number: p.display_number + 1 })
          .eq('id', p.id);
      }
    }
  }

  const newOrderIndex = afterOrderIndex + 1;
  const stableId = generateStableId();

  // Insert new paragraph
  const { data: newPara, error: insertErr } = await supabase
    .from('paragraphs')
    .insert({
      node_id: nodeId,
      stable_id: stableId,
      display_number: newOrderIndex, // Temporary — renumber will fix
      marginal_note: marginalNote || null,
      content,
      group_label: groupLabel || null,
      order_index: newOrderIndex,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (insertErr || !newPara) {
    return { error: 'Failed to create paragraph: ' + (insertErr?.message || 'unknown') };
  }

  // Create initial revision
  await supabase
    .from('paragraph_revisions')
    .insert({
      paragraph_id: newPara.id,
      node_id: nodeId,
      author_id: user.id,
      content,
      marginal_note: marginalNote || null,
      commit_message: 'New paragraph created',
      revision_type: 'creation',
      content_size: computeVisibleTextSize(content),
    });

  // Renumber all paragraphs to ensure clean sequential display_numbers
  await renumberParagraphs(nodeId, slug);

  return { success: true, paragraphId: newPara.id };
}

// ── Delete (soft delete) ──

export async function deleteParagraph(
  paragraphId: string,
  slug: string,
): Promise<ParagraphResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in.' };

  const { data: paragraph } = await supabase
    .from('paragraphs')
    .select('node_id, content, marginal_note')
    .eq('id', paragraphId)
    .single();

  if (!paragraph) return { error: 'Paragraph not found.' };

  // Soft delete
  const { error: deleteErr } = await supabase
    .from('paragraphs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', paragraphId);

  if (deleteErr) return { error: 'Failed to delete paragraph.' };

  // Record deletion revision
  await supabase
    .from('paragraph_revisions')
    .insert({
      paragraph_id: paragraphId,
      node_id: paragraph.node_id,
      author_id: user.id,
      content: paragraph.content,
      marginal_note: paragraph.marginal_note,
      commit_message: 'Paragraph deleted',
      revision_type: 'deletion',
      content_size: 0,
    });

  // Renumber remaining paragraphs
  await renumberParagraphs(paragraph.node_id, slug);

  return { success: true };
}
