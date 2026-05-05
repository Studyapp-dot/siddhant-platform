'use client';

import React, { useState, useTransition } from 'react';
import { revertRevision, restoreToVersion } from '@/app/actions/revert';

// Level 3+ roles
const CAN_REVERT = ['recognized', 'senior_scholar', 'steward', 'governance_council'];

interface RevertButtonProps {
  revisionId: string;
  slug: string;
  userRole: string | null;
  isOwnEdit: boolean;
  isRevert: boolean;      // This revision is itself a revert
  isReverted: boolean;    // This revision has been reverted
  isLatest: boolean;      // This is the most recent revision
}

export default function RevertButton({
  revisionId,
  slug,
  userRole,
  isOwnEdit,
  isRevert,
  isReverted,
  isLatest,
}: RevertButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  // Only show to Level 3+ users
  if (!userRole || !CAN_REVERT.includes(userRole)) return null;

  // Don't show on already-reverted revisions
  if (isReverted) return null;

  // Don't show on revert revisions (to prevent revert chains)
  if (isRevert) return null;

  // Mode: "Revert" for latest, "Restore" for older
  const mode = isLatest ? 'revert' : 'restore';

  const handleSubmit = () => {
    if (reason.trim().length < 10) return;
    startTransition(async () => {
      const res = mode === 'revert'
        ? await revertRevision(revisionId, reason, slug)
        : await restoreToVersion(revisionId, reason, slug);
      if (res.error) {
        setResult({ error: res.error });
      } else {
        setResult({ success: true });
        setTimeout(() => {
          setIsOpen(false);
          setReason('');
          setResult(null);
          window.location.reload();
        }, 1500);
      }
    });
  };

  const btnLabel = mode === 'revert' ? '↩ Revert' : '↻ Restore';
  const btnTitle = mode === 'revert'
    ? 'Revert this edit — undo the last change'
    : 'Restore to this version — create a new revision with this content';
  const modalTitle = mode === 'revert' ? 'Revert This Edit' : 'Restore to This Version';
  const modalDesc = mode === 'revert'
    ? 'This will undo the latest edit and restore the article to the previous version.'
    : 'This will create a new revision with the content from this point in history.';
  const warningText = mode === 'revert'
    ? 'A new revision will be created restoring the previous content. The reverted edit will be permanently marked in the history — it is never deleted.'
    : 'A new revision will be created with the content from this historical version. All edits made after this point will remain in the history — nothing is deleted.';
  const submitLabel = mode === 'revert' ? '↩ Confirm Revert' : '↻ Confirm Restore';
  const successMsg = mode === 'revert'
    ? '✓ Edit reverted successfully. The page will refresh.'
    : '✓ Version restored successfully. The page will refresh.';

  // Button color: red for revert, amber for restore
  const btnColor = mode === 'revert' ? '#ef4444' : '#f59e0b';

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title={btnTitle}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '4px 10px', borderRadius: '6px',
          fontSize: '0.68rem', fontWeight: 700,
          cursor: 'pointer',
          border: `1px solid ${btnColor}4D`,
          background: `${btnColor}0F`,
          color: btnColor,
          transition: 'all 0.2s ease',
          letterSpacing: '0.02em',
        }}
      >
        {btnLabel}
      </button>

      {/* Confirmation modal */}
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
            maxWidth: '520px', width: '100%',
            padding: '2rem', boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '1.8rem' }}>{mode === 'revert' ? '↩' : '↻'}</span>
              <div>
                <h3 style={{
                  fontSize: '1.2rem', fontWeight: 800,
                  color: 'var(--text-primary, white)',
                  fontFamily: 'var(--font-serif)', margin: 0,
                }}>
                  {modalTitle}
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #888)', margin: '4px 0 0 0' }}>
                  {modalDesc}
                </p>
              </div>
            </div>

            {/* Warning */}
            <div style={{
              padding: '12px 16px', borderRadius: '10px', marginBottom: '1.5rem',
              background: `${btnColor}0F`,
              border: `1px solid ${btnColor}33`,
              fontSize: '0.78rem', lineHeight: 1.6,
              color: 'var(--text-secondary, #aaa)',
            }}>
              <strong style={{ color: btnColor }}>This is a moderation action.</strong>{' '}
              {warningText} This action does not affect your own edit count or reputation.
            </div>

            {/* Reason */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="revert-reason" style={{
                fontSize: '0.7rem', fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: 'var(--text-muted, #888)',
                display: 'block', marginBottom: '8px',
              }}>
                Reason *
              </label>
              <textarea
                id="revert-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={mode === 'revert'
                  ? 'e.g., "Contains factually incorrect information about the Maneka Gandhi ruling."'
                  : 'e.g., "Restoring to the last known-good version before the accuracy issues were introduced."'
                }
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
                color: reason.trim().length >= 10 ? '#22c55e' : 'var(--text-muted)',
              }}>
                {reason.trim().length >= 10 ? '✓ Minimum met' : 'Minimum 10 characters'}
              </div>
            </div>

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
                {successMsg}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setIsOpen(false); setReason(''); setResult(null); }}
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
                disabled={isPending || reason.trim().length < 10 || !!result?.success}
                style={{
                  padding: '10px 24px', borderRadius: '10px',
                  border: 'none',
                  background: reason.trim().length >= 10 && !isPending
                    ? `linear-gradient(135deg, ${btnColor}, ${btnColor}CC)`
                    : `${btnColor}33`,
                  color: reason.trim().length >= 10 ? 'white' : '#666',
                  fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.05em',
                  cursor: isPending || reason.trim().length < 10 ? 'not-allowed' : 'pointer',
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                {isPending ? (mode === 'revert' ? 'Reverting...' : 'Restoring...') : submitLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
