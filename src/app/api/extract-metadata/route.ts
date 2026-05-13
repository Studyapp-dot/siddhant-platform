import { NextRequest, NextResponse } from 'next/server'
import { extractMetadata } from '@/utils/ai/extract-metadata'

export async function POST(request: NextRequest) {
  // No auth gate — this route is called fire-and-forget from server actions
  // (edit/actions.ts, new/actions.ts) AFTER redirect(), when no cookies exist.
  // extractMetadata() uses its own service-role Supabase client internally,
  // so request-context auth is unnecessary.

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
