'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// ============================================================================
// AUTHORITY ANCHOR TYPES
// ============================================================================

export type AuthorityType = 
  | 'case' 
  | 'statute' 
  | 'constitutional_provision' 
  | 'doctrine' 
  | 'concept' 
  | 'external_source'

export interface AuthorityAnchor {
  id: string
  node_id: string
  revision_id: string | null
  paragraph_id?: string | null
  paragraph_revision_id?: string | null
  author_id: string
  anchor_text: string
  context_before: string
  context_after: string
  paragraph_index: number
  authority_type: AuthorityType
  authority_title: string
  authority_citation: string | null
  authority_url: string | null
  authority_node_id: string | null
  authority_node_slug?: string | null
  authority_node_title?: string | null
  source_tier: 'primary' | 'secondary' | 'tertiary'
  created_at: string
  profiles?: { username: string } | { username: string }[]
}

// ============================================================================
// AUTHORITY TYPE METADATA — exported from authority-constants.ts
// (Server action files can only export async functions)
// ============================================================================

// ============================================================================
// CREATE AUTHORITY ANCHOR
// ============================================================================

export async function createAuthorityAnchor(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const node_id = formData.get('node_id') as string
  const revision_id = formData.get('revision_id') as string
  const slug = formData.get('slug') as string
  const anchor_text = (formData.get('anchor_text') as string)?.trim()
  const context_before = (formData.get('context_before') as string)?.trim() || ''
  const context_after = (formData.get('context_after') as string)?.trim() || ''
  const paragraph_index = parseInt(formData.get('paragraph_index') as string) || 0
  const authority_type = formData.get('authority_type') as AuthorityType
  const authority_title = (formData.get('authority_title') as string)?.trim()
  const authority_citation = (formData.get('authority_citation') as string)?.trim() || null
  const authority_url = (formData.get('authority_url') as string)?.trim() || null
  const authority_node_id = (formData.get('authority_node_id') as string)?.trim() || null
  const source_tier = (formData.get('source_tier') as string) || 'primary'

  if (!anchor_text || !authority_type || !authority_title) {
    throw new Error('Missing required fields: anchor_text, authority_type, authority_title')
  }

  const { error } = await supabase.from('authority_anchors').insert({
    node_id,
    revision_id,
    author_id: user.id,
    anchor_text,
    context_before,
    context_after,
    paragraph_index,
    authority_type,
    authority_title,
    authority_citation,
    authority_url,
    authority_node_id: authority_node_id || null,
    source_tier,
  })

  if (error) {
    console.error('[authority-anchors] Insert failed:', error)
    throw new Error(error.message)
  }

  revalidatePath(`/topic/${slug}`, 'layout')
}

// ============================================================================
// DELETE AUTHORITY ANCHOR
// ============================================================================

export async function deleteAuthorityAnchor(anchorId: string, slug: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Soft delete — preserves audit trail for scholarly integrity
  const { error } = await supabase
    .from('authority_anchors')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    })
    .eq('id', anchorId)
    .eq('author_id', user.id)

  if (error) {
    console.error('[authority-anchors] Soft delete failed:', error)
    throw new Error(error.message)
  }

  revalidatePath(`/topic/${slug}`, 'layout')
}

// ============================================================================
// GET AUTHORITY ANCHORS FOR A NODE
// ============================================================================

export async function getAuthorityAnchors(nodeId: string): Promise<AuthorityAnchor[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('authority_anchors')
    .select(`
      id, node_id, revision_id, author_id,
      paragraph_id, paragraph_revision_id,
      anchor_text, context_before, context_after, paragraph_index,
      authority_type, authority_title, authority_citation, authority_url, authority_node_id,
      source_tier, created_at,
      profiles!authority_anchors_author_id_fkey ( username )
    `)
    .eq('node_id', nodeId)
    .is('deleted_at', null)  // Exclude soft-deleted anchors
    .order('paragraph_index', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[authority-anchors] Fetch failed:', error)
    return []
  }

  // Fetch linked node slugs for Siddhant-internal authorities
  const nodeIds = (data || [])
    .filter(a => a.authority_node_id)
    .map(a => a.authority_node_id!)

  let nodeMap: Record<string, { slug: string; title: string }> = {}
  if (nodeIds.length > 0) {
    const { data: nodes } = await supabase
      .from('nodes')
      .select('id, slug, title')
      .in('id', [...new Set(nodeIds)])

    if (nodes) {
      nodeMap = Object.fromEntries(nodes.map(n => [n.id, { slug: n.slug, title: n.title }]))
    }
  }

  return (data || []).map(anchor => ({
    ...anchor,
    authority_node_slug: anchor.authority_node_id ? nodeMap[anchor.authority_node_id]?.slug : null,
    authority_node_title: anchor.authority_node_id ? nodeMap[anchor.authority_node_id]?.title : null,
  })) as AuthorityAnchor[]
}

// ============================================================================
// SEARCH EXISTING NODES (for linking authorities to the archive)
// ============================================================================

export async function searchArchiveNodes(query: string): Promise<Array<{
  id: string; title: string; slug: string; node_type: string;
}>> {
  if (!query || query.length < 2) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('nodes')
    .select('id, title, slug, node_type')
    .ilike('title', `%${query}%`)
    .order('title')
    .limit(8)

  return data || []
}
