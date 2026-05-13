'use client';

import React from 'react';
import SystemTooltip from '@/app/components/SystemTooltip';
import { QUALITY_TIERS, TIER_ORDER } from '@/app/actions/quality-constants';
import '@/app/system-visibility.css';

// ============================================================================
// SIDDHANT: ReviewPipeline → Scholarly Quality Standing
//
// Displays the article's quality classification within the institutional
// tier hierarchy: Draft → Developing → Useful → Solid → Trusted → Canonical
//
// NOT a progress bar — scholarship doesn't guarantee upward movement.
// A node may regress, become disputed, or fragment academically.
//
// Design: Institutional classification card, archival trust badge style.
// ============================================================================

interface ReviewPipelineProps {
  /** Current quality tier value (e.g., 'stub', 'b_class', 'good_article') */
  qualityTier: string;
  /** Whether there is an active review cycle */
  hasActiveReviewCycle: boolean;
  /** Number of community quality votes */
  totalQualityVotes: number;
  /** Date of last quality tier change (if known) */
  lastTierChangeDate?: string | null;
  /** Number of completed review cycles */
  completedReviewCycles: number;
}

// Institutional descriptions for each tier (longer form for the card)
const TIER_DESCRIPTIONS: Record<string, string> = {
  stub: 'Recently published content awaiting initial community assessment and scholarly development.',
  start: 'Contains meaningful analysis but requires further sourcing, expansion, or structural refinement.',
  c_class: 'Provides a useful foundation. Some gaps in coverage, sourcing, or legal precision remain.',
  b_class: 'Well-referenced and mostly complete. Eligible for formal peer review and quality nomination.',
  good_article: 'Independently reviewed by qualified peers. Meets institutional editorial standards for accuracy and citation.',
  featured: 'Definitive scholarly resource. Verified by multiple senior reviewers with comprehensive archival citations.',
};

export default function ReviewPipeline(props: ReviewPipelineProps) {
  const { qualityTier, hasActiveReviewCycle, totalQualityVotes, lastTierChangeDate, completedReviewCycles } = props;

  const currentTierIndex = TIER_ORDER.indexOf(qualityTier);
  const currentTier = QUALITY_TIERS[qualityTier] || QUALITY_TIERS.stub;
  const tierDescription = TIER_DESCRIPTIONS[qualityTier] || TIER_DESCRIPTIONS.stub;

  return (
    <div className="review-pipeline">
      <div className="review-pipeline-header">
        <span className="review-pipeline-label">Scholarly Standing</span>
        {hasActiveReviewCycle && (
          <span style={{
            fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: '#60a5fa',
            padding: '2px 8px', borderRadius: '4px',
            background: 'rgba(96, 165, 250, 0.1)', border: '1px solid rgba(96, 165, 250, 0.2)',
          }}>
            Under Review
          </span>
        )}
      </div>

      {/* Current Tier Card — The primary display */}
      <div className="scholarly-tier-card" style={{
        padding: '16px',
        borderRadius: '10px',
        background: currentTier.bg,
        border: `1px solid ${currentTier.border}`,
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontSize: '1.1rem' }}>{currentTier.icon}</span>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: '0.9rem',
            fontWeight: 800, color: currentTier.color,
          }}>
            {currentTier.label}
          </span>
        </div>
        <p style={{
          fontSize: '0.78rem', lineHeight: 1.6,
          color: 'var(--text-secondary)', margin: 0,
          fontFamily: 'var(--font-serif)', fontStyle: 'italic',
        }}>
          {tierDescription}
        </p>
      </div>

      {/* Tier Hierarchy — Compact classification strip, NOT a progress bar */}
      <div className="tier-classification-strip">
        {TIER_ORDER.map((tierKey, index) => {
          const tier = QUALITY_TIERS[tierKey];
          if (!tier) return null;

          const isCurrent = tierKey === qualityTier;
          const isPast = index < currentTierIndex;

          return (
            <SystemTooltip
              key={tierKey}
              title={tier.label}
              text={TIER_DESCRIPTIONS[tierKey] || tier.description}
            >
              <div
                className="tier-classification-item"
                style={{
                  opacity: isCurrent ? 1 : isPast ? 0.5 : 0.25,
                  borderBottom: isCurrent ? `2px solid ${tier.color}` : '2px solid transparent',
                  paddingBottom: '4px',
                }}
              >
                <span style={{
                  fontSize: '0.72rem', fontWeight: isCurrent ? 800 : 600,
                  color: isCurrent ? tier.color : 'var(--text-muted)',
                  cursor: 'help',
                }}>
                  {tier.icon} {tier.label}
                </span>
              </div>
            </SystemTooltip>
          );
        })}
      </div>

      {/* Contextual metadata — votes, review cycles */}
      {(totalQualityVotes > 0 || completedReviewCycles > 0 || lastTierChangeDate) && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '12px',
          marginTop: '10px', paddingTop: '8px',
          borderTop: '1px solid var(--border-subtle)',
        }}>
          {totalQualityVotes > 0 && (
            <span style={{
              fontSize: '0.65rem', fontWeight: 600,
              color: 'var(--text-muted)',
            }}>
              {totalQualityVotes} quality vote{totalQualityVotes !== 1 ? 's' : ''}
            </span>
          )}
          {completedReviewCycles > 0 && (
            <span style={{
              fontSize: '0.65rem', fontWeight: 600,
              color: 'var(--text-muted)',
            }}>
              {completedReviewCycles} review cycle{completedReviewCycles !== 1 ? 's' : ''}
            </span>
          )}
          {lastTierChangeDate && (
            <span style={{
              fontSize: '0.65rem', fontWeight: 600,
              color: 'var(--text-muted)',
            }}>
              Last assessed {new Date(lastTierChangeDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
