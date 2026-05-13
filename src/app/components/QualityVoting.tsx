'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { castQualityVote, getQualityVoteSummary } from '@/app/actions/quality-voting';

// ============================================================================
// SIDDHANT: Quality Voting Component
//
// Community blind voting for lower quality tiers (Draft → Solid).
// Replaces the old QualityAssessment component for these tiers.
//
// Key principles:
//   - BLIND: Vote tallies are NOT shown before the user votes
//   - INDEPENDENT: Contributors cannot vote on their own nodes
//   - THRESHOLD: 3+ votes required for tier to move above Draft
//   - TRANSPARENT: After voting, user sees their vote + total count (not breakdown)
// ============================================================================

const TIER_OPTIONS = [
  { value: 'stub',    label: 'Draft',       description: 'Bare-bones, just created',              icon: '◇',  minLevel: 2 },
  { value: 'start',   label: 'Developing',  description: 'Some meaningful content, needs improvement', icon: '📋', minLevel: 2 },
  { value: 'c_class', label: 'Useful',      description: 'Useful to casual reader, gaps remain',  icon: '📖', minLevel: 2 },
  { value: 'b_class', label: 'Solid',       description: 'Mostly complete, well-referenced',      icon: '✓',  minLevel: 2 },
];

const ROLE_LEVELS: Record<string, number> = {
  reader: 1, contributor: 2, recognized: 3,
  senior_scholar: 4, steward: 5, governance_council: 6,
};

interface QualityVotingProps {
  nodeId: string;
  slug: string;
  currentTier: string;
  userRole: string | null;
  userId: string | null;
  latestRevisionId: string | null;
}

export default function QualityVoting({ nodeId, slug, currentTier, userRole, userId, latestRevisionId }: QualityVotingProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState('');
  const [justification, setJustification] = useState('');
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  // Vote summary state
  const [summary, setSummary] = useState<{
    totalVotes: number;
    userVote: string | null;
    userVoteRevisionId: string | null;
    breakdown: Record<string, number>;
  }>({ totalVotes: 0, userVote: null, userVoteRevisionId: null, breakdown: {} });
  const [summaryLoaded, setSummaryLoaded] = useState(false);

  const userLevel = userRole ? (ROLE_LEVELS[userRole] || 1) : 0;

  // Don't render for readers
  if (!userRole || userLevel < 2) return null;

  // Don't render for tiers that use peer review (Good Article, Featured)
  if (['good_article', 'featured'].includes(currentTier)) return null;

  // Load vote summary on mount
  useEffect(() => {
    loadSummary();
  }, [nodeId]);

  async function loadSummary() {
    const data = await getQualityVoteSummary(nodeId);
    setSummary(data);
    setSummaryLoaded(true);
  }

  // Check if user's vote is stale (voted on an older revision)
  const isUserVoteStale = summary.userVote && summary.userVoteRevisionId && latestRevisionId
    && summary.userVoteRevisionId !== latestRevisionId;

  const handleSubmit = () => {
    if (!selectedTier) return;
    setResult(null);
    startTransition(async () => {
      const res = await castQualityVote(nodeId, selectedTier, justification || undefined, slug);
      if (res.error) {
        setResult({ error: res.error });
      } else {
        setResult({ success: true });
        // Reload summary to reflect new vote
        await loadSummary();
        setTimeout(() => {
          setIsOpen(false);
          setSelectedTier('');
          setJustification('');
          setResult(null);
        }, 2000);
      }
    });
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setSelectedTier(summary.userVote || '');
        }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '5px 12px', borderRadius: '6px',
          fontSize: '0.68rem', fontWeight: 700,
          cursor: 'pointer',
          border: '1px solid var(--border-subtle)',
          background: summary.userVote ? 'rgba(34, 197, 94, 0.08)' : 'var(--bg-panel)',
          color: summary.userVote ? '#22c55e' : 'var(--text-muted)',
          transition: 'all 0.2s',
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
        }}
      >
        {summary.userVote ? '✓ Assessed' : '⚖ Assess Standing'}
        {summaryLoaded && summary.totalVotes > 0 && (
          <span style={{
            fontSize: '0.58rem', padding: '1px 5px', borderRadius: '4px',
            background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontWeight: 600,
          }}>
            {summary.totalVotes}
          </span>
        )}
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div style={{
            background: 'var(--bg-surface, #1a1a2e)',
            border: '1px solid var(--border-subtle, #333)',
            borderRadius: '16px',
            maxWidth: '500px', width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}>
            {/* Scrollable Content Area */}
            <div style={{ 
              padding: '1.5rem', 
              overflowY: 'auto',
              flex: 1,
            }}>
            {/* Header */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{
                fontSize: '1.2rem', fontWeight: 800,
                color: 'var(--text-primary, white)',
                fontFamily: 'var(--font-serif)', margin: 0,
              }}>
                Assess Scholarly Standing
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', margin: '6px 0 0 0' }}>
                {summary.userVote ? (
                  <>You previously voted: <strong style={{ color: 'var(--text-primary)' }}>{TIER_OPTIONS.find(t => t.value === summary.userVote)?.label || summary.userVote}</strong>. You can change your vote below.</>
                ) : (
                  <>What quality tier best describes this content?</>
                )}
              </p>
            </div>

            {/* Stale vote warning */}
            {isUserVoteStale && (
              <div style={{
                padding: '10px 14px', borderRadius: '10px', marginBottom: '1rem',
                background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)',
                fontSize: '0.78rem', color: '#f59e0b',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <span>⚠</span>
                <span>Your previous vote was cast on an earlier version. Consider reviewing the current content before voting.</span>
              </div>
            )}

            {/* Blind voting notice */}
            <div style={{
              padding: '12px 16px', borderRadius: '10px', marginBottom: '1.5rem',
              background: 'rgba(59, 130, 246, 0.06)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              fontSize: '0.78rem', lineHeight: 1.6,
              color: 'var(--text-secondary, #aaa)',
            }}>
              <strong>Blind voting:</strong> Other voters' choices are not shown to prevent herding.
              Vote based on your own assessment of the content's accuracy, completeness, and sourcing.
              {summary.totalVotes > 0 && summary.totalVotes < 3 && (
                <span style={{ display: 'block', marginTop: '4px', color: '#f59e0b' }}>
                  {Math.max(0, 3 - summary.totalVotes)} more vote{3 - summary.totalVotes !== 1 ? 's' : ''} needed for consensus.
                </span>
              )}
            </div>

            {/* Community Verdict Breakdown — only visible after user has voted */}
            {summary.userVote && Object.keys(summary.breakdown).length > 0 && (
              <div style={{
                padding: '12px 14px', borderRadius: '12px', marginBottom: '1.5rem',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}>
                <div style={{
                  fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase',
                  letterSpacing: '0.12em', color: 'var(--color-gold)', marginBottom: '12px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span>Community Verdict</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>{summary.totalVotes} total votes</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {TIER_OPTIONS.map(tier => {
                    const count = summary.breakdown[tier.value] || 0;
                    const isUserVote = summary.userVote === tier.value;
                    if (count === 0 && !isUserVote) return null;
                    
                    return (
                      <div key={tier.value} style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: isUserVote ? 'rgba(197, 160, 89, 0.08)' : 'rgba(0,0,0,0.2)',
                        border: isUserVote ? '1px solid var(--color-gold-soft)' : '1px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.8rem' }}>{tier.icon}</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isUserVote ? 'white' : 'var(--text-muted)' }}>
                            {tier.label}
                          </span>
                        </div>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 800, 
                          color: isUserVote ? 'var(--color-gold)' : 'white'
                        }}>
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tier Selection */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{
                fontSize: '0.7rem', fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: 'var(--text-muted, #888)',
                display: 'block', marginBottom: '10px',
              }}>
                Your Assessment
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {TIER_OPTIONS.map(tier => {
                  const disabled = userLevel < tier.minLevel;
                  return (
                    <button
                      key={tier.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => setSelectedTier(tier.value)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 12px', borderRadius: '10px',
                        border: selectedTier === tier.value
                          ? '2px solid var(--color-gold)'
                          : '1px solid var(--border-subtle, #333)',
                        background: selectedTier === tier.value
                          ? 'rgba(197, 160, 89, 0.08)'
                          : 'var(--bg-panel, #0d0d1a)',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.35 : 1,
                        textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: '0.9rem', width: '24px', textAlign: 'center' }}>{tier.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '0.8rem', fontWeight: 700,
                          color: 'var(--text-primary, white)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                          <span>{tier.label}</span>
                          {summary.userVote === tier.value && (
                            <span style={{ fontSize: '0.55rem', color: '#22c55e', textTransform: 'uppercase', fontWeight: 800 }}>
                              Current Vote
                            </span>
                          )}
                        </div>
                        <div style={{
                          fontSize: '0.68rem',
                          color: 'var(--text-muted, #888)',
                          lineHeight: 1.3,
                        }}>
                          {tier.description}
                          {disabled && (
                            <span style={{ color: '#ef4444', marginLeft: '6px', fontWeight: 600 }}>
                              (L{tier.minLevel}+)
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional justification */}
            {selectedTier && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  fontSize: '0.7rem', fontWeight: 800,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  color: 'var(--text-muted, #888)',
                  display: 'block', marginBottom: '8px',
                }}>
                  Justification <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                </label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Why does this content deserve this quality tier? (optional)"
                  rows={2}
                  style={{
                    width: '100%', padding: '12px',
                    borderRadius: '10px', border: '1px solid var(--border-subtle, #333)',
                    background: 'var(--bg-panel, #0d0d1a)',
                    color: 'var(--text-primary, white)',
                    fontSize: '0.85rem', lineHeight: 1.5,
                    fontFamily: 'var(--font-sans)',
                    resize: 'vertical', outline: 'none',
                  }}
                />
              </div>
            )}

            {/* Result messages */}
            {result?.error && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px', marginBottom: '1rem',
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444', fontSize: '0.8rem',
              }}>
                {result.error}
              </div>
            )}
            {result?.success && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px', marginBottom: '1rem',
                background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#22c55e', fontSize: '0.8rem', fontWeight: 600,
              }}>
                ✓ Vote recorded. The quality tier reflects the community consensus.
              </div>
            )}

            </div>

            {/* Sticky Actions Footer */}
            <div style={{ 
              display: 'flex', gap: '12px', justifyContent: 'flex-end',
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-subtle)',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <button
                type="button"
                onClick={() => { setIsOpen(false); setSelectedTier(''); setJustification(''); setResult(null); }}
                style={{
                  padding: '10px 20px', borderRadius: '10px',
                  border: '1px solid var(--border-subtle, #333)',
                  background: 'transparent',
                  color: 'var(--text-muted, #888)',
                  fontSize: '0.8rem', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || !selectedTier || !!result?.success}
                style={{
                  padding: '10px 24px', borderRadius: '10px',
                  border: 'none',
                  background: selectedTier && !isPending
                    ? 'linear-gradient(135deg, var(--color-gold), #d97706)'
                    : 'rgba(197, 160, 89, 0.2)',
                  color: selectedTier ? '#000' : '#666',
                  fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.05em',
                  cursor: isPending || !selectedTier ? 'not-allowed' : 'pointer',
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                {isPending ? 'Saving...' : summary.userVote ? 'Update Vote' : 'Submit Vote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
