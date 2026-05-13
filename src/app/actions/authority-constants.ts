import type { AuthorityType } from './authority-anchors'

// ============================================================================
// AUTHORITY TYPE DISPLAY METADATA
// Shared across client and server components
// ============================================================================

export const AUTHORITY_TYPE_META: Record<AuthorityType, { label: string; icon: string; color: string; bg: string }> = {
  case:                       { label: 'Case',                    icon: '⚖️', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)' },
  statute:                    { label: 'Statute',                 icon: '📜', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)' },
  constitutional_provision:   { label: 'Constitutional Provision', icon: '🏛', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.08)' },
  doctrine:                   { label: 'Doctrine',                icon: '💡', color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)' },
  concept:                    { label: 'Concept',                 icon: '🧠', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.08)' },
  external_source:            { label: 'External Source',         icon: '🔗', color: '#64748b', bg: 'rgba(100, 116, 139, 0.08)' },
}
