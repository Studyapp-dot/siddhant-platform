import crypto from 'crypto'
import { normalizePublicRevisionText, toPublicRevisionText } from './revision-presentation'

// ============================================================================
// CONTENT SIZE & NORMALIZATION UTILITIES
// ============================================================================
// These functions separate visible scholarly contribution from infrastructure
// noise (section slugs, markdown syntax, whitespace). This is the foundation
// of the "revision-worthy mutation" principle: only meaningful visible-text
// changes should create revisions, trigger AI, or affect reputation.
// ============================================================================

/**
 * Compute visible-text character count from markdown content.
 * Strips infrastructure tokens and authoring syntax so that deltas reflect
 * actual scholarly contribution, not storage/editor representation.
 */
export function computeVisibleTextSize(markdown: string): number {
  if (!markdown) return 0
  return toPublicRevisionText(markdown).length
}

/**
 * Normalize content for identity comparison.
 * Infrastructure-only mutations, whitespace normalization, and Markdown-only
 * styling changes are treated as no-ops for revision identity.
 */
export function normalizeForComparison(content: string): string {
  if (!content) return ''
  return normalizePublicRevisionText(content)
}

/**
 * Compute a SHA-256 hash of the normalized visible content.
 * Used for AI extraction gating: skip re-extraction if the visible semantic
 * content has not changed.
 */
export function computeContentHash(markdown: string): string {
  const normalized = normalizePublicRevisionText(markdown)
  return crypto.createHash('sha256').update(normalized).digest('hex')
}
