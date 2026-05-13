'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { searchArchiveNodes } from '@/app/actions/authority-anchors';
import { AUTHORITY_TYPE_META } from '@/app/actions/authority-constants';
import type { AuthorityType } from '@/app/actions/authority-anchors';
import './authority-anchors.css';

// ============================================================================
// NODE TYPE ICONS (for search results)
// ============================================================================
const NODE_TYPE_ICONS: Record<string, string> = {
  topic: '📝', statute: '📜', chapter: '📖', section: '§',
  constitutional_provision: '🏛', judgment: '⚖️', doctrine: '💡', concept: '🧠',
};

// ============================================================================
// AUTHORITY TYPES for the selector grid
// ============================================================================
const AUTHORITY_TYPES: Array<{ value: AuthorityType; label: string; icon: string }> = [
  { value: 'case', label: 'Case', icon: '⚖️' },
  { value: 'statute', label: 'Statute', icon: '📜' },
  { value: 'constitutional_provision', label: 'Provision', icon: '🏛' },
  { value: 'doctrine', label: 'Doctrine', icon: '💡' },
  { value: 'concept', label: 'Concept', icon: '🧠' },
  { value: 'external_source', label: 'External', icon: '🔗' },
];

// ============================================================================
// PENDING ANCHOR TYPE (no node_id/revision_id yet — collected during drafting)
// ============================================================================
export interface PendingAuthorityAnchor {
  id: string;
  anchor_text: string;
  context_before: string;
  context_after: string;
  paragraph_index: number;
  authority_type: AuthorityType;
  authority_title: string;
  authority_citation: string | null;
  authority_url: string | null;
  authority_node_id: string | null;
  authority_node_title: string | null;
}

// ============================================================================
// PROPS
// ============================================================================
interface DraftAuthorityEditorProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  pendingAnchors: PendingAuthorityAnchor[];
  onAnchorsChange: (anchors: PendingAuthorityAnchor[]) => void;
}

// ============================================================================
// COMPONENT — Draft-mode authority editor for /topic/new
// Collects anchors in local state; they're serialized into a hidden
// form field and saved after the node + revision are created.
// ============================================================================
export default function DraftAuthorityEditor({
  textareaRef, pendingAnchors, onAnchorsChange,
}: DraftAuthorityEditorProps) {
  // ── Selection state ──
  const [selectedText, setSelectedText] = useState('');
  const [contextBefore, setContextBefore] = useState('');
  const [contextAfter, setContextAfter] = useState('');
  const [paragraphIndex, setParagraphIndex] = useState(0);
  const [showTrigger, setShowTrigger] = useState(false);
  const [triggerPos, setTriggerPos] = useState({ top: 0, left: 0 });

  // ── Panel state ──
  const [showPanel, setShowPanel] = useState(false);
  const [authorityType, setAuthorityType] = useState<AuthorityType>('case');
  const [authorityTitle, setAuthorityTitle] = useState('');
  const [authorityCitation, setAuthorityCitation] = useState('');
  const [authorityUrl, setAuthorityUrl] = useState('');
  const [linkedNodeId, setLinkedNodeId] = useState<string | null>(null);
  const [linkedNodeTitle, setLinkedNodeTitle] = useState('');

  // ── Node search ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; title: string; slug: string; node_type: string }>>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // ── Detect text selection in textarea ──
  const handleTextSelect = useCallback((e?: MouseEvent) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end || end - start < 3) {
      setShowTrigger(false);
      return;
    }

    const fullText = textarea.value;
    const selected = fullText.slice(start, end).trim();
    if (selected.length < 3) {
      setShowTrigger(false);
      return;
    }

    // Extract context for resilient matching
    const ctxBefore = fullText.slice(Math.max(0, start - 40), start);
    const ctxAfter = fullText.slice(end, Math.min(fullText.length, end + 40));

    // Calculate paragraph index
    const textBefore = fullText.slice(0, start);
    const paraIdx = (textBefore.match(/\n\n/g) || []).length;

    setSelectedText(selected);
    setContextBefore(ctxBefore);
    setContextAfter(ctxAfter);
    setParagraphIndex(paraIdx);

    // Position near mouse cursor (contextual, born from the selection)
    if (e) {
      setTriggerPos({
        top: e.clientY - 44,
        left: e.clientX + 12,
      });
    } else {
      // Keyboard selection fallback: position near textarea
      const rect = textarea.getBoundingClientRect();
      setTriggerPos({
        top: rect.top + Math.min(120, rect.height / 2),
        left: rect.right - 160,
      });
    }
    setShowTrigger(true);
  }, [textareaRef]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const onMouseUp = (e: MouseEvent) => handleTextSelect(e);
    const onKeyUp = () => handleTextSelect();

    textarea.addEventListener('mouseup', onMouseUp);
    textarea.addEventListener('keyup', onKeyUp);

    return () => {
      textarea.removeEventListener('mouseup', onMouseUp);
      textarea.removeEventListener('keyup', onKeyUp);
    };
  }, [textareaRef, handleTextSelect]);

  // ── Close search dropdown on outside click ──
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Open panel ──
  const openPanel = () => {
    setShowPanel(true);
    setShowTrigger(false);
    setAuthorityType('case');
    setAuthorityTitle('');
    setAuthorityCitation('');
    setAuthorityUrl('');
    setLinkedNodeId(null);
    setLinkedNodeTitle('');
    setSearchQuery('');
    setSearchResults([]);
  };

  // ── Close panel ──
  const closePanel = () => {
    setShowPanel(false);
    setSelectedText('');
  };

  // ── Search archive nodes ──
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setAuthorityTitle(query);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      const results = await searchArchiveNodes(query);
      setSearchResults(results);
      setShowSearchResults(results.length > 0);
    }, 300);
  };

  // ── Select a node from search ──
  const selectNode = (node: { id: string; title: string; slug: string; node_type: string }) => {
    setLinkedNodeId(node.id);
    setLinkedNodeTitle(node.title);
    setAuthorityTitle(node.title);
    setSearchQuery(node.title);
    setShowSearchResults(false);
  };

  // ── Clear linked node ──
  const clearLinkedNode = () => {
    setLinkedNodeId(null);
    setLinkedNodeTitle('');
  };

  // ── Add authority to pending list ──
  const handleAdd = () => {
    if (!authorityTitle.trim() || !selectedText.trim()) return;

    const newAnchor: PendingAuthorityAnchor = {
      id: crypto.randomUUID(),
      anchor_text: selectedText,
      context_before: contextBefore,
      context_after: contextAfter,
      paragraph_index: paragraphIndex,
      authority_type: authorityType,
      authority_title: authorityTitle.trim(),
      authority_citation: authorityCitation || null,
      authority_url: authorityUrl || null,
      authority_node_id: linkedNodeId,
      authority_node_title: linkedNodeTitle || null,
    };

    onAnchorsChange([...pendingAnchors, newAnchor]);
    closePanel();
  };

  // ── Remove anchor ──
  const handleRemove = (id: string) => {
    onAnchorsChange(pendingAnchors.filter(a => a.id !== id));
  };

  return (
    <>
      {/* ── Floating "Attach Authority" Trigger — fixed, near selection ── */}
      {showTrigger && (
        <button
          type="button"
          className="authority-attach-trigger"
          style={{ position: 'fixed', top: triggerPos.top, left: triggerPos.left }}
          onClick={openPanel}
        >
          <span className="trigger-dot" />
          Attach Authority
        </button>
      )}

      {/* ── Authority Attachment Panel (Modal) ── */}
      {showPanel && (
        <div className="authority-panel-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) closePanel();
        }}>
          <div className="authority-panel">
            <div className="authority-panel-header">
              <span className="authority-panel-title">Attach Authority</span>
              <button type="button" className="authority-panel-close" onClick={closePanel}>×</button>
            </div>

            <div className="authority-panel-body">
              {/* Selected text preview */}
              <div className="authority-anchor-preview">
                <span className="authority-anchor-preview-label">Attributing</span>
                &ldquo;{selectedText.length > 120 ? selectedText.slice(0, 120) + '…' : selectedText}&rdquo;
              </div>

              {/* Authority type selector */}
              <div className="authority-field">
                <span className="authority-field-label">Authority Type</span>
                <div className="authority-type-grid">
                  {AUTHORITY_TYPES.map(at => (
                    <label
                      key={at.value}
                      className={`authority-type-option ${authorityType === at.value ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="authority_type_draft"
                        value={at.value}
                        checked={authorityType === at.value}
                        onChange={() => setAuthorityType(at.value)}
                      />
                      <span className="authority-type-icon">{at.icon}</span>
                      <span className="authority-type-name">{at.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Title / Node search */}
              <div className="authority-field" ref={searchContainerRef} style={{ position: 'relative' }}>
                <span className="authority-field-label">
                  Authority Name
                  <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, marginLeft: 6, opacity: 0.6 }}>
                    (search the archive or type freely)
                  </span>
                </span>
                {linkedNodeId ? (
                  <div className="authority-linked-badge">
                    📎 Linked to: {linkedNodeTitle || authorityTitle}
                    <button type="button" onClick={clearLinkedNode}>×</button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      className="authority-field-input"
                      placeholder="e.g., Maneka Gandhi v. Union of India"
                      value={searchQuery || authorityTitle}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                    />
                    {showSearchResults && searchResults.length > 0 && (
                      <div className="authority-node-results">
                        {searchResults.map(node => (
                          <div
                            key={node.id}
                            className="authority-node-result"
                            onClick={() => selectNode(node)}
                          >
                            <span className="authority-node-result-type">
                              {NODE_TYPE_ICONS[node.node_type] || '📝'}
                            </span>
                            <div className="authority-node-result-info">
                              <span className="authority-node-result-title">{node.title}</span>
                              <span className="authority-node-result-slug">/{node.slug}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Citation (optional) */}
              <div className="authority-field">
                <span className="authority-field-label">Citation (optional)</span>
                <input
                  type="text"
                  className="authority-field-input"
                  placeholder="e.g., AIR 1978 SC 597"
                  value={authorityCitation}
                  onChange={(e) => setAuthorityCitation(e.target.value)}
                />
              </div>

              {/* URL (only for external sources) */}
              {authorityType === 'external_source' && (
                <div className="authority-field">
                  <span className="authority-field-label">Source URL</span>
                  <input
                    type="url"
                    className="authority-field-input"
                    placeholder="https://..."
                    value={authorityUrl}
                    onChange={(e) => setAuthorityUrl(e.target.value)}
                  />
                </div>
              )}

              {/* Submit */}
              <button
                type="button"
                className="authority-submit-btn"
                disabled={!authorityTitle.trim()}
                onClick={handleAdd}
              >
                Attach Authority
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pending Anchors List ── */}
      {pendingAnchors.length > 0 && (
        <div className="authority-existing-section">
          <div className="authority-existing-header">
            <span className="authority-existing-title">Authorities Attached</span>
            <span className="authority-existing-count">{pendingAnchors.length}</span>
          </div>
          <div className="authority-existing-list">
            {pendingAnchors.map(anchor => {
              const meta = AUTHORITY_TYPE_META[anchor.authority_type];
              return (
                <div key={anchor.id} className="authority-existing-item">
                  <span className="authority-existing-icon">{meta?.icon || '📎'}</span>
                  <div className="authority-existing-info">
                    <span className="authority-existing-name">{anchor.authority_title}</span>
                    <span className="authority-existing-anchor-text">
                      &ldquo;{anchor.anchor_text.length > 60 ? anchor.anchor_text.slice(0, 60) + '…' : anchor.anchor_text}&rdquo;
                    </span>
                    <span
                      className="authority-existing-type"
                      style={{ color: meta?.color, background: meta?.bg }}
                    >
                      {meta?.label}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="authority-existing-delete"
                    onClick={() => handleRemove(anchor.id)}
                    title="Remove authority"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
