// ============================================================================
// SIDDHANT: Trust Vocabulary — Centralized Platform Language
//
// Single source of truth for every trust-related term displayed to users.
// All tooltips, badges, drawers, and explanations pull from here.
//
// Design principle: institutional, not gamified.
// Every tooltip is ONE sentence, TWO lines maximum.
// ============================================================================

// ── Quality Tier Tooltips ──
// Short contextual explanations for each quality tier badge.
export const QUALITY_TIER_TOOLTIPS: Record<string, { label: string; tooltip: string }> = {
  stub: {
    label: 'Draft',
    tooltip: 'Recently created content awaiting community assessment.',
  },
  start: {
    label: 'Developing',
    tooltip: 'Contains meaningful content but requires further scholarly development.',
  },
  c_class: {
    label: 'Useful',
    tooltip: 'Useful foundation with some gaps in coverage or sourcing.',
  },
  b_class: {
    label: 'Solid',
    tooltip: 'Mostly complete and well-referenced, eligible for formal peer review.',
  },
  good_article: {
    label: 'Good Article',
    tooltip: 'Independently reviewed and meets editorial standards through structured peer assessment.',
  },
  featured: {
    label: 'Featured',
    tooltip: 'Definitive scholarly resource verified by multiple senior reviewers.',
  },
};

// ── Trust Signal Tooltips ──
// For TrustBadge components shown on articles and profiles.
export const TRUST_SIGNAL_TOOLTIPS: Record<string, { label: string; tooltip: string; icon: string }> = {
  peer_reviewed: {
    label: 'Peer Reviewed',
    icon: '✓✓',
    tooltip: 'Independently assessed by qualified reviewers using a structured rubric.',
  },
  community_verified: {
    label: 'Community Verified',
    icon: '👥',
    tooltip: 'Multiple contributors independently agree on this content\'s quality.',
  },
  under_review: {
    label: 'Under Review',
    icon: '📋',
    tooltip: 'Currently being assessed by independent reviewers.',
  },
  trusted_contributor: {
    label: 'Trusted Contributor',
    icon: '🛡',
    tooltip: 'Recognized for consistent, high-quality scholarly contributions.',
  },
  top_reviewer: {
    label: 'Active Reviewer',
    icon: '🔍',
    tooltip: 'Has completed multiple peer reviews, strengthening archive quality.',
  },
};

// ── Role Hierarchy Tooltips ──
// Short explanations for each level in the 6-tier hierarchy.
export const ROLE_TOOLTIPS: Record<string, { label: string; level: number; tooltip: string }> = {
  reader: {
    label: 'Reader',
    level: 1,
    tooltip: 'Can read all content and follow topics of interest.',
  },
  contributor: {
    label: 'Contributor',
    level: 2,
    tooltip: 'Can edit content, participate in discussions, and vote on quality.',
  },
  recognized: {
    label: 'Recognized Contributor',
    level: 3,
    tooltip: 'Eligible to nominate articles for peer review and assess quality tiers.',
  },
  senior_scholar: {
    label: 'Senior Scholar',
    level: 4,
    tooltip: 'Can conduct peer reviews and formally conclude review cycles.',
  },
  steward: {
    label: 'Steward',
    level: 5,
    tooltip: 'Editorial governance role with oversight of quality and review processes.',
  },
  governance_council: {
    label: 'Governance Council',
    level: 6,
    tooltip: 'Institutional leadership responsible for platform-wide policy and standards.',
  },
};

// ── Reputation Event Tooltips ──
// Short explanations for each reputation event type.
export const REPUTATION_EVENT_TOOLTIPS: Record<string, { label: string; tooltip: string }> = {
  edit_accepted_minor: {
    label: 'Minor edit accepted',
    tooltip: 'A small improvement you made was accepted into the archive.',
  },
  edit_accepted_substantive: {
    label: 'Substantive edit accepted',
    tooltip: 'A significant contribution you made was accepted into the archive.',
  },
  upvote_received: {
    label: 'Upvote received',
    tooltip: 'A community member found your discussion contribution valuable.',
  },
  endorsement_received: {
    label: 'Endorsement received',
    tooltip: 'A reader confirmed that your contribution helped their understanding.',
  },
  scholar_star_received: {
    label: 'Scholar Star received',
    tooltip: 'A peer recognized exceptional quality in your scholarly work.',
  },
  peer_review_completed: {
    label: 'Peer review completed',
    tooltip: 'You completed a structured assessment of content quality.',
  },
  peer_review_aligned: {
    label: 'Review aligned with consensus',
    tooltip: 'Your assessment matched the independent conclusions of other reviewers.',
  },
  discussion_cited: {
    label: 'Discussion cited',
    tooltip: 'Your discussion contribution was referenced by another scholar.',
  },
  flag_resolved: {
    label: 'Flag resolved',
    tooltip: 'An issue you identified was addressed and resolved.',
  },
  mentee_first_contribution: {
    label: 'Mentee contributed',
    tooltip: 'A scholar you mentored made their first contribution to the archive.',
  },
  tier_advancement_bonus: {
    label: 'Level advancement',
    tooltip: 'You advanced to a new level based on your scholarly record.',
  },
  group_post_created: {
    label: 'Community post',
    tooltip: 'You contributed a substantive discussion to a scholarly community.',
  },
  group_endorsement_received: {
    label: 'Community endorsement',
    tooltip: 'A community member endorsed your forum contribution.',
  },
  mentorship_accepted: {
    label: 'Mentorship accepted',
    tooltip: 'You accepted a mentorship request, guiding a new contributor.',
  },
  coordinator_promoted: {
    label: 'Community coordinator',
    tooltip: 'You were recognized as a coordinator of a scholarly community.',
  },
};

// ── Review Pipeline Stage Tooltips ──
// For the ReviewPipeline visualization component.
export const PIPELINE_STAGE_TOOLTIPS: Record<string, { label: string; tooltip: string }> = {
  draft: {
    label: 'Draft',
    tooltip: 'Content has been created and is open for community contribution.',
  },
  community_review: {
    label: 'Community Review',
    tooltip: 'Contributors independently assess quality through blind voting.',
  },
  peer_review: {
    label: 'Peer Review',
    tooltip: 'Qualified reviewers evaluate content against a structured rubric.',
  },
  consensus: {
    label: 'Consensus',
    tooltip: 'Independent reviewers have reached agreement on content quality.',
  },
  trusted: {
    label: 'Trusted',
    tooltip: 'Content has been verified through the full scholarly review process.',
  },
};

// ── Reputation Score Tooltip ──
export const REPUTATION_SCORE_TOOLTIP =
  'Earned through accepted contributions, peer reviews, and community recognition.';

// ── Level Progress Institutional Phrases ──
// Non-gamified language for level progression context.
export const LEVEL_PROGRESS_PHRASES: Record<string, { eligible: string; working: string }> = {
  recognized: {
    eligible: 'You are now eligible to nominate articles for peer review.',
    working: 'Continue contributing to become eligible for peer review participation.',
  },
  senior_scholar: {
    eligible: 'You are now eligible to conduct formal peer reviews.',
    working: 'Continue contributing to become eligible for formal peer review.',
  },
  steward: {
    eligible: 'You hold editorial governance responsibilities.',
    working: 'Steward designation is determined through community recognition.',
  },
};

// ── Trust Badge Types & Helpers ──
// These are pure functions usable from both server and client components.

export type TrustBadgeType =
  | 'peer-reviewed'
  | 'community-verified'
  | 'under-review'
  | 'trusted-contributor'
  | 'top-reviewer';

// Compute which badges to show for a topic (max 2–3). Avoids signal dilution.
export function getTopicTrustBadges(opts: {
  qualityTier: string;
  hasActiveReviewCycle: boolean;
  totalQualityVotes: number;
}): TrustBadgeType[] {
  const badges: TrustBadgeType[] = [];

  if (opts.hasActiveReviewCycle) {
    badges.push('under-review');
  }

  if (opts.qualityTier === 'good_article' || opts.qualityTier === 'featured') {
    badges.push('peer-reviewed');
  }

  if (
    !['good_article', 'featured'].includes(opts.qualityTier) &&
    opts.totalQualityVotes >= 3
  ) {
    badges.push('community-verified');
  }

  return badges.slice(0, 3);
}

// Compute which badges to show for a profile (max 2–3).
export function getProfileTrustBadges(opts: {
  role: string;
  peerReviewsCompleted: number;
}): TrustBadgeType[] {
  const badges: TrustBadgeType[] = [];
  const ROLE_LEVELS: Record<string, number> = {
    reader: 1, contributor: 2, recognized: 3,
    senior_scholar: 4, steward: 5, governance_council: 6,
  };

  const level = ROLE_LEVELS[opts.role] || 1;

  if (level >= 3) {
    badges.push('trusted-contributor');
  }

  if (opts.peerReviewsCompleted >= 5) {
    badges.push('top-reviewer');
  }

  return badges.slice(0, 3);
}
