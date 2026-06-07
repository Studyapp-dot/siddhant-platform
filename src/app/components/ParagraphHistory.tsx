'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getParagraphRevisions, revertParagraph, type ParagraphRevision } from '@/app/actions/paragraph-revisions';
import { renderMarkdown } from '@/app/utils/markdownRenderer';
import './paragraph-editor.css';

// ============================================================================
// PARAGRAPH HISTORY — Shows revision history for a single paragraph
//
// Displays: revision list, content diff (simple before/after), revert action.
// Opened via "History ¶N" in the hover action bar.
// ============================================================================

interface ParagraphHistoryProps {
  paragraphId: string;
  displayNumber: number;
  slug: string;
  onClose: () => void;
  onReverted: () => void;
}

export default function ParagraphHistory({
  paragraphId,
  displayNumber,
  slug,
  onClose,
  onReverted,
}: ParagraphHistoryProps) {
  const [revisions, setRevisions] = useState<ParagraphRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reverting, setReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getParagraphRevisions(paragraphId).then((data) => {
      setRevisions(data);
      setLoading(false);
    });
  }, [paragraphId]);

  const handleRevert = useCallback(async (revisionId: string) => {
    if (!confirm('Revert this paragraph to the selected revision? This will create a new revision.')) return;
    setReverting(true);
    setError(null);
    const result = await revertParagraph(paragraphId, revisionId, slug);
    if (result.error) {
      setError(result.error);
      setReverting(false);
    } else {
      onReverted();
    }
  }, [paragraphId, slug, onReverted]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const revisionTypeLabel = (type: string) => {
    switch (type) {
      case 'creation': return '🆕 Created';
      case 'content_edit': return '✏️ Edited';
      case 'marginal_note_edit': return '🏷️ Note updated';
      case 'deletion': return '🗑️ Deleted';
      case 'revert': return '↩️ Reverted';
      case 'migration': return '📦 Migrated';
      default: return type;
    }
  };

  return (
    <div className="para-editor-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="para-editor-modal para-history-modal" role="dialog" aria-label={`History ¶${displayNumber}`}>

        {/* Header */}
        <div className="para-editor-header">
          <h2 className="para-editor-title">
            History <span className="para-editor-number">¶{displayNumber}</span>
          </h2>
          <button type="button" className="para-editor-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error && <div className="para-editor-error">{error}</div>}

        {/* Content */}
        <div className="para-history-list">
          {loading ? (
            <div className="para-history-loading">Loading revision history…</div>
          ) : revisions.length === 0 ? (
            <div className="para-history-empty">No revision history found.</div>
          ) : (
            revisions.map((rev, index) => {
              const isExpanded = expandedId === rev.id;
              const isCurrent = index === 0;

              return (
                <div key={rev.id} className={`para-history-item${isCurrent ? ' current' : ''}`}>
                  <div
                    className="para-history-item-header"
                    onClick={() => setExpandedId(isExpanded ? null : rev.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="para-history-item-meta">
                      <span className="para-history-type">{revisionTypeLabel(rev.revision_type)}</span>
                      <span className="para-history-date">{formatDate(rev.created_at)}</span>
                      {isCurrent && <span className="para-history-current-badge">current</span>}
                    </div>
                    <div className="para-history-commit">{rev.commit_message}</div>
                  </div>

                  {isExpanded && (
                    <div className="para-history-item-body">
                      <div className="para-history-content">
                        <div className="para-history-content-label">Content at this revision:</div>
                        <div
                          className="para-history-content-preview paragraph-content"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(rev.content) }}
                        />
                      </div>
                      {rev.marginal_note && (
                        <div className="para-history-note">
                          Marginal note: <em>{rev.marginal_note}</em>
                        </div>
                      )}
                      {!isCurrent && (
                        <button
                          type="button"
                          className="para-editor-btn-save para-history-revert-btn"
                          onClick={() => handleRevert(rev.id)}
                          disabled={reverting}
                        >
                          {reverting ? 'Reverting…' : `↩️ Revert to this revision`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
