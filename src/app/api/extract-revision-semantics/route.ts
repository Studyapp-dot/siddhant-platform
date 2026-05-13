import { NextRequest, NextResponse } from 'next/server'
import { extractRevisionSemantics } from '@/utils/ai/extract-revision-semantics'

export async function POST(request: NextRequest) {
  // This route is called fire-and-forget from server actions.
  // No user auth check needed — the extraction function validates
  // the revision exists via its own Supabase client.
  const body = await request.json()
  const { revisionId } = body

  if (!revisionId) {
    return NextResponse.json({ error: 'revisionId is required' }, { status: 400 })
  }

  const result = await extractRevisionSemantics(revisionId)

  if (result.success) {
    return NextResponse.json({ status: 'extracted' })
  } else {
    console.error('[api/extract-revision-semantics]', result.error)
    return NextResponse.json({ status: 'failed', error: result.error }, { status: 500 })
  }
}
