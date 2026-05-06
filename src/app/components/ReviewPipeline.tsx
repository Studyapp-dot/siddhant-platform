'use client';

import React from 'react';
import SystemTooltip from '@/app/components/SystemTooltip';
import { PIPELINE_STAGE_TOOLTIPS } from '@/app/actions/trust-vocabulary';
import '@/app/system-visibility.css';

// ============================================================================
// SIDDHANT: ReviewPipeline
//
// Visual pipeline showing the scholarly evolution of an article.
// NOT a progress bar — a living procedural record.
//
// Stages: Draft → Community Review → Peer Review → Consensus → Trusted
//
// Design: institutional serif labels, subtle connecting lines,
//         timestamps on completed stages, feels like a constitutional process.
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

interface PipelineStage {
  key: string;
  status: 'completed' | 'current' | 'future';
  detail?: string;
}

// Map quality tiers to pipeline position
function computeStages(props: ReviewPipelineProps): PipelineStage[] {
  const {
    qualityTier,
    hasActiveReviewCycle,
    totalQualityVotes,
    lastTierChangeDate,
    completedReviewCycles,
  } = props;

  const stages: PipelineStage[] = [];
  const tierOrder = ['stub', 'start', 'c_class', 'b_class', 'good_article', 'featured'];
  const tierIndex = tierOrder.indexOf(qualityTier);

  // Stage 1: Draft — completed for everything except stub with 0 votes
  if (tierIndex >= 1 || totalQualityVotes > 0) {
    stages.push({ key: 'draft', status: 'completed', detail: 'Content created' });
  } else {
    stages.push({ key: 'draft', status: 'current' });
  }

  // Stage 2: Community Review — completed if tier >= c_class, or if 3+ votes
  if (tierIndex >= 2 || totalQualityVotes >= 3) {
    stages.push({
      key: 'community_review',
      status: 'completed',
      detail: `${totalQualityVotes} vote${totalQualityVotes !== 1 ? 's' : ''} recorded`,
    });
  } else if (tierIndex >= 1 || totalQualityVotes > 0) {
    stages.push({
      key: 'community_review',
      status: 'current',
      detail: totalQualityVotes > 0
        ? `${totalQualityVotes} of 3 votes`
        : 'Awaiting votes',
    });
  } else {
    stages.push({ key: 'community_review', status: 'future' });
  }

  // Stage 3: Peer Review — completed if Good Article or Featured
  if (tierIndex >= 4) {
    stages.push({
      key: 'peer_review',
      status: 'completed',
      detail: `${completedReviewCycles} review cycle${completedReviewCycles !== 1 ? 's' : ''}`,
    });
  } else if (hasActiveReviewCycle || tierIndex === 3) {
    stages.push({
      key: 'peer_review',
      status: hasActiveReviewCycle ? 'current' : 'future',
      detail: hasActiveReviewCycle ? 'Cycle in progress' : 'Eligible for nomination',
    });
  } else {
    stages.push({ key: 'peer_review', status: 'future' });
  }

  // Stage 4: Consensus
  if (tierIndex >= 4 && completedReviewCycles > 0) {
    stages.push({
      key: 'consensus',
      status: 'completed',
      detail: lastTierChangeDate
        ? new Date(lastTierChangeDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'Reviewers agreed',
    });
  } else if (hasActiveReviewCycle) {
    stages.push({ key: 'consensus', status: 'future', detail: 'Pending review outcome' });
  } else {
    stages.push({ key: 'consensus', status: 'future' });
  }

  // Stage 5: Trusted
  if (tierIndex >= 4) {
    stages.push({
      key: 'trusted',
      status: tierIndex >= 5 ? 'completed' : 'current',
      detail: tierIndex >= 5 ? 'Definitive resource' : 'Meets editorial standards',
    });
  } else {
    stages.push({ key: 'trusted', status: 'future' });
  }

  return stages;
}

export default function ReviewPipeline(props: ReviewPipelineProps) {
  const stages = computeStages(props);

  return (
    <div className="review-pipeline">
      <div className="review-pipeline-header">
        <span className="review-pipeline-label">Scholarly Trust Pipeline</span>
      </div>

      <div className="review-pipeline-track">
        {stages.map((stage) => {
          const vocab = PIPELINE_STAGE_TOOLTIPS[stage.key];
          if (!vocab) return null;

          return (
            <SystemTooltip
              key={stage.key}
              title={vocab.label}
              text={vocab.tooltip}
            >
              <div className="review-pipeline-stage">
                <div className={`review-pipeline-marker ${stage.status}`}>
                  {stage.status === 'completed' ? '✓' : stage.status === 'current' ? '●' : '○'}
                </div>
                <span className={`review-pipeline-stage-label ${stage.status}`}>
                  {vocab.label}
                </span>
                {stage.detail && (
                  <span className="review-pipeline-stage-detail">
                    {stage.detail}
                  </span>
                )}
              </div>
            </SystemTooltip>
          );
        })}
      </div>
    </div>
  );
}
