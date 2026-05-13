'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { computeVisibleTextSize } from '@/utils/content-size'

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
  const report_content = formData.get('report_content') as string
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

  // Create node (metadata starts empty — AI fills it)
  const { data: newNode, error: nodeError } = await supabase
    .from('nodes')
    .insert({ slug, title, node_type, metadata: {} })
    .select('id')
    .single()

  if (nodeError || !newNode) {
    redirect(`/topic/new?error=Failed+to+create+node:+${nodeError?.message ?? 'unknown error'}`)
  }

  // Create first revision
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

  // AI extraction — non-blocking, fire-and-forget (TRANSITIONAL)
  // Phase 3 should replace with durable job queue.
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  fetch(`${origin}/api/extract-metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodeId: newNode.id }),
  }).catch(err => console.error('[create-node] Metadata extraction dispatch failed:', err));

  redirect(`/topic/${slug}`)
}
