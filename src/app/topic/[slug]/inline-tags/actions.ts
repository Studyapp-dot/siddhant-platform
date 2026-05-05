'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addInlineTag(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const node_id = formData.get('node_id') as string
  const slug = formData.get('slug') as string
  const tier = parseInt(formData.get('tier') as string)
  const tag_type = formData.get('tag_type') as string
  const context_quote = formData.get('context_quote') as string | null

  await supabase.from('inline_tags').insert({
    node_id,
    author_id: user.id,
    tier,
    tag_type,
    context_quote: context_quote || null,
  })

  revalidatePath(`/topic/${slug}`)
}
