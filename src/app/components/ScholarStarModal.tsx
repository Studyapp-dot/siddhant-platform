'use client';

import React, { useState, useTransition } from 'react';
import { awardScholarStar } from '@/app/actions/contributions';
import { SCHOLAR_STAR_CATEGORIES, ROLE_LABELS } from '@/app/actions/reputation-constants';
import type { ScholarStarCategory } from '@/app/actions/reputation-constants';

/**
 * Scholar Star Award Button & Modal
 * Siddhant's equivalent of Wikipedia's Barnstars — adapted for legal scholarship.
 *
 * Five named categories:
 *   ⚖️ Citation Star    — exceptional sourcing and legal citation
 *   🏛 Doctrine Star    — original doctrinal synthesis
 *   📋 Diligence Star   — thorough, meticulous review
 *   💡 Clarity Star     — making complex law accessible
 *   🔍 Detective Star   — uncovering inconsistencies or precedents
 *
 * Anti-farming:
 *   - 50+ character written reason (non-negotiable)
 *   - 1 star per giver → recipient per 30 days
 *   - Category selection required (not generic)
 *   - Written reason appears on recipient's profile (public socialization signal)
 *   - Level Gate: L2+ (Contributor) minimum to award
 */
export default function ScholarStarModal({
  recipientId,
  recipientUsername,
  sourceId,
  sourceType,
  currentUserRole
}: {
  recipientId: string;
  recipientUsername: string;
  sourceId?: string;
  sourceType?: 'revision' | 'discussion' | 'peer_review' | 'mentoring' | 'other';
  currentUserRole?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ScholarStarCategory | null>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  const currentUserLevel = currentUserRole ? (ROLE_LABELS[currentUserRole]?.level || 1) : 1;
  const isL2Plus = currentUserLevel >= 2;

  const handleSubmit = () => {
    if (!selectedCategory) return;
    startTransition(async () => {
      const res = await awardScholarStar(recipientId, reason, selectedCategory, sourceId, sourceType);
      if (res.error) {
        setResult({ error: res.error });
      } else {
        setResult({ success: true });
        setTimeout(() => {
          setIsOpen(false);
          setReason('');
          setSelectedCategory(null);
          setResult(null);
        }, 2500);
      }
    });
  };

  const categories = Object.values(SCHOLAR_STAR_CATEGORIES);
  const canSubmit = selectedCategory && reason.trim().length >= 50 && !isPending && !result?.success;

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`recognition-btn star-btn ${!isL2Plus ? 'locked' : ''}`}
        title={isL2Plus ? "Award a Scholar Star for exceptional contribution" : "Level 2 (Contributor) required to award Scholar Stars"}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="recognition-icon">⭐</span>
          <span className="recognition-label">Scholar Star</span>
          {!isL2Plus && (
            <span style={{ fontSize: '0.6rem', padding: '2px 6px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '4px', fontWeight: 800 }}>L2+ REQ</span>
          )}
        </div>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
            animation: 'fadeIn 0.25s ease',
          }}
        >
          <div style={{
            background: 'var(--bg-surface, #1a1a2e)',
            border: '1px solid var(--border-subtle, #333)',
            borderRadius: '20px',
            maxWidth: '600px', width: '100%',
            padding: '2.5rem', boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
            animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{
                fontSize: '3rem', marginBottom: '12px',
                filter: 'drop-shadow(0 4px 12px rgba(245, 158, 11, 0.3))',
              }}>⭐</div>
              <h3 style={{
                fontSize: '1.5rem', fontWeight: 800,
                color: 'var(--text-primary, white)',
                fontFamily: 'var(--font-serif)',
                margin: 0,
                background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Award Scholar Star
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #888)', margin: '8px 0 0 0' }}>
                to <strong style={{ color: 'var(--color-gold, #c5a059)' }}>@{recipientUsername}</strong>
              </p>
            </div>

            {!isL2Plus ? (
              <div style={{ 
                padding: '2rem', background: 'rgba(239, 68, 68, 0.05)', 
                border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '16px',
                textAlign: 'center', marginBottom: '2rem'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
                <h4 style={{ color: '#ef4444', marginBottom: '8px' }}>Level 2 Required</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  You are currently a <strong>{ROLE_LABELS[currentUserRole || 'reader']?.label || 'Reader'}</strong>.<br/>
                  Scholarly endorsements like Scholar Stars require <strong>Level 2 (Contributor)</strong> status. 
                  Start by contributing your own edits to build platform experience.
                </p>
              </div>
            ) : (
              <>
                {/* Category Selection */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    fontSize: '0.72rem', fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    color: 'var(--text-muted, #888)',
                    display: 'block', marginBottom: '12px',
                  }}>
                    Select Category *
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id as ScholarStarCategory)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '14px',
                          padding: '14px 18px', borderRadius: '14px',
                          border: selectedCategory === cat.id
                            ? '2px solid rgba(245, 158, 11, 0.6)'
                            : '1px solid var(--border-subtle, #333)',
                          background: selectedCategory === cat.id
                            ? 'rgba(245, 158, 11, 0.08)'
                            : 'var(--bg-panel, #0d0d1a)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s ease',
                          transform: selectedCategory === cat.id ? 'scale(1.01)' : 'scale(1)',
                        }}
                      >
                        <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>{cat.icon}</span>
                        <div>
                          <div style={{
                            fontSize: '0.88rem', fontWeight: 700,
                            color: selectedCategory === cat.id ? '#f59e0b' : 'var(--text-primary, white)',
                            marginBottom: '2px',
                          }}>
                            {cat.label}
                          </div>
                          <div style={{
                            fontSize: '0.72rem',
                            color: 'var(--text-muted, #888)',
                            lineHeight: 1.4,
                          }}>
                            {cat.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reason textarea */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label htmlFor="star-reason" style={{
                    fontSize: '0.72rem', fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    color: 'var(--text-muted, #888)',
                    display: 'block', marginBottom: '8px',
                  }}>
                    Written Reason *
                  </label>
                  <textarea
                    id="star-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={selectedCategory === 'citation'
                      ? 'e.g. "Your citation of the Vishakha v. State of Rajasthan guidelines traced three subsequent amendments and showed how the precedent evolved — this level of sourcing is what makes our platform authoritative."'
                      : selectedCategory === 'doctrine'
                      ? 'e.g. "Your synthesis connecting Article 21 jurisprudence from Maneka Gandhi through Navtej Johar revealed a doctrinal thread that most textbooks miss entirely."'
                      : selectedCategory === 'detective'
                      ? 'e.g. "You caught an inconsistency between the stated ratio and the actual holding in the original judgment, saving future readers from a critical misunderstanding."'
                      : 'Explain in detail what made this contribution exceptional. This message becomes a permanent part of their professional record.'}
                    rows={4}
                    style={{
                      width: '100%', padding: '16px',
                      borderRadius: '14px', border: '1px solid var(--border-subtle, #333)',
                      background: 'var(--bg-panel, #0d0d1a)',
                      color: 'var(--text-primary, white)',
                      fontSize: '0.88rem', lineHeight: 1.7,
                      fontFamily: 'var(--font-sans)',
                      resize: 'vertical',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'rgba(245, 158, 11, 0.4)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle, #333)'}
                  />
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    marginTop: '8px', fontSize: '0.68rem',
                    color: reason.trim().length >= 50 ? '#22c55e' : 'var(--text-muted)',
                  }}>
                    <span>{reason.trim().length >= 50 ? '✓ Minimum met' : `${50 - reason.trim().length} more characters needed`}</span>
                    <span>{reason.trim().length} / 50 min</span>
                  </div>
                </div>

                {/* Info box */}
                <div style={{
                  padding: '14px 18px', borderRadius: '12px', marginBottom: '1.5rem',
                  background: 'rgba(245, 158, 11, 0.06)',
                  border: '1px solid rgba(245, 158, 11, 0.15)',
                  fontSize: '0.78rem', lineHeight: 1.7,
                  color: 'var(--text-secondary, #aaa)',
                }}>
                  🔒 Scholar Stars are <strong style={{ color: '#f59e0b' }}>rate-limited</strong>: you can award one per person every 30 days.
                  Your written reason will appear on their profile as a permanent professional endorsement.
                </div>
              </>
            )}

            {/* Result message */}
            {result?.error && (
              <div style={{
                padding: '12px 16px', borderRadius: '10px', marginBottom: '1rem',
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444', fontSize: '0.82rem',
              }}>
                {result.error}
              </div>
            )}
            {result?.success && (
              <div style={{
                padding: '16px', borderRadius: '12px', marginBottom: '1rem',
                background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#22c55e', fontSize: '0.88rem', fontWeight: 600,
                textAlign: 'center',
              }}>
                ⭐ Scholar Star awarded to @{recipientUsername}!
                <br/>
                <span style={{ fontSize: '0.72rem', fontWeight: 400, color: '#22c55e88' }}>
                  +15 reputation · This endorsement is now part of their professional record.
                </span>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setIsOpen(false); setReason(''); setSelectedCategory(null); setResult(null); }}
                style={{
                  padding: '12px 24px', borderRadius: '12px',
                  border: '1px solid var(--border-subtle, #333)',
                  background: 'transparent',
                  color: 'var(--text-muted, #888)',
                  fontSize: '0.82rem', cursor: 'pointer',
                }}
              >
                {isL2Plus ? 'Cancel' : 'Dismiss'}
              </button>
              {isL2Plus && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  style={{
                    padding: '12px 28px', borderRadius: '12px',
                    border: 'none',
                    background: canSubmit
                      ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                      : 'rgba(245, 158, 11, 0.15)',
                    color: canSubmit ? '#000' : '#666',
                    fontSize: '0.82rem', fontWeight: 800,
                    letterSpacing: '0.04em',
                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                    opacity: isPending ? 0.6 : 1,
                    transition: 'all 0.2s ease',
                    boxShadow: canSubmit ? '0 4px 16px rgba(245, 158, 11, 0.3)' : 'none',
                  }}
                >
                  {isPending ? 'Awarding...' : '⭐ Award Scholar Star'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
