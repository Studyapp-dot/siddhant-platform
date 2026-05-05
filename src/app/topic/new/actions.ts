'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

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
  await supabase.from('revisions').insert({
    node_id: newNode.id,
    author_id: user.id,
    report_content,
    commit_message,
  })

  // Fire-and-forget: trigger AI metadata extraction
  // We don't await this — the user is redirected immediately
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
    : 'http://localhost:3000'
  
  try {
    // Use the internal extraction function directly instead of HTTP call
    // to avoid issues with self-referencing URLs during build
    const { extractMetadata } = await import('@/utils/ai/extract-metadata')
    extractMetadata(newNode.id).catch((err: any) => {
      console.error('[create-node] AI extraction failed:', err)
    })
  } catch (err) {
    console.error('[create-node] Failed to start extraction:', err)
  }

  redirect(`/topic/${slug}`)
}
