'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Auto-derive signal from relationship type
function getSignal(type: string): string | null {
  const positive = ['followed', 'applied', 'approved'];
  const neutral = ['explained', 'referred_to', 'distinguished'];
  const negative = ['doubted', 'not_followed', 'overruled'];
  
  if (positive.includes(type)) return 'positive';
  if (neutral.includes(type)) return 'neutral';
  if (negative.includes(type)) return 'negative';
  return null; // Non-judicial edges don't have signal
}

export async function addEdge(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const source_node_id = formData.get('source_node_id') as string
  const slug = formData.get('slug') as string
  const target_slug = (formData.get('target_slug') as string).trim().toLowerCase()
  const relationship_type = formData.get('relationship_type') as string
  const description = (formData.get('description') as string)?.trim() || null

  const target_section_id = (formData.get('target_section_id') as string) || null;

  // Resolve target slug to node id
  const { data: targetNode } = await supabase
    .from('nodes')
    .select('id, title')
    .eq('slug', target_slug)
    .single()

  if (!targetNode) {
    redirect(`/topic/${slug}/edges?error=${encodeURIComponent(`No legal authority found with identifier "${target_slug}". Verify the topic exists in the knowledge commons.`)}`)
  }

  const signal = getSignal(relationship_type)

  const { error } = await supabase.from('cross_references').insert({
    source_node_id,
    target_node_id: targetNode.id,
    target_section_id,
    relationship_type,
    description,
    signal,
    created_by: user.id,
  })

  if (error) {
    redirect(`/topic/${slug}/edges?error=${encodeURIComponent('This doctrinal relationship already exists or the relationship type is invalid.')}`)
  }

  revalidatePath(`/topic/${slug}`)
  redirect(`/topic/${slug}/edges?success=${encodeURIComponent('Doctrinal relationship established successfully.')}`)
}

export async function removeEdge(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const edge_id = formData.get('edge_id') as string
  const slug = formData.get('slug') as string

  await supabase.from('cross_references').delete().eq('id', edge_id)

  revalidatePath(`/topic/${slug}`)
  redirect(`/topic/${slug}/edges`)
}
