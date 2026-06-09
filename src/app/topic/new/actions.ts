'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { computeVisibleTextSize } from '@/utils/content-size'
import { extractMetadata } from '@/utils/ai/extract-metadata'

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

export async function createNode(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const title = (formData.get('title') as string).trim()
  const customSlug = (formData.get('slug') as string).trim()
  const commit_message = formData.get('commit_message') as string
  const node_type = (formData.get('node_type') as string) || 'topic'

  const slug = customSlug || slugify(title)

  // Check slug doesn't already exist
  const { data: existing } = await supabase
    .from('nodes')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    redirect(`/topic/new?error=A+node+with+slug+\"${slug}\"+already+exists.`)
  }

  // Detect authoring mode: paragraph-native or legacy
  const paragraphContent = (formData.get('paragraph_content') as string | null)?.trim()
  const marginalNote = (formData.get('marginal_note') as string | null)?.trim()
  const isParagraphNative = !!paragraphContent

  // Create node (metadata starts empty — AI fills it)
  const { data: newNode, error: nodeError } = await supabase
    .from('nodes')
    .insert({ slug, title, node_type, metadata: {}, created_by: user.id })
    .select('id')
    .single()

  if (nodeError || !newNode) {
    redirect(`/topic/new?error=Failed+to+create+node:+${nodeError?.message ?? 'unknown error'}`)
  }

  if (isParagraphNative) {
    // ── Paragraph-native path ──
    // Create the first paragraph record
    const stableId = generateStableId()
    const { data: newParagraph } = await supabase
      .from('paragraphs')
      .insert({
        node_id: newNode.id,
        stable_id: stableId,
        display_number: 1,
        marginal_note: marginalNote || null,
        content: paragraphContent,
        group_label: null,
        order_index: 1,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (newParagraph) {
      const { data: newParagraphRevision } = await supabase.from('paragraph_revisions').insert({
        paragraph_id: newParagraph.id,
        node_id: newNode.id,
        author_id: user.id,
        content: paragraphContent,
        marginal_note: marginalNote || null,
        commit_message: commit_message || 'Initial paragraph created',
        revision_type: 'creation',
        content_size: paragraphContent.length,
      }).select('id').single()

      const pendingAnchorsJson = formData.get('pending_authority_anchors') as string
      if (pendingAnchorsJson && newParagraphRevision) {
        try {
          const pendingAnchors = JSON.parse(pendingAnchorsJson) as Array<{
            anchor_text: string; context_before: string; context_after: string;
            paragraph_index: number; authority_type: string; authority_title: string;
            authority_citation?: string; authority_url?: string; authority_node_id?: string;
          }>
          if (pendingAnchors.length > 0) {
            const rows = pendingAnchors.map(a => ({
              node_id: newNode.id,
              revision_id: null,
              paragraph_id: newParagraph.id,
              paragraph_revision_id: newParagraphRevision.id,
              author_id: user.id,
              anchor_text: a.anchor_text,
              context_before: a.context_before || '',
              context_after: a.context_after || '',
              paragraph_index: 0,
              authority_type: a.authority_type,
              authority_title: a.authority_title,
              authority_citation: a.authority_citation || null,
              authority_url: a.authority_url || null,
              authority_node_id: a.authority_node_id || null,
              source_tier: 'primary',
            }))
            await supabase.from('authority_anchors').insert(rows)
          }
        } catch (err) {
          console.error('[create-node] Paragraph authority anchors save failed:', err)
        }
      }
    }

    // Create a minimal node-level revision as a creation marker.
    // report_content is empty — content lives in paragraphs.
    await supabase.from('revisions').insert({
      node_id: newNode.id,
      author_id: user.id,
      report_content: '',
      commit_message,
      content_size: 0,
      revision_type: 'content_edit',
      node_type_at_save: node_type,
    })

  } else {
    // ── Legacy path — unchanged ──
    const report_content = formData.get('report_content') as string
    const content_size = computeVisibleTextSize(report_content);
    const { data: newRevision } = await supabase.from('revisions').insert({
      node_id: newNode.id,
      author_id: user.id,
      report_content,
      commit_message,
      content_size,
      revision_type: 'content_edit',
      node_type_at_save: node_type,
    }).select('id').single()

    // Save any authority anchors collected during drafting
    const pendingAnchorsJson = formData.get('pending_authority_anchors') as string
    if (pendingAnchorsJson && newRevision) {
      try {
        const pendingAnchors = JSON.parse(pendingAnchorsJson) as Array<{
          anchor_text: string; context_before: string; context_after: string;
          paragraph_index: number; authority_type: string; authority_title: string;
          authority_citation?: string; authority_url?: string; authority_node_id?: string;
        }>
        if (pendingAnchors.length > 0) {
          const rows = pendingAnchors.map(a => ({
            node_id: newNode.id,
            revision_id: newRevision.id,
            author_id: user.id,
            anchor_text: a.anchor_text,
            context_before: a.context_before || '',
            context_after: a.context_after || '',
            paragraph_index: a.paragraph_index || 0,
            authority_type: a.authority_type,
            authority_title: a.authority_title,
            authority_citation: a.authority_citation || null,
            authority_url: a.authority_url || null,
            authority_node_id: a.authority_node_id || null,
            source_tier: 'primary',
          }))
          await supabase.from('authority_anchors').insert(rows)
        }
      } catch (err) {
        console.error('[create-node] Authority anchors save failed:', err)
      }
    }
  }

  // AI extraction — non-blocking, fire-and-forget (TRANSITIONAL)
  // Phase 3 should replace with durable job queue.
  void extractMetadata(newNode.id)
    .catch(err => console.error('[create-node] Metadata extraction dispatch failed:', err));

  redirect(`/topic/${slug}`)
}

// ── Stable ID generator (same algorithm as paragraphs.ts) ──
function generateStableId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'p_';
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
