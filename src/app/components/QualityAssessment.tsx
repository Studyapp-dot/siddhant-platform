'use client';

import React, { useState, useTransition } from 'react';
import { assessQualityTier } from '@/app/actions/quality';

// Tier display config — must match server-side QUALITY_TIERS
const TIER_OPTIONS = [
  { value: 'stub',         label: 'Draft',        description: 'Bare-bones, just created',              icon: '⚠',  minLevel: 2, requiresPeerReview: false },
  { value: 'start',        label: 'Developing',   description: 'Some meaningful content, needs improvement', icon: '📋', minLevel: 2, requiresPeerReview: false },
  { value: 'c_class',      label: 'Useful',       description: 'Useful to casual reader, gaps remain',  icon: '📖', minLevel: 2, requiresPeerReview: false },
  { value: 'b_class',      label: 'Solid',        description: 'Mostly complete, well-referenced',      icon: '✓',  minLevel: 3, requiresPeerReview: false },
  { value: 'good_article', label: 'Good Article', description: 'Requires formal peer review',           icon: '✓✓', minLevel: 3, requiresPeerReview: true },
  { value: 'featured',     label: 'Featured',     description: 'Requires formal peer review',           icon: '★',  minLevel: 4, requiresPeerReview: true },
];

const ROLE_LEVELS: Record<string, number> = {
  reader: 1, contributor: 2, recognized: 3,
  senior_scholar: 4, steward: 5, governance_council: 6,
};

interface QualityAssessmentProps {
  nodeId: string;
  slug: string;
  currentTier: string;
  userRole: string | null;
}

export default function QualityAssessment({ nodeId, slug, currentTier, userRole }: QualityAssessmentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState('');
  const [justification, setJustification] = useState('');
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('high');
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  const userLevel = userRole ? (ROLE_LEVELS[userRole] || 1) : 0;
  const currentTierLabel = TIER_OPTIONS.find(t => t.value === currentTier)?.label || currentTier;

  if (!userRole || userLevel < 2) return null; // Readers cannot assess

  const handleSubmit = () => {
    if (!selectedTier || justification.trim().length < 10) return;
    startTransition(async () => {
      const res = await assessQualityTier(nodeId, selectedTier, justification, confidence, slug);
      if (res.error) {
        setResult({ error: res.error });
      } else {
        setResult({ success: true });
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
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '5px 12px', borderRadius: '6px',
          fontSize: '0.68rem', fontWeight: 700,
          cursor: 'pointer',
          border: '1px solid var(--border-subtle)',
          background: 'var(--bg-panel)',
          color: 'var(--text-muted)',
          transition: 'all 0.2s',
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
        }}
      >
        📊 Assess Quality
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
            maxWidth: '560px', width: '100%',
            padding: '2rem', boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          }}>
            {/* Header */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{
                fontSize: '1.2rem', fontWeight: 800,
                color: 'var(--text-primary, white)',
                fontFamily: 'var(--font-serif)', margin: 0,
              }}>
                Quality Assessment
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', margin: '6px 0 0 0' }}>
                Current tier: <strong style={{ color: 'var(--text-primary)' }}>{currentTierLabel}</strong>
              </p>
            </div>

            {/* Context */}
            <div style={{
              padding: '12px 16px', borderRadius: '10px', marginBottom: '1.5rem',
              background: 'rgba(59, 130, 246, 0.06)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              fontSize: '0.78rem', lineHeight: 1.6,
              color: 'var(--text-secondary, #aaa)',
            }}>
              Quality tiers reflect <strong>actual content quality</strong> — accuracy, completeness,
              neutrality, and sourcing — not edit count or activity. Assess what the content
              <em> is</em>, not how much work went into it.
            </div>

            {/* Tier Selection */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{
                fontSize: '0.7rem', fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: 'var(--text-muted, #888)',
                display: 'block', marginBottom: '10px',
              }}>
                New Tier Assessment
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {TIER_OPTIONS.map(tier => {
                  const disabled = tier.requiresPeerReview || userLevel < tier.minLevel || tier.value === currentTier;
                  return (
                    <button
                      key={tier.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => setSelectedTier(tier.value)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 14px', borderRadius: '10px',
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
                      <span style={{ fontSize: '1rem', width: '28px', textAlign: 'center' }}>{tier.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '0.85rem', fontWeight: 700,
                          color: 'var(--text-primary, white)',
                        }}>
                          {tier.label}
                          {tier.value === currentTier && (
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: '8px', fontWeight: 500 }}>
                              (current)
                            </span>
                          )}
                        </div>
                        <div style={{
                          fontSize: '0.7rem',
                          color: 'var(--text-muted, #888)',
                        }}>
                          {tier.requiresPeerReview ? (
                            <span style={{ color: '#8b5cf6' }}>
                              📋 Requires formal peer review (see panel below)
                            </span>
                          ) : (
                            <>
                              {tier.description}
                              {userLevel < tier.minLevel && (
                                <span style={{ color: '#ef4444', marginLeft: '6px' }}>
                                  (Level {tier.minLevel}+ required)
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Justification */}
            {selectedTier && (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    fontSize: '0.7rem', fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    color: 'var(--text-muted, #888)',
                    display: 'block', marginBottom: '8px',
                  }}>
                    Justification *
                  </label>
                  <textarea
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Why does this content deserve this quality tier? Refer to accuracy, completeness, sourcing, and neutrality."
                    rows={3}
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
                  <div style={{
                    fontSize: '0.6rem', marginTop: '4px',
                    color: justification.trim().length >= 10 ? '#22c55e' : 'var(--text-muted)',
                  }}>
                    {justification.trim().length >= 10 ? '✓ Minimum met' : 'Minimum 10 characters'}
                  </div>
                </div>

                {/* Confidence */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{
                    fontSize: '0.7rem', fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    color: 'var(--text-muted, #888)',
                    display: 'block', marginBottom: '8px',
                  }}>
                    Assessment Confidence
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['high', 'medium', 'low'] as const).map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setConfidence(c)}
                        style={{
                          padding: '6px 14px', borderRadius: '8px',
                          fontSize: '0.75rem', fontWeight: 600,
                          border: confidence === c
                            ? '2px solid var(--color-gold)'
                            : '1px solid var(--border-subtle, #333)',
                          background: confidence === c ? 'rgba(197, 160, 89, 0.1)' : 'transparent',
                          color: confidence === c ? 'var(--color-gold)' : 'var(--text-muted)',
                          cursor: 'pointer', textTransform: 'capitalize',
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Low confidence assessments may trigger a second review cycle.
                  </p>
                </div>
              </>
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
                ✓ Quality tier updated successfully.
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
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
                disabled={isPending || !selectedTier || justification.trim().length < 10 || !!result?.success}
                style={{
                  padding: '10px 24px', borderRadius: '10px',
                  border: 'none',
                  background: selectedTier && justification.trim().length >= 10 && !isPending
                    ? 'linear-gradient(135deg, var(--color-gold), #d97706)'
                    : 'rgba(197, 160, 89, 0.2)',
                  color: selectedTier && justification.trim().length >= 10 ? '#000' : '#666',
                  fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.05em',
                  cursor: isPending || !selectedTier || justification.trim().length < 10 ? 'not-allowed' : 'pointer',
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                {isPending ? 'Saving...' : 'Submit Assessment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
