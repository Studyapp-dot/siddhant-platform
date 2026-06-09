'use client';

import React, { useState, useCallback } from 'react';
import { renderMarkdown } from '@/app/utils/markdownRenderer';
import { deleteParagraph } from '@/app/actions/paragraphs';
import type { AuthorityAnchor } from '@/app/actions/authority-anchors';
import ParagraphEditor from './ParagraphEditor';
import ParagraphHistory from './ParagraphHistory';

// ============================================================================
// PARAGRAPH VIEW — Renders a single paragraph-native knowledge unit
//
// Displays: ¶ number, marginal note, rendered markdown content, hover action bar.
// Each paragraph is an independently addressable, editable, citable object.
// ============================================================================

interface ParagraphViewProps {
  id: string;
  stableId: string;
  displayNumber: number;
  marginalNote: string | null;
  content: string;
  groupLabel: string | null;
  nodeId: string;
  slug: string;
  authorityAnchors?: AuthorityAnchor[];
  onEdited: () => void;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function injectAuthorityMarkers(html: string, anchors: AuthorityAnchor[]): string {
  let processed = html;

  for (const anchor of anchors.filter(a => a.anchor_text).sort((a, b) => b.anchor_text.length - a.anchor_text.length)) {
    const escapedText = escapeHtml(anchor.anchor_text);
    if (!escapedText || !processed.includes(escapedText)) continue;

    const title = escapeHtml([
      anchor.authority_title,
      anchor.authority_citation,
      anchor.authority_url,
    ].filter(Boolean).join(' | '));

    processed = processed.replace(
      escapedText,
      `<span class="authority-inline-marker paragraph-authority-marker" title="${title}" data-authority-id="${anchor.id}">${escapedText}</span>`
    );
  }

  return processed;
}

export default function ParagraphView({
  id,
  stableId,
  displayNumber,
  marginalNote,
  content,
  groupLabel,
  nodeId,
  slug,
  authorityAnchors = [],
  onEdited,
}: ParagraphViewProps) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/topic/${slug}?pid=${stableId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }, [slug, stableId]);

  const handleEditClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setEditing(true);
  }, []);

  const handleEditorClose = useCallback(() => {
    setEditing(false);
  }, []);

  const handleEditorSaved = useCallback(() => {
    setEditing(false);
    onEdited();
  }, [onEdited]);

  const handleDeleteConfirm = useCallback(async () => {
    setDeleting(true);
    const result = await deleteParagraph(id, slug);
    if (result.error) {
      alert(result.error);
      setDeleting(false);
    } else {
      setConfirmingDelete(false);
      onEdited();
    }
  }, [id, slug, onEdited]);

  // Render paragraph content as HTML
  const html = injectAuthorityMarkers(renderMarkdown(content), authorityAnchors);

  return (
    <>
      <div
        className="paragraph-block"
        id={`p-${displayNumber}`}
        data-stable-id={stableId}
      >
        {/* Margin: paragraph number */}
        <span className="paragraph-number" aria-hidden="true">
          ¶{displayNumber}
        </span>

        {/* Margin: marginal note */}
        {marginalNote && (
          <span className="paragraph-marginal-note" title={marginalNote}>
            {marginalNote}
          </span>
        )}

        {/* Content */}
        <div
          className="paragraph-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* Hover action bar */}
        <div className="paragraph-action-bar">
          <button
            type="button"
            className="paragraph-action-btn"
            title={`Edit paragraph ${displayNumber}`}
            onClick={handleEditClick}
          >
            ✏️ Edit ¶{displayNumber}
          </button>
          <button
            type="button"
            className={`paragraph-action-btn${copied ? ' copied' : ''}`}
            title={`Copy permanent link to ¶${displayNumber}`}
            onClick={handleCopyLink}
          >
            {copied ? '✓ Copied' : '🔗 Copy link'}
          </button>
          <button
            type="button"
            className="paragraph-action-btn"
            title={`Revision history for ¶${displayNumber}`}
            onClick={() => setShowHistory(true)}
          >
            📜 History ¶{displayNumber}
          </button>
          <button
            type="button"
            className="paragraph-action-btn paragraph-action-btn-delete"
            title={`Delete paragraph ${displayNumber}`}
            onClick={() => { setConfirmingDelete(true); setDeleteConfirmText(''); }}
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <ParagraphEditor
          paragraphId={id}
          nodeId={nodeId}
          slug={slug}
          displayNumber={displayNumber}
          initialContent={content}
          initialMarginalNote={marginalNote || ''}
          initialGroupLabel={groupLabel || ''}
          insertAfterOrder={0}
          onClose={handleEditorClose}
          onSaved={handleEditorSaved}
        />
      )}

      {/* History modal */}
      {showHistory && (
        <ParagraphHistory
          paragraphId={id}
          displayNumber={displayNumber}
          slug={slug}
          onClose={() => setShowHistory(false)}
          onReverted={() => { setShowHistory(false); onEdited(); }}
        />
      )}

      {/* Delete confirmation dialog */}
      {confirmingDelete && (
        <div className="para-editor-overlay" onClick={(e) => { if (e.target === e.currentTarget) setConfirmingDelete(false); }}>
          <div className="para-delete-confirm" role="alertdialog" aria-label={`Delete paragraph ${displayNumber}`}>
            <h3 className="para-delete-title">Delete ¶{displayNumber}?</h3>
            <p className="para-delete-desc">
              This will soft-delete the paragraph. Revision history is preserved.
            </p>
            <p className="para-delete-desc">
              Type <strong>{displayNumber}</strong> to confirm:
            </p>
            <input
              type="text"
              className="para-delete-input"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={`Type ${displayNumber}`}
              autoFocus
            />
            <div className="para-delete-actions">
              <button
                type="button"
                className="para-editor-btn-cancel"
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="para-delete-btn-confirm"
                disabled={deleteConfirmText.trim() !== String(displayNumber) || deleting}
                onClick={handleDeleteConfirm}
              >
                {deleting ? 'Deleting...' : `Delete ¶${displayNumber}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
