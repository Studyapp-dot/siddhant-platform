// ============================================================================
// SIDDHANT: Reputation System — Shared Constants
// These are NOT server actions, just plain constants shared across components.
// ============================================================================

// Role display labels — the 6-level hierarchy
export const ROLE_LABELS: Record<string, { label: string; level: number }> = {
  reader:             { label: 'Reader',                  level: 1 },
  contributor:        { label: 'Contributor',             level: 2 },
  recognized:         { label: 'Recognized Contributor',  level: 3 },
  senior_scholar:     { label: 'Senior Scholar',          level: 4 },
  steward:            { label: 'Steward',                 level: 5 },
  governance_council: { label: 'Governance Council',      level: 6 },
};

// Reputation point values — single source of truth
export const REPUTATION_POINTS = {
  edit_accepted_minor: 2,
  edit_accepted_substantive: 5,
  edit_accepted_metadata: 1,     // Node type changes, slug edits, tag-only edits — NOT scholarly prose
  upvote_received: 1,
  endorsement_received: 10,
  scholar_star_received: 15,
  peer_review_completed: 3,
  peer_review_aligned: 2,
  discussion_cited: 5,
  flag_resolved: 2,
  mentee_first_contribution: 5,
  tier_advancement_bonus: 0,
  // ── Group ecosystem (Phase 1) ──
  // Intentionally lower than topic-level activities to prevent forum spam farming.
  group_post_created: 1,         // Substantive top-level forum post (≥50 chars)
  group_endorsement_received: 3, // Someone endorsed your forum post
  mentorship_accepted: 5,        // Mentor accepted a mentorship request
  coordinator_promoted: 0,       // Recognition event only — no direct points
} as const;

// Level thresholds — advancement criteria
export const LEVEL_THRESHOLDS = {
  recognized: {
    accepted_edits: 15,
    acceptance_rate: 70,
    reputation: 50,
  },
  senior_scholar: {
    accepted_edits: 75,
    acceptance_rate: 80,
    reputation: 400,
  },
} as const;

/**
 * Scholar Star categories — adapted for legal scholarship.
 * Modeled on Wikipedia's 80+ Barnstar categories but focused on law.
 */
export const SCHOLAR_STAR_CATEGORIES = {
  citation: {
    id: 'citation',
    icon: '⚖️',
    label: 'The Citation Star',
    description: 'For exceptional sourcing, legal citation, and evidentiary rigor',
  },
  doctrine: {
    id: 'doctrine',
    icon: '🏛',
    label: 'The Doctrine Star',
    description: 'For original doctrinal synthesis or tracing legal evolution across cases',
  },
  diligence: {
    id: 'diligence',
    icon: '📋',
    label: 'The Diligence Star',
    description: 'For thorough, meticulous review work or exhaustive coverage',
  },
  clarity: {
    id: 'clarity',
    icon: '💡',
    label: 'The Clarity Star',
    description: 'For making complex legal concepts accessible without sacrificing accuracy',
  },
  detective: {
    id: 'detective',
    icon: '🔍',
    label: 'The Detective Star',
    description: 'For uncovering legal inconsistencies, errors, or overlooked precedents',
  },
} as const;

export type ScholarStarCategory = keyof typeof SCHOLAR_STAR_CATEGORIES;

// Endorsement weight multipliers by giver level.
// Adapted from X's Community Notes principle: "Not all raters are equal."
// A Senior Scholar's endorsement carries 4x the weight of a Reader's.
export const GIVER_LEVEL_MULTIPLIERS: Record<number, number> = {
  1: 0.5,   // Reader — reduced weight (limited platform experience)
  2: 1.0,   // Contributor — baseline
  3: 1.5,   // Recognized Contributor
  4: 2.0,   // Senior Scholar
  5: 2.5,   // Steward
  6: 2.5,   // Governance Council (same as Steward)
};
