import { NextRequest, NextResponse } from 'next/server'
import { extractRevisionSemantics } from '@/utils/ai/extract-revision-semantics'

function isAuthorizedInternalRequest(request: NextRequest) {
  const secret = process.env.INTERNAL_EXTRACTION_SECRET
  const provided = request.headers.get('x-internal-extraction-secret')
  return Boolean(secret && provided && provided === secret)
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedInternalRequest(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Legacy/internal entrypoint. Server actions call extraction directly;
  // this route requires an internal shared secret before service-role work runs.
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { revisionId } = body

  if (typeof revisionId !== 'string' || !revisionId.trim()) {
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
