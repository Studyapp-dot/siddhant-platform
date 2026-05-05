import { NextRequest, NextResponse } from 'next/server'
import { extractMetadata } from '@/utils/ai/extract-metadata'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  // Verify user is authenticated (this route IS called during request context)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { nodeId } = body

  if (!nodeId) {
    return NextResponse.json({ error: 'nodeId is required' }, { status: 400 })
  }

  // extractMetadata uses its own standalone Supabase client internally
  const result = await extractMetadata(nodeId)

  if (result.success) {
    return NextResponse.json({ status: 'extracted' })
  } else {
    console.error('[api/extract-metadata]', result.error)
    return NextResponse.json({ status: 'failed', error: result.error }, { status: 500 })
  }
}
