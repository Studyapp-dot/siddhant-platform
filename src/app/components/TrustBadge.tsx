'use client';

import React from 'react';
import SystemTooltip from '@/app/components/SystemTooltip';
import { TRUST_SIGNAL_TOOLTIPS } from '@/app/actions/trust-vocabulary';
import type { TrustBadgeType } from '@/app/actions/trust-vocabulary';
import '@/app/system-visibility.css';

// ============================================================================
// SIDDHANT: TrustBadge
//
// Standardized trust signal badges. Max 2–3 visible per surface.
// Each wraps a SystemTooltip for contextual explanation.
//
// Design: restrained, institutional. NOT gamified.
//
// NOTE: TrustBadgeType, getTopicTrustBadges, getProfileTrustBadges
// live in trust-vocabulary.ts so server components can use them.
// ============================================================================

interface TrustBadgeProps {
  type: TrustBadgeType;
}

const BADGE_KEY_MAP: Record<TrustBadgeType, string> = {
  'peer-reviewed': 'peer_reviewed',
  'community-verified': 'community_verified',
  'under-review': 'under_review',
  'trusted-contributor': 'trusted_contributor',
  'top-reviewer': 'top_reviewer',
};

export default function TrustBadge({ type }: TrustBadgeProps) {
  const vocabKey = BADGE_KEY_MAP[type];
  const config = TRUST_SIGNAL_TOOLTIPS[vocabKey];

  if (!config) return null;

  return (
    <SystemTooltip title={config.label} text={config.tooltip}>
      <span className={`trust-badge trust-badge--${type}`}>
        <span className="trust-badge-icon">{config.icon}</span>
        {config.label}
      </span>
    </SystemTooltip>
  );
}
