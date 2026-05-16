import { NextRequest, NextResponse } from 'next/server'
import { extractMetadata } from '@/utils/ai/extract-metadata'

function isAuthorizedInternalRequest(request: NextRequest) {
  const secret = process.env.INTERNAL_EXTRACTION_SECRET
  const provided = request.headers.get('x-internal-extraction-secret')
  return Boolean(secret && provided && provided === secret)
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedInternalRequest(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Legacy/internal entrypoint. Server actions call extractMetadata directly;
  // this route requires an internal shared secret before service-role work runs.

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { nodeId } = body

  if (typeof nodeId !== 'string' || !nodeId.trim()) {
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
