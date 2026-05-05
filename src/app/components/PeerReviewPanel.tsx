'use client';

import React, { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import {
  REVIEW_CRITERIA, SCORE_LABELS, RECOMMENDATIONS, CONFIDENCE_LEVELS,
  REVIEW_CONFIG, OUTCOME_CONFIG, RUBRIC_VERSION,
} from '@/app/actions/peer-review-constants';
import type { CriterionKey, Recommendation, Confidence, ReviewableTier } from '@/app/actions/peer-review-constants';
import { initiateReviewCycle, initiateChallengeCycle, submitPeerReview, concludeReviewCycle, getReviewCycles, getReviewDetails } from '@/app/actions/peer-review';

// ============================================================================
// SIDDHANT: Peer Review Panel
//
// Renders on topic pages for nodes at Solid or Good Article tier.
// Provides the complete peer review workflow:
//   - Nomination (initiate a review cycle)
//   - Structured rubric review (6 criteria × 1-5 scale + recommendation)
//   - Waiting state (cycle open, user already reviewed)
//   - Results with alignment feedback (cycle closed)
//   - Review cycle history
// ============================================================================

const ROLE_LEVELS: Record<string, number> = {
  reader: 1, contributor: 2, recognized: 3,
  senior_scholar: 4, steward: 5, governance_council: 6,
};

const ROLE_LABELS: Record<string, string> = {
  reader: 'Reader', contributor: 'Contributor', recognized: 'Recognized Contributor',
  senior_scholar: 'Senior Scholar', steward: 'Steward', governance_council: 'Governance Council',
};

interface PeerReviewPanelProps {
  nodeId: string;
  slug: string;
  currentTier: string;
  userRole: string | null;
  userId: string | null;
  latestRevisionId: string | null;
}

export default function PeerReviewPanel({ nodeId, slug, currentTier, userRole, userId, latestRevisionId }: PeerReviewPanelProps) {
  const [cycles, setCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCycleId, setExpandedCycleId] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<any>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Review form state
  const [criteriaScores, setCriteriaScores] = useState<Record<string, { score: number; comment: string }>>({});
  const [recommendation, setRecommendation] = useState<Recommendation | ''>('');
  const [confidence, setConfidence] = useState<Confidence>('high');
  const [overallComment, setOverallComment] = useState('');
  const [consensusSummary, setConsensusSummary] = useState('');
  const [showConcludeForm, setShowConcludeForm] = useState(false);

  const userLevel = userRole ? (ROLE_LEVELS[userRole] || 1) : 0;

  // Determine which tier can be nominated for advancement
  const getTargetTier = (): ReviewableTier | null => {
    if (currentTier === 'b_class') return 'good_article';
    if (currentTier === 'good_article') return 'featured';
    return null;
  };

  // Determine if the current tier can be challenged (re-reviewed)
  const getChallengeableTier = (): ReviewableTier | null => {
    if (currentTier === 'good_article') return 'good_article';
    if (currentTier === 'featured') return 'featured';
    return null;
  };

  const targetTier = getTargetTier();
  const targetConfig = targetTier ? REVIEW_CONFIG[targetTier] : null;
  const challengeableTier = getChallengeableTier();
  const challengeConfig = challengeableTier ? REVIEW_CONFIG[challengeableTier] : null;

  // Render if node can be nominated for advancement OR challenged
  if (!targetTier && !challengeableTier) return null;

  // Load cycles on mount
  useEffect(() => {
    loadCycles();
  }, [nodeId]);

  async function loadCycles() {
    setLoading(true);
    const data = await getReviewCycles(nodeId);
    setCycles(data);
    setLoading(false);
  }

  const activeCycle = cycles.find((c: any) => c.status === 'open' || c.status === 'awaiting_conclusion');
  const closedCycles = cycles.filter((c: any) => c.status === 'closed');
  const isAwaitingConclusion = activeCycle?.status === 'awaiting_conclusion';

  // ---- Handlers ----

  function handleNominate() {
    if (!targetTier) return;
    setMessage(null);
    startTransition(async () => {
      const result = await initiateReviewCycle(nodeId, targetTier, slug);
      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: 'Review cycle opened! Independent reviewers can now submit their assessments.' });
        await loadCycles();
      }
    });
  }

  function handleChallenge() {
    if (!challengeableTier) return;
    setMessage(null);
    startTransition(async () => {
      const result = await initiateChallengeCycle(nodeId, challengeableTier, slug);
      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: 'Quality challenge opened! Reviewers will evaluate whether this content still meets the standard.' });
        await loadCycles();
      }
    });
  }

  function handleSetScore(criterionKey: string, score: number) {
    setCriteriaScores(prev => ({
      ...prev,
      [criterionKey]: { ...prev[criterionKey], score, comment: prev[criterionKey]?.comment || '' },
    }));
  }

  function handleSetCriterionComment(criterionKey: string, comment: string) {
    setCriteriaScores(prev => ({
      ...prev,
      [criterionKey]: { ...prev[criterionKey], score: prev[criterionKey]?.score || 0, comment },
    }));
  }

  function handleSubmitReview() {
    if (!activeCycle || !recommendation) return;
    setMessage(null);
    startTransition(async () => {
      const result = await submitPeerReview(
        activeCycle.id,
        criteriaScores as Record<CriterionKey, { score: number; comment?: string }>,
        recommendation as Recommendation,
        confidence,
        overallComment,
        slug,
      );
      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: 'Review submitted successfully! Thank you for strengthening the quality of this content.' });
        setShowReviewForm(false);
        setCriteriaScores({});
        setRecommendation('');
        setOverallComment('');
        await loadCycles();
      }
    });
  }

  async function toggleCycleDetails(cycleId: string) {
    if (expandedCycleId === cycleId) {
      setExpandedCycleId(null);
      setExpandedDetails(null);
      return;
    }
    setExpandedCycleId(cycleId);
    const details = await getReviewDetails(cycleId);
    setExpandedDetails(details);
  }

  // Check if all criteria are scored
  const allCriteriaScored = REVIEW_CRITERIA.every(c => {
    const entry = criteriaScores[c.key];
    return entry && entry.score >= 1 && entry.score <= 5;
  });
  const canSubmit = allCriteriaScored && recommendation && overallComment.trim().length >= 20;

  // ---- Render ----

  return (
    <section className="peer-review-panel" id="peer-review-panel">
      <div className="pr-header">
        <div className="pr-header-left">
          <span className="pr-icon">📋</span>
          <div>
            <h3 className="pr-title">Peer Review</h3>
            <p className="pr-subtitle">
              Structured assessment for {targetConfig?.label} advancement
            </p>
          </div>
        </div>
        <span className="pr-rubric-badge">Rubric {RUBRIC_VERSION}</span>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`pr-message pr-message-${message.type}`}>
          <span>{message.type === 'success' ? '✓' : '✗'}</span>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="pr-message-close">×</button>
        </div>
      )}

      {loading ? (
        <div className="pr-loading">
          <span className="pr-loading-dot"></span>
          <span>Loading review cycles...</span>
        </div>
      ) : (
        <>
          {/* ============================================ */}
          {/* STATE: No active cycle — Show nomination UI  */}
          {/* ============================================ */}
          {!activeCycle && !showReviewForm && (
            <div className="pr-nomination-section">
              <div className="pr-nomination-info">
                {targetTier && (
                  <p className="pr-nomination-text">
                    {currentTier === 'b_class' ? (
                      <>This node is at <strong>Solid</strong> tier. It can be nominated for <strong>Good Article</strong> peer review — requiring 1 independent Recognized Contributor (L3+) to verify content quality against our structured rubric.</>
                    ) : currentTier === 'good_article' ? (
                      <>This node is a <strong>Good Article</strong>. It can be nominated for <strong>Featured</strong> peer review — requiring 2 independent Senior Scholars (L4+) to reach consensus.</>
                    ) : null}
                  </p>
                )}
                {!targetTier && challengeableTier && (
                  <p className="pr-nomination-text">
                    This node is at <strong>{challengeConfig?.label}</strong> tier. If you believe the content no longer meets this standard, you can open a quality challenge.
                  </p>
                )}
              </div>
              {userId ? (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Advancement nomination button */}
                  {targetTier && (
                    <button
                      onClick={handleNominate}
                      disabled={isPending || userLevel < (targetTier === 'good_article' ? 2 : 3)}
                      className="pr-nominate-btn"
                    >
                      {isPending ? 'Opening cycle...' : (
                        <>Nominate for {targetConfig?.label} Review</>
                      )}
                    </button>
                  )}
                  {/* Challenge button */}
                  {challengeableTier && (
                    <button
                      onClick={handleChallenge}
                      disabled={isPending || userLevel < (challengeConfig?.minReviewerLevel || 99)}
                      className="pr-nominate-btn"
                      style={{ background: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                    >
                      {isPending ? 'Opening challenge...' : (
                        <>⚠ Challenge {challengeConfig?.label} Status</>
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <p className="pr-login-prompt">
                  <Link href="/login" style={{ color: 'var(--color-gold)' }}>Sign in</Link> to nominate this node for review.
                </p>
              )}
              {userId && targetTier && userLevel < (targetTier === 'good_article' ? 2 : 3) && (
                <p className="pr-level-hint">
                  Level {targetTier === 'good_article' ? '2' : '3'}+ required to nominate
                </p>
              )}
              {userId && challengeableTier && !targetTier && userLevel < (challengeConfig?.minReviewerLevel || 99) && (
                <p className="pr-level-hint">
                  Level {challengeConfig?.minReviewerLevel}+ required to challenge
                </p>
              )}
            </div>
          )}

          {/* ============================================ */}
          {/* STATE: Active cycle — Show review form or    */}
          {/*        waiting state                         */}
          {/* ============================================ */}
          {activeCycle && (
            <div className="pr-active-cycle">
              <div className="pr-cycle-status-bar" style={activeCycle.cycle_type === 'challenge' ? { borderColor: 'rgba(239, 68, 68, 0.3)' } : isAwaitingConclusion ? { borderColor: 'rgba(167, 139, 250, 0.3)' } : undefined}>
                <div className="pr-cycle-status-left">
                  <span className={`pr-cycle-status-dot ${isAwaitingConclusion ? 'awaiting' : 'open'}`} style={activeCycle.cycle_type === 'challenge' ? { background: '#ef4444', boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)' } : isAwaitingConclusion ? { background: '#a78bfa', boxShadow: '0 0 8px rgba(167, 139, 250, 0.4)' } : undefined}></span>
                  <span className="pr-cycle-status-text">
                    {isAwaitingConclusion ? (
                      <>Awaiting formal conclusion for <strong>{REVIEW_CONFIG[activeCycle.target_tier as ReviewableTier]?.label || activeCycle.target_tier}</strong></>
                    ) : activeCycle.cycle_type === 'challenge' ? (
                      <>Quality challenge open for <strong>{REVIEW_CONFIG[activeCycle.target_tier as ReviewableTier]?.label || activeCycle.target_tier}</strong></>
                    ) : (
                      <>Review cycle open for <strong>{REVIEW_CONFIG[activeCycle.target_tier as ReviewableTier]?.label || activeCycle.target_tier}</strong></>
                    )}
                  </span>
                </div>
                <span className="pr-cycle-review-count">
                  {activeCycle.review_count} of {activeCycle.min_reviews} review{activeCycle.min_reviews !== 1 ? 's' : ''} submitted
                </span>
              </div>

              {/* Content-changed warning */}
              {activeCycle.snapshot_revision_id && latestRevisionId &&
                activeCycle.snapshot_revision_id !== latestRevisionId && (
                <div className="pr-message pr-message-error" style={{ margin: '0', borderRadius: '0', borderTop: '1px solid rgba(245, 158, 11, 0.25)', background: 'rgba(245, 158, 11, 0.06)', borderColor: 'rgba(245, 158, 11, 0.25)', color: '#f59e0b' }}>
                  <span>⚠</span>
                  <span>Content has been edited since this review cycle was opened. Reviewers should verify the current content still matches their assessment.</span>
                </div>
              )}

              {/* AWAITING CONCLUSION STATE — Senior Scholar must formally conclude */}
              {isAwaitingConclusion && (
                <div className="pr-message" style={{ margin: '0', borderRadius: '0', borderTop: '1px solid rgba(167, 139, 250, 0.25)', background: 'rgba(167, 139, 250, 0.06)', color: '#a78bfa' }}>
                  <span>📋</span>
                  <span>This review cycle has received the required reviews. A <strong>Senior Scholar (L4+)</strong> who did not participate must now review the assessments and formally record the consensus.</span>
                </div>
              )}

              {/* Conclude Review form — L4+ only, not a reviewer or contributor */}
              {isAwaitingConclusion && userId && userLevel >= 4 && !showConcludeForm && (
                <button
                  onClick={() => setShowConcludeForm(true)}
                  className="pr-submit-review-btn"
                  style={{ background: 'linear-gradient(135deg, #a78bfa, #7c3aed)' }}
                >
                  Record Consensus & Conclude
                </button>
              )}

              {isAwaitingConclusion && showConcludeForm && (
                <div className="pr-review-form" style={{ borderColor: 'rgba(167, 139, 250, 0.2)' }}>
                  <div className="pr-form-header">
                    <h4 className="pr-form-title">Conclude Review Cycle</h4>
                    <p className="pr-form-desc">
                      Read the peer reviews above, then summarize the consensus. Explain what the reviewers found and why the outcome is justified. You must not have participated in this review.
                    </p>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                      Consensus Summary *
                    </label>
                    <textarea
                      value={consensusSummary}
                      onChange={(e) => setConsensusSummary(e.target.value)}
                      placeholder="Summarize the reviewers' findings and the rationale for the outcome. What arguments were persuasive? What criteria were or were not met?"
                      rows={4}
                      style={{
                        width: '100%', padding: '12px', borderRadius: '10px',
                        border: '1px solid var(--border-subtle)', background: 'var(--bg-panel)',
                        color: 'var(--text-primary)', fontSize: '0.85rem', lineHeight: 1.5,
                        fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none',
                      }}
                    />
                    <div style={{ fontSize: '0.6rem', marginTop: '4px', color: consensusSummary.trim().length >= 50 ? '#22c55e' : 'var(--text-muted)' }}>
                      {consensusSummary.trim().length >= 50 ? '✓ Minimum met' : `${consensusSummary.trim().length}/50 characters minimum`}
                    </div>
                  </div>
                  <div className="pr-form-actions">
                    <button type="button" onClick={() => { setShowConcludeForm(false); setConsensusSummary(''); setMessage(null); }} className="pr-cancel-btn">Cancel</button>
                    <button
                      type="button"
                      disabled={isPending || consensusSummary.trim().length < 50}
                      className="pr-submit-btn"
                      style={{ background: consensusSummary.trim().length >= 50 ? 'linear-gradient(135deg, #a78bfa, #7c3aed)' : undefined }}
                      onClick={() => {
                        setMessage(null);
                        startTransition(async () => {
                          const result = await concludeReviewCycle(activeCycle.id, consensusSummary, slug);
                          if (result.error) {
                            setMessage({ type: 'error', text: result.error });
                          } else {
                            setMessage({ type: 'success', text: 'Review cycle concluded. The consensus has been formally recorded.' });
                            setShowConcludeForm(false);
                            setConsensusSummary('');
                            await loadCycles();
                          }
                        });
                      }}
                    >
                      {isPending ? 'Concluding...' : 'Conclude & Record Consensus'}
                    </button>
                  </div>
                </div>
              )}

              {/* Show review form if user is eligible to review (only when cycle is still open, not awaiting_conclusion) */}
              {(() => {
                if (isAwaitingConclusion) return null; // Reviews are done, awaiting conclusion
                const activeCycleConfig = activeCycle?.target_tier ? REVIEW_CONFIG[activeCycle.target_tier as ReviewableTier] : null;
                const requiredLevel = activeCycleConfig?.minReviewerLevel || 99;
                return !showReviewForm && userId && userLevel >= requiredLevel && (
                  <button
                    onClick={() => setShowReviewForm(true)}
                    className="pr-submit-review-btn"
                  >
                    Submit Your Review
                  </button>
                );
              })()}

              {/* The structured review form */}
              {showReviewForm && (
                <div className="pr-review-form">
                  <div className="pr-form-header">
                    <h4 className="pr-form-title">Structured Review — {REVIEW_CONFIG[activeCycle?.target_tier as ReviewableTier]?.label || targetConfig?.label}</h4>
                    <p className="pr-form-desc">
                      Assess each criterion on a 1–5 scale. Your scores, along with your overall recommendation, determine whether this node meets the standard for {REVIEW_CONFIG[activeCycle?.target_tier as ReviewableTier]?.label || targetConfig?.label}.
                    </p>
                  </div>

                  {/* 6 Criteria */}
                  <div className="pr-criteria-list">
                    {REVIEW_CRITERIA.map((criterion, idx) => {
                      const currentScore = criteriaScores[criterion.key]?.score || 0;
                      return (
                        <div key={criterion.key} className="pr-criterion">
                          <div className="pr-criterion-header">
                            <span className="pr-criterion-number">{idx + 1}</span>
                            <div className="pr-criterion-info">
                              <span className="pr-criterion-label">
                                {criterion.label}
                                {criterion.requiresLegalReasoning && (
                                  <span className="pr-legal-badge" title="Requires legal reasoning">⚖</span>
                                )}
                              </span>
                              <p className="pr-criterion-desc">{criterion.description}</p>
                            </div>
                          </div>

                          {/* Score dots (1-5) */}
                          <div className="pr-score-row">
                            {[1, 2, 3, 4, 5].map(score => (
                              <button
                                key={score}
                                type="button"
                                onClick={() => handleSetScore(criterion.key, score)}
                                className={`pr-score-dot ${currentScore === score ? 'active' : ''} ${currentScore === score ? `score-${score}` : ''}`}
                                title={SCORE_LABELS[score]?.label}
                              >
                                <span className="pr-score-number">{score}</span>
                                <span className="pr-score-label">{SCORE_LABELS[score]?.label}</span>
                              </button>
                            ))}
                          </div>

                          {/* Optional criterion comment */}
                          {currentScore > 0 && (
                            <textarea
                              value={criteriaScores[criterion.key]?.comment || ''}
                              onChange={(e) => handleSetCriterionComment(criterion.key, e.target.value)}
                              placeholder={`Optional: explain your ${SCORE_LABELS[currentScore]?.label?.toLowerCase()} rating...`}
                              rows={2}
                              className="pr-criterion-comment"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Overall Recommendation */}
                  <div className="pr-form-section">
                    <label className="pr-form-label">Overall Recommendation *</label>
                    <div className="pr-recommendation-grid">
                      {RECOMMENDATIONS.map(rec => (
                        <button
                          key={rec.value}
                          type="button"
                          onClick={() => setRecommendation(rec.value)}
                          className={`pr-rec-btn ${recommendation === rec.value ? 'active' : ''}`}
                          style={{
                            borderColor: recommendation === rec.value ? rec.color : undefined,
                            background: recommendation === rec.value ? `${rec.color}12` : undefined,
                          }}
                        >
                          <span className="pr-rec-icon" style={{ color: rec.color }}>{rec.icon}</span>
                          <div>
                            <span className="pr-rec-label" style={{ color: recommendation === rec.value ? rec.color : undefined }}>
                              {rec.label}
                            </span>
                            <span className="pr-rec-desc">{rec.description}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Confidence */}
                  <div className="pr-form-section">
                    <label className="pr-form-label">Confidence</label>
                    <div className="pr-confidence-row">
                      {CONFIDENCE_LEVELS.map(conf => (
                        <button
                          key={conf.value}
                          type="button"
                          onClick={() => setConfidence(conf.value)}
                          className={`pr-conf-btn ${confidence === conf.value ? 'active' : ''}`}
                          style={{
                            borderColor: confidence === conf.value ? conf.color : undefined,
                            color: confidence === conf.value ? conf.color : undefined,
                          }}
                        >
                          {conf.label}
                        </button>
                      ))}
                    </div>
                    {confidence === 'low' && (
                      <p className="pr-confidence-warning">
                        Low confidence will request an additional reviewer before the cycle closes.
                      </p>
                    )}
                  </div>

                  {/* Overall Comment */}
                  <div className="pr-form-section">
                    <label className="pr-form-label">Overall Comment *</label>
                    <textarea
                      value={overallComment}
                      onChange={(e) => setOverallComment(e.target.value)}
                      placeholder="Summarize your assessment. What are the content's key strengths? What specific improvements would you recommend? (min 20 characters)"
                      rows={4}
                      className="pr-overall-comment"
                    />
                    <div className="pr-char-count" style={{
                      color: overallComment.trim().length >= 20 ? '#22c55e' : 'var(--text-muted)',
                    }}>
                      {overallComment.trim().length >= 20 ? '✓ Minimum met' : `${overallComment.trim().length}/20 characters`}
                    </div>
                  </div>

                  {/* Submit */}
                  <div className="pr-form-actions">
                    <button
                      type="button"
                      onClick={() => { setShowReviewForm(false); setMessage(null); }}
                      className="pr-cancel-btn"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitReview}
                      disabled={isPending || !canSubmit}
                      className="pr-submit-btn"
                    >
                      {isPending ? 'Submitting...' : 'Submit Review'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================ */}
          {/* Review Cycle History                         */}
          {/* ============================================ */}
          {closedCycles.length > 0 && (
            <div className="pr-history">
              <h4 className="pr-history-title">Review History</h4>
              <div className="pr-history-list">
                {closedCycles.map((cycle: any) => {
                  const outcomeConfig = OUTCOME_CONFIG[cycle.outcome] || OUTCOME_CONFIG.maintained;
                  const initiatorData = Array.isArray(cycle.profiles) ? cycle.profiles[0] : cycle.profiles;
                  const isExpanded = expandedCycleId === cycle.id;
                  const tierLabel = REVIEW_CONFIG[cycle.target_tier as ReviewableTier]?.label || cycle.target_tier;

                  return (
                    <div key={cycle.id} className="pr-history-item">
                      <button
                        type="button"
                        className="pr-history-item-header"
                        onClick={() => toggleCycleDetails(cycle.id)}
                      >
                        <div className="pr-history-item-left">
                          <span className="pr-outcome-badge" style={{
                            color: outcomeConfig.color,
                            background: outcomeConfig.bg,
                          }}>
                            {outcomeConfig.icon} {outcomeConfig.label}
                          </span>
                          <span className="pr-history-tier">{tierLabel} Review</span>
                        </div>
                        <div className="pr-history-item-right">
                          <span className="pr-history-date">
                            {new Date(cycle.closed_at || cycle.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="pr-history-count">{cycle.review_count} review{cycle.review_count !== 1 ? 's' : ''}</span>
                          <span className={`pr-expand-icon ${isExpanded ? 'expanded' : ''}`}>▸</span>
                        </div>
                      </button>

                      {/* Expanded details */}
                      {isExpanded && expandedDetails && (
                        <div className="pr-history-details">
                          {/* Result summary */}
                          {cycle.result_summary && (
                            <div className="pr-result-summary">
                              <p>{cycle.result_summary}</p>
                            </div>
                          )}

                          {/* Individual reviews */}
                          {expandedDetails.reviews?.map((review: any) => {
                            const reviewerData = Array.isArray(review.profiles) ? review.profiles[0] : review.profiles;
                            const recConfig = RECOMMENDATIONS.find(r => r.value === review.recommendation);
                            const isOwnReview = review.reviewer_id === expandedDetails.currentUserId ||
                              (reviewerData && userId && review.profiles?.username);

                            return (
                              <div key={review.id} className="pr-review-card">
                                <div className="pr-review-card-header">
                                  <div className="pr-reviewer-info">
                                    <Link
                                      href={`/profile/${reviewerData?.username}`}
                                      className="pr-reviewer-name"
                                    >
                                      @{reviewerData?.username}
                                    </Link>
                                    <span className="pr-reviewer-role">
                                      {ROLE_LABELS[reviewerData?.role] || reviewerData?.role}
                                    </span>
                                  </div>
                                  <div className="pr-review-meta">
                                    <span className="pr-rec-pill" style={{
                                      color: recConfig?.color,
                                      background: `${recConfig?.color}15`,
                                      borderColor: `${recConfig?.color}30`,
                                    }}>
                                      {recConfig?.icon} {recConfig?.label}
                                    </span>
                                    {review.aligned_with_outcome !== null && (
                                      <span className={`pr-alignment-badge ${review.aligned_with_outcome ? 'aligned' : 'diverged'}`}>
                                        {review.aligned_with_outcome ? '✓ Aligned' : '↗ Diverged'}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Criteria scores */}
                                <div className="pr-review-scores">
                                  {REVIEW_CRITERIA.map(criterion => {
                                    const entry = review.criteria_scores?.[criterion.key];
                                    const score = entry?.score || entry;
                                    const scoreNum = typeof score === 'number' ? score : parseInt(score) || 0;
                                    const scoreConfig = SCORE_LABELS[scoreNum];
                                    return (
                                      <div key={criterion.key} className="pr-score-display">
                                        <span className="pr-score-criterion-label">{criterion.label}</span>
                                        <div className="pr-score-bar-container">
                                          <div
                                            className="pr-score-bar"
                                            style={{
                                              width: `${(scoreNum / 5) * 100}%`,
                                              background: scoreConfig?.color || '#666',
                                            }}
                                          />
                                        </div>
                                        <span className="pr-score-value" style={{ color: scoreConfig?.color }}>
                                          {scoreNum}/5
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Comment */}
                                {review.overall_comment && (
                                  <div className="pr-review-comment">
                                    <p>&ldquo;{review.overall_comment}&rdquo;</p>
                                  </div>
                                )}

                                <div className="pr-review-footer">
                                  <span className="pr-review-date">
                                    {new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </span>
                                  <span className="pr-review-confidence">
                                    {review.confidence} confidence
                                  </span>
                                </div>
                              </div>
                            );
                          })}

                          {/* Initiator */}
                          {initiatorData && (
                            <div className="pr-initiated-by">
                              Cycle initiated by{' '}
                              <Link href={`/profile/${initiatorData.username}`} className="pr-initiator-link">
                                @{initiatorData.username}
                              </Link>
                              {' · '}{new Date(cycle.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
