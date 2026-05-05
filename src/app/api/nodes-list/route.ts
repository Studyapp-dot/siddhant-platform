import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  
  const { data: nodes } = await supabase
    .from('nodes')
    .select('id, title, slug, node_type')
    .order('title', { ascending: true })

  return NextResponse.json(nodes ?? [])
}
