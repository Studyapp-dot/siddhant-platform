// ============================================================================
// SIDDHANT: Peer Review — Rubric & Configuration Constants
//
// Rubric Version: v1 (Research-grounded)
// Will be revised after 3-6 months of community data.
// Every review stores its rubric version so historical reviews remain valid.
//
// Peer review applies ONLY to Good Article and Featured tiers.
// Lower tiers (Draft → Developing → Useful → Solid) use individual editor
// assessment via QualityAssessment.tsx — no formal review needed.
// ============================================================================

// Current rubric version — stored with every review
export const RUBRIC_VERSION = 'v1';

// --------------------------------------------------------------------------
// The 6 Review Criteria — designed for Indian legal content quality
// --------------------------------------------------------------------------
export const REVIEW_CRITERIA = [
  {
    key: 'legal_accuracy',
    label: 'Legal Accuracy',
    description: 'Does this correctly state the current legal position? Are judgments and statutes cited accurately? Are holdings described correctly?',
    requiresLegalReasoning: true,
  },
  {
    key: 'settled_vs_contested',
    label: 'Settled vs. Contested',
    description: 'Does this clearly distinguish between settled legal doctrine and areas where the law is evolving, contested, or subject to multiple interpretations?',
    requiresLegalReasoning: true,
  },
  {
    key: 'citation_quality',
    label: 'Citation Quality',
    description: 'Are sources reliable and correctly cited? Are primary sources (judgments, statutes) used where available? Are claims adequately supported?',
    requiresLegalReasoning: false,
  },
  {
    key: 'completeness',
    label: 'Completeness',
    description: 'Does this cover the topic adequately for a law student? Are there significant gaps a student would need to know about?',
    requiresLegalReasoning: false,
  },
  {
    key: 'clarity',
    label: 'Clarity',
    description: 'Is the content clearly written and well-organized? Would a law student be able to follow the reasoning?',
    requiresLegalReasoning: false,
  },
  {
    key: 'currency',
    label: 'Currency',
    description: 'Is this up-to-date with recent judicial developments, legislative amendments, and doctrinal shifts?',
    requiresLegalReasoning: true,
  },
] as const;

export type CriterionKey = typeof REVIEW_CRITERIA[number]['key'];

// --------------------------------------------------------------------------
// Score Definitions — 1 to 5 scale per criterion
// --------------------------------------------------------------------------
export const SCORE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Fails standard',     color: '#ef4444' },
  2: { label: 'Below expectations', color: '#f97316' },
  3: { label: 'Meets basic',        color: '#eab308' },
  4: { label: 'Good quality',       color: '#22c55e' },
  5: { label: 'Excellent',          color: '#10b981' },
};

// --------------------------------------------------------------------------
// Review Recommendations
// --------------------------------------------------------------------------
export const RECOMMENDATIONS = [
  {
    value: 'meets_standard' as const,
    label: 'Meets Standard',
    description: 'This node meets the criteria for the target tier',
    color: '#22c55e',
    icon: '✓',
  },
  {
    value: 'needs_work' as const,
    label: 'Needs Work',
    description: 'Good progress but specific improvements are needed',
    color: '#f59e0b',
    icon: '⚠',
  },
  {
    value: 'not_ready' as const,
    label: 'Not Ready',
    description: 'Significant work required before advancement',
    color: '#ef4444',
    icon: '✗',
  },
] as const;

export type Recommendation = typeof RECOMMENDATIONS[number]['value'];

// --------------------------------------------------------------------------
// Confidence Levels
// --------------------------------------------------------------------------
export const CONFIDENCE_LEVELS = [
  { value: 'high' as const,   label: 'High',   color: '#22c55e' },
  { value: 'medium' as const, label: 'Medium', color: '#f59e0b' },
  { value: 'low' as const,    label: 'Low',    color: '#ef4444' },
] as const;

export type Confidence = typeof CONFIDENCE_LEVELS[number]['value'];

// --------------------------------------------------------------------------
// Per-Tier Review Configuration
// --------------------------------------------------------------------------
export const REVIEW_CONFIG = {
  good_article: {
    label: 'Good Article',
    minReviews: 1,
    minReviewerLevel: 3,        // Recognized Contributor+
    requiresIndependence: true,
    prerequisiteTier: 'b_class', // Node must be at "Solid" to be nominated
    description: 'Requires 1 independent Recognized Contributor (L3+) to pass a structured review',
  },
  featured: {
    label: 'Featured',
    minReviews: 2,
    minReviewerLevel: 4,        // Senior Scholar+
    requiresIndependence: true,
    prerequisiteTier: 'good_article', // Node must be Good Article to be nominated
    description: 'Requires 2 independent Senior Scholars (L4+) to reach consensus',
  },
} as const;

export type ReviewableTier = keyof typeof REVIEW_CONFIG;

// --------------------------------------------------------------------------
// Outcome Display Configuration
// --------------------------------------------------------------------------
export const OUTCOME_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  advanced: {
    label: 'Advanced',
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.1)',
    icon: '✅',
  },
  maintained: {
    label: 'Maintained',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.1)',
    icon: '📋',
  },
  split: {
    label: 'Split',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.1)',
    icon: '⚠',
  },
  downgraded: {
    label: 'Downgraded',
    color: '#dc2626',
    bg: 'rgba(220, 38, 38, 0.1)',
    icon: '⬇',
  },
};
