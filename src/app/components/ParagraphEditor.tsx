'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { saveParagraph, insertParagraph } from '@/app/actions/paragraphs';
import EditorToolbar from './EditorToolbar';
import LinkInsertModal from './LinkInsertModal';
import DraftAuthorityEditor from './DraftAuthorityEditor';
import type { PendingAuthorityAnchor } from './DraftAuthorityEditor';
import { renderMarkdown } from '@/app/utils/markdownRenderer';
import './paragraph-editor.css';

// ============================================================================
// PARAGRAPH EDITOR — Focused modal for "Edit ¶7" experience
//
// Design: a single paragraph is the editing unit. The editor shows:
//   - Formatting toolbar (bold, italic, lists, quotes, legal text, links)
//   - Content textarea (markdown) with write/preview toggle
//   - Marginal note field
//   - Commit message field
//   - Live quality warnings (non-blocking)
//   - Group label field (for new paragraphs only)
// ============================================================================

interface ParagraphEditorProps {
  /** null = creating a new paragraph */
  paragraphId: string | null;
  nodeId: string;
  slug: string;
  displayNumber: number;
  initialContent: string;
  initialMarginalNote: string;
  initialGroupLabel: string;
  /** order_index to insert after (only for new paragraphs) */
  insertAfterOrder: number;
  onClose: () => void;
  onSaved: () => void;
}

// ── Quality warning heuristics ──

interface QualityWarning {
  icon: string;
  message: string;
}

interface ParagraphDraftData {
  content: string;
  marginalNote: string;
  groupLabel: string;
  commitMessage: string;
  pendingAnchors: PendingAuthorityAnchor[];
  savedAt: string;
}

const AUTOSAVE_DELAY = 1500;

function draftKey(slug: string, nodeId: string, paragraphId: string | null, insertAfterOrder: number) {
  return `siddhant_paragraph_draft:${slug}:${nodeId}:${paragraphId || `new-${insertAfterOrder}`}`;
}

function loadDraft(key: string): ParagraphDraftData | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as ParagraphDraftData : null;
  } catch {
    return null;
  }
}

function saveDraft(key: string, data: ParagraphDraftData) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function getQualityWarnings(content: string, marginalNote: string): QualityWarning[] {
  const warnings: QualityWarning[] = [];
  const plainText = content.replace(/[#*_`>\[\]()~\-]/g, '').trim();
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;

  if (wordCount > 450) {
    warnings.push({
      icon: '📏',
      message: `${wordCount} words — consider splitting into smaller paragraphs (aim for one idea per paragraph)`,
    });
  }

  if (!marginalNote.trim() && content.trim().length > 0) {
    warnings.push({
      icon: '🏷️',
      message: 'Marginal note missing — every paragraph should have a short topical label',
    });
  }

  // Multiple headings
  const headingCount = (content.match(/^#{1,6}\s/gm) || []).length;
  if (headingCount > 1) {
    warnings.push({
      icon: '📑',
      message: 'Multiple headings detected — a paragraph should contain at most one heading',
    });
  }

  // Multiple propositions heuristic
  const transitionPatterns = /^(However|Additionally|Furthermore|Moreover|Nevertheless|On the other hand|Conversely|In contrast),/gm;
  const transitions = (content.match(transitionPatterns) || []).length;
  if (transitions >= 2) {
    warnings.push({
      icon: '🔀',
      message: 'Multiple transition phrases — this paragraph may contain more than one major proposition',
    });
  }

  return warnings;
}

export default function ParagraphEditor({
  paragraphId,
  nodeId,
  slug,
  displayNumber,
  initialContent,
  initialMarginalNote,
  initialGroupLabel,
  insertAfterOrder,
  onClose,
  onSaved,
}: ParagraphEditorProps) {
  const isNewParagraph = !paragraphId;
  const [content, setContent] = useState(initialContent);
  const [marginalNote, setMarginalNote] = useState(initialMarginalNote);
  const [groupLabel, setGroupLabel] = useState(initialGroupLabel);
  const [commitMessage, setCommitMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'write' | 'preview'>('write');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkDefaultLabel, setLinkDefaultLabel] = useState('');
  const [pendingAnchors, setPendingAnchors] = useState<PendingAuthorityAnchor[]>([]);
  const [restorableDraft, setRestorableDraft] = useState<ParagraphDraftData | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saved'>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const storageKey = useMemo(
    () => draftKey(slug, nodeId, paragraphId, insertAfterOrder),
    [slug, nodeId, paragraphId, insertAfterOrder]
  );
  const hasDirtyWork = content !== initialContent ||
    marginalNote !== initialMarginalNote ||
    groupLabel !== initialGroupLabel ||
    commitMessage.length > 0 ||
    pendingAnchors.length > 0;

  // Auto-focus textarea on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const draft = loadDraft(storageKey);
    if (draft && (draft.content || draft.marginalNote || draft.groupLabel || draft.commitMessage || draft.pendingAnchors?.length)) {
      window.setTimeout(() => setRestorableDraft(draft), 0);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hasDirtyWork || saving) return;
    const timer = window.setTimeout(() => {
      saveDraft(storageKey, {
        content,
        marginalNote,
        groupLabel,
        commitMessage,
        pendingAnchors,
        savedAt: new Date().toISOString(),
      });
      setAutosaveStatus('saved');
      window.setTimeout(() => setAutosaveStatus('idle'), 2000);
    }, AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [content, marginalNote, groupLabel, commitMessage, pendingAnchors, hasDirtyWork, saving, storageKey]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!hasDirtyWork || saving) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasDirtyWork, saving]);

  const warnings = useMemo(
    () => getQualityWarnings(content, marginalNote),
    [content, marginalNote]
  );

  const wordCount = useMemo(() => {
    const plain = content.replace(/[#*_`>\[\]()~\-]/g, '').trim();
    return plain ? plain.split(/\s+/).length : 0;
  }, [content]);

  // ── Toolbar integration ──
  const applyEdit = useCallback((newContent: string, cursorStart?: number, cursorEnd?: number) => {
    setContent(newContent);
    if (cursorStart !== undefined) {
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          ta.setSelectionRange(cursorStart, cursorEnd ?? cursorStart);
        }
      });
    }
  }, []);

  const handleLinkInsert = useCallback((markdownLink: string) => {
    const ta = textareaRef.current;
    const pos = ta ? ta.selectionStart : content.length;
    const newContent = content.slice(0, pos) + markdownLink + content.slice(pos);
    applyEdit(newContent, pos + markdownLink.length);
  }, [content, applyEdit]);

  const openLinkModal = useCallback(() => {
    const ta = textareaRef.current;
    setLinkDefaultLabel(ta ? content.slice(ta.selectionStart, ta.selectionEnd) : '');
    setShowLinkModal(true);
  }, [content]);

  const attemptClose = useCallback(() => {
    if (hasDirtyWork && !saving) {
      const ok = window.confirm('Close editor? Your local draft will be kept and can be restored when you reopen this paragraph.');
      if (!ok) return;
    }
    onClose();
  }, [hasDirtyWork, saving, onClose]);

  const handleRestoreDraft = useCallback(() => {
    if (!restorableDraft) return;
    setContent(restorableDraft.content || '');
    setMarginalNote(restorableDraft.marginalNote || '');
    setGroupLabel(restorableDraft.groupLabel || '');
    setCommitMessage(restorableDraft.commitMessage || '');
    setPendingAnchors(restorableDraft.pendingAnchors || []);
    setRestorableDraft(null);
  }, [restorableDraft]);

  const handleDiscardDraft = useCallback(() => {
    clearDraft(storageKey);
    setRestorableDraft(null);
  }, [storageKey]);

  const handleSave = useCallback(async () => {
    setError(null);
    setSaving(true);

    try {
      let result;

      if (isNewParagraph) {
        result = await insertParagraph(
          nodeId,
          insertAfterOrder,
          content,
          marginalNote || null,
          groupLabel || null,
          slug,
          pendingAnchors,
        );
      } else {
        if (!commitMessage.trim()) {
          setError('Please describe your edit.');
          setSaving(false);
          return;
        }
        result = await saveParagraph(
          paragraphId!,
          content,
          marginalNote || null,
          commitMessage,
          slug,
          pendingAnchors,
        );
      }

      if (result.error) {
        setError(result.error);
        setSaving(false);
      } else {
        clearDraft(storageKey);
        onSaved();
      }
    } catch {
      setError('Unexpected error. Please try again.');
      setSaving(false);
    }
  }, [content, marginalNote, groupLabel, commitMessage, paragraphId, nodeId, slug, insertAfterOrder, isNewParagraph, onSaved, pendingAnchors, storageKey]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') attemptClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [attemptClose]);

  return (
    <div className="para-editor-overlay" onClick={(e) => { if (e.target === e.currentTarget) attemptClose(); }}>
      <div className="para-editor-modal" role="dialog" aria-label={isNewParagraph ? 'Add paragraph' : `Edit ¶${displayNumber}`}>

        {/* Header */}
        <div className="para-editor-header">
          <h2 className="para-editor-title">
            {isNewParagraph ? (
              <>+ New paragraph</>
            ) : (
              <>Edit <span className="para-editor-number">¶{displayNumber}</span></>
            )}
          </h2>
          <button type="button" className="para-editor-close" onClick={attemptClose} aria-label="Close">
            ✕
          </button>
        </div>

        {restorableDraft && (
          <div className="para-draft-restore">
            <span>
              Local draft saved {new Date(restorableDraft.savedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
            <button type="button" onClick={handleRestoreDraft}>Restore</button>
            <button type="button" onClick={handleDiscardDraft}>Dismiss</button>
          </div>
        )}

        {/* Marginal note */}
        <div className="para-editor-field">
          <label className="para-editor-label" htmlFor="para-marginal-note">
            Marginal note
            <span className="para-editor-label-hint">Short topical label shown in the margin</span>
          </label>
          <input
            id="para-marginal-note"
            type="text"
            className="para-editor-input"
            value={marginalNote}
            onChange={(e) => setMarginalNote(e.target.value)}
            placeholder="e.g. Permissible classification"
            maxLength={80}
          />
        </div>

        {/* Group label (new paragraphs only) */}
        {isNewParagraph && (
          <div className="para-editor-field">
            <label className="para-editor-label" htmlFor="para-group-label">
              Group label
              <span className="para-editor-label-hint">Visual separator (e.g. &quot;Classification Doctrine&quot;). Leave blank to continue current group.</span>
            </label>
            <input
              id="para-group-label"
              type="text"
              className="para-editor-input"
              value={groupLabel}
              onChange={(e) => setGroupLabel(e.target.value)}
              placeholder="Optional — e.g. Arbitrariness Doctrine"
              maxLength={120}
            />
          </div>
        )}

        {/* Content — write/preview toggle + toolbar */}
        <div className="para-editor-field para-editor-content-field">
          <div className="para-editor-content-header">
            <label className="para-editor-label">
              Content
              <span className="para-editor-label-hint">{wordCount} words · Markdown supported</span>
            </label>
            <div className="para-editor-view-toggle">
              <button
                type="button"
                className={`para-view-btn ${viewMode === 'write' ? 'active' : ''}`}
                onClick={() => setViewMode('write')}
              >
                ✏️ Write
              </button>
              <button
                type="button"
                className={`para-view-btn ${viewMode === 'preview' ? 'active' : ''}`}
                onClick={() => setViewMode('preview')}
              >
                👁 Preview
              </button>
            </div>
          </div>

          {viewMode === 'write' ? (
            <>
              <EditorToolbar
                textareaRef={textareaRef}
                content={content}
                onContentChange={applyEdit}
                onOpenLinkModal={openLinkModal}
              />
              <textarea
                ref={textareaRef}
                id="para-content"
                className="para-editor-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write one idea per paragraph..."
                rows={12}
              />
              <DraftAuthorityEditor
                textareaRef={textareaRef}
                pendingAnchors={pendingAnchors}
                onAnchorsChange={setPendingAnchors}
              />
            </>
          ) : (
            <div className="para-editor-preview">
              {content.trim() ? (
                <div
                  className="rendered-markdown"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                />
              ) : (
                <p className="para-editor-preview-empty">Nothing to preview yet.</p>
              )}
            </div>
          )}

          {/* Link Insert Modal */}
          <LinkInsertModal
            isOpen={showLinkModal}
            onClose={() => setShowLinkModal(false)}
            onInsert={handleLinkInsert}
            defaultLabel={linkDefaultLabel}
          />
        </div>

        {/* Quality warnings */}
        {warnings.length > 0 && (
          <div className="para-editor-warnings">
            {warnings.map((w, i) => (
              <div key={i} className="para-editor-warning">
                <span className="para-editor-warning-icon">{w.icon}</span>
                <span className="para-editor-warning-text">{w.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Commit message (edits only) */}
        {!isNewParagraph && (
          <div className="para-editor-field">
            <label className="para-editor-label" htmlFor="para-commit">
              Describe your edit
              <span className="para-editor-label-hint">Brief explanation of what changed</span>
            </label>
            <input
              id="para-commit"
              type="text"
              className="para-editor-input"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="e.g. Added citation to Maneka Gandhi"
              maxLength={200}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="para-editor-error">{error}</div>
        )}

        {autosaveStatus === 'saved' && (
          <div className="para-editor-autosave">Draft saved locally</div>
        )}

        {/* Actions */}
        <div className="para-editor-actions">
          <button type="button" className="para-editor-btn-cancel" onClick={attemptClose}>
            Cancel
          </button>
          <button
            type="button"
            className="para-editor-btn-save"
            onClick={handleSave}
            disabled={saving || !content.trim()}
          >
            {saving ? 'Saving...' : isNewParagraph ? 'Add paragraph' : `Save ¶${displayNumber}`}
          </button>
        </div>
      </div>
    </div>
  );
}

