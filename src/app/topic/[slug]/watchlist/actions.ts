'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function followNode(nodeId: string, slug: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('watchlist').insert({
    user_id: user.id,
    node_id: nodeId,
  })
  revalidatePath(`/topic/${slug}`)
}

export async function unfollowNode(nodeId: string, slug: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('watchlist').delete().match({
    user_id: user.id,
    node_id: nodeId,
  })
  revalidatePath(`/topic/${slug}`)
}
