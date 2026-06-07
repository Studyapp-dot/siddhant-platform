'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// ============================================================================
// SOFT DELETE NODE — Sets deleted_at timestamp, preserving all data.
//
// Requirements:
//   - Owner or admin only
//   - Soft delete (sets deleted_at, never drops rows)
//   - Also soft-deletes all paragraphs belonging to the node
//   - Future: add restore capability by clearing deleted_at
// ============================================================================

export async function softDeleteNode(nodeId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify node exists and user is creator
  const { data: node, error: fetchError } = await supabase
    .from('nodes')
    .select('id, slug, created_by')
    .eq('id', nodeId)
    .is('deleted_at', null)
    .single()

  if (fetchError || !node) {
    return { error: 'Node not found or already deleted' }
  }

  // Check ownership (created_by) or admin role
  // For now: only the creator can delete. Admin check can be added later.
  if (node.created_by && node.created_by !== user.id) {
    return { error: 'Only the node creator can delete this node' }
  }

  const now = new Date().toISOString()

  // Soft-delete the node
  const { data: updatedNode, error: deleteError } = await supabase
    .from('nodes')
    .update({ deleted_at: now })
    .eq('id', nodeId)
    .select('id')
    .single()

  if (deleteError || !updatedNode) {
    return { error: `Failed to delete node: ${deleteError?.message || 'Permission denied by RLS'}` }
  }

  // Soft-delete all paragraphs belonging to this node
  await supabase
    .from('paragraphs')
    .update({ deleted_at: now })
    .eq('node_id', nodeId)
    .is('deleted_at', null)

  revalidatePath(`/topic/${node.slug}`)
  revalidatePath('/nodes')

  return { success: true }
}
