# ADR-001: Transitional AI Extraction Dispatch

**Status**: Active (Transitional)  
**Date**: 2026-05-08  
**Decision**: Fire-and-forget `fetch()` for AI extraction  

---

## Context

Siddhant's AI extraction pipeline (metadata, revision semantics) was originally
implemented as synchronous `await` calls inside the editorial save path. This
caused 3–9 second save latency on every edit — unacceptable for editorial UX.

## Decision

Replace synchronous extraction with fire-and-forget `fetch()` calls to internal
API routes (`/api/extract-metadata`, `/api/extract-revision-semantics`).

```typescript
// Current pattern (TRANSITIONAL)
fetch(`${origin}/api/extract-metadata`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ nodeId: node_id }),
}).catch(err => console.error(...));
```

## Consequences

### Positive
- Save latency reduced from 3–9s to ~200ms
- Editorial UX no longer blocked by AI processing
- Extraction failures don't prevent revision creation

### Negative (Known Limitations)
- **No retry semantics**: If extraction fails, it is lost
- **No durability**: On serverless (Vercel), the function may be terminated
  before extraction completes
- **No ordering guarantees**: Concurrent saves may produce out-of-order extractions
- **No backpressure**: No limit on concurrent extraction calls

## Mitigations (Current)
- Content hash gate prevents redundant extraction
- Race condition protection prevents stale metadata overwrites
- Minimum delta gate prevents trivial extraction calls

## Future Migration Target

This pattern MUST NOT fossilize into permanent infrastructure.

Target architecture:
- **Durable job queue** (Inngest, pg-boss, or BullMQ)
- Retry semantics with exponential backoff
- Optimistic locking on metadata writes
- Event-driven extraction triggered by revision creation
- Extraction status visibility in admin dashboard

## When to Migrate

Migrate when ANY of these conditions are met:
1. Extraction failure rate exceeds 5% (monitor via logs)
2. Multiple concurrent editors on the same node become common
3. Platform moves to a non-serverless runtime
4. Extraction pipeline grows beyond 2 stages
