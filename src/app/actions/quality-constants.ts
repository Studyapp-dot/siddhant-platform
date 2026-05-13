// ============================================================================
// SIDDHANT: Quality Tier Constants
// Content-based quality assessment — NOT activity-based.
// These are plain constants shared across components.
// ============================================================================

export const QUALITY_TIERS: Record<string, {
  label: string;
  description: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  minLevel: number;
  requiresIndependence: boolean;
}> = {
  stub: {
    label: 'Draft',
    description: 'Recently published, community review pending',
    icon: '◇',
    color: '#a78a6e',
    bg: 'rgba(167, 138, 110, 0.08)',
    border: 'rgba(167, 138, 110, 0.25)',
    minLevel: 2,
    requiresIndependence: false,
  },
  start: {
    label: 'Developing',
    description: 'Contains meaningful content, requires improvement',
    icon: '📋',
    color: '#facc15',
    bg: 'rgba(250, 204, 21, 0.10)',
    border: 'rgba(250, 204, 21, 0.35)',
    minLevel: 2,
    requiresIndependence: false,
  },
  c_class: {
    label: 'Useful',
    description: 'Useful to casual reader, some gaps in coverage',
    icon: '📖',
    color: '#60a5fa',
    bg: 'rgba(96, 165, 250, 0.10)',
    border: 'rgba(96, 165, 250, 0.35)',
    minLevel: 2,
    requiresIndependence: false,
  },
  b_class: {
    label: 'Solid',
    description: 'Mostly complete and well-referenced',
    icon: '✓',
    color: '#34d399',
    bg: 'rgba(52, 211, 153, 0.10)',
    border: 'rgba(52, 211, 153, 0.35)',
    minLevel: 3,
    requiresIndependence: false,
  },
  good_article: {
    label: 'Trusted',
    description: 'Independently reviewed, meets institutional editorial standards',
    icon: '✓✓',
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.10)',
    border: 'rgba(34, 197, 94, 0.30)',
    minLevel: 3,
    requiresIndependence: true,
  },
  featured: {
    label: 'Canonical',
    description: 'Definitive archival resource, comprehensive scholarly citations',
    icon: '★',
    color: '#a78bfa',
    bg: 'rgba(167, 139, 250, 0.12)',
    border: 'rgba(167, 139, 250, 0.35)',
    minLevel: 4,
    requiresIndependence: true,
  },
};

// Ordered list of tiers for comparison
export const TIER_ORDER = ['stub', 'start', 'c_class', 'b_class', 'good_article', 'featured'];
