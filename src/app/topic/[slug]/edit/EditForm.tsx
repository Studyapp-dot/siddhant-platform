'use client';

import React, { useRef, useState, useEffect, useActionState } from 'react';
import Link from 'next/link';
import AuthorityAnchorEditor from '@/app/components/AuthorityAnchorEditor';
import type { AuthorityAnchor } from '@/app/actions/authority-anchors';
import { renderMarkdown } from '@/app/utils/markdownRenderer';
import { submitRevision, type RevisionResult } from './actions';

// ============================================================================
// EDIT FORM — Client component with Write/Preview, node type change,
//             authority anchoring, and structured contribution summary
// ============================================================================

const NODE_TYPES = [
  { value: 'topic',     label: 'Topic',         icon: '📝' },
  { value: 'statute',   label: 'Statute / Act',  icon: '📜' },
  { value: 'chapter',   label: 'Chapter / Part',  icon: '📖' },
  { value: 'section',   label: 'Section',         icon: '§'  },
  { value: 'constitutional_provision', label: 'Constitutional Provision', icon: '🏛' },
  { value: 'judgment',  label: 'Judgment / Case', icon: '⚖️' },
  { value: 'doctrine',  label: 'Doctrine',        icon: '💡' },
  { value: 'concept',   label: 'Concept',         icon: '🧠' },
];

// ============================================================================
// AUTOSAVE — localStorage draft persistence
// ============================================================================
const AUTOSAVE_INTERVAL = 3000;

interface DraftData {
  content: string;
  nodeType: string;
  contributionType: string;
  scholarlySummary: string;
  savedAt: string;
  revisionBaseId: string;
}

function getDraftKey(nodeId: string) {
  return `siddhant_edit_draft_${nodeId}`;
}

function saveDraft(nodeId: string, data: DraftData) {
  try { localStorage.setItem(getDraftKey(nodeId), JSON.stringify(data)); } catch {}
}

function loadDraft(nodeId: string): DraftData | null {
  try {
    const raw = localStorage.getItem(getDraftKey(nodeId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function clearDraft(nodeId: string) {
  try { localStorage.removeItem(getDraftKey(nodeId)); } catch {}
}

interface EditFormProps {
  nodeId: string;
  slug: string;
  nodeTitle: string;
  nodeType: string;
  currentReport: string;
  revisionId: string;
  existingAnchors: AuthorityAnchor[];
  canChangeType?: boolean;
  sectionSlugMap?: { slug: string; title: string }[];
}

export default function EditForm({
  nodeId, slug, nodeTitle, nodeType: initialNodeType, currentReport, revisionId, existingAnchors,
  canChangeType = false,
  sectionSlugMap = [],
}: EditFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [viewMode, setViewMode] = useState<'write' | 'preview'>('write');
  const [helperExpanded, setHelperExpanded] = useState(false);
  const [content, setContent] = useState(currentReport);
  const [selectedNodeType, setSelectedNodeType] = useState(initialNodeType);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [contributionType, setContributionType] = useState('');
  const [scholarlySummary, setScholarlySummary] = useState('');
  
  // Autosave and Recovery state
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showDraftRestore, setShowDraftRestore] = useState(false);

  // Server action result handling (no-op/low-signal gate feedback)
  const [actionResult, formAction, isPending] = useActionState<RevisionResult | null, FormData>(
    async (_prevState, formData) => {
      const result = await submitRevision(formData);
      // If we get here without redirect, it means the save was blocked
      if (result && !result.error) {
        // Successful save that didn't redirect (shouldn't happen, but handle gracefully)
        clearDraft(nodeId);
      }
      return result ?? null;
    },
    null,
  );
  const [restoredDraft, setRestoredDraft] = useState<DraftData | null>(null);

  // Sidebar state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    structure: true,
    anchoring: false,
    guidelines: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Check if anything has been edited relative to original props
  const hasUnsavedWork = content !== currentReport || selectedNodeType !== initialNodeType || contributionType !== '' || scholarlySummary !== '';

  // ── Draft Restore on Mount ──
  useEffect(() => {
    const draft = loadDraft(nodeId);
    if (draft && draft.revisionBaseId === revisionId) {
      // Only prompt restore if the draft has different content from the current state
      if (draft.content !== currentReport || draft.nodeType !== initialNodeType) {
        setRestoredDraft(draft);
        setShowDraftRestore(true);
      }
    } else if (draft && draft.revisionBaseId !== revisionId) {
      // Draft is from an older revision base, clear it to avoid confusion
      clearDraft(nodeId);
    }
  }, [nodeId, revisionId, currentReport, initialNodeType]);

  // ── Autosave ──
  useEffect(() => {
    if (!hasUnsavedWork) return;
    const timer = setTimeout(() => {
      setAutosaveStatus('saving');
      saveDraft(nodeId, {
        content,
        nodeType: selectedNodeType,
        contributionType,
        scholarlySummary,
        savedAt: new Date().toISOString(),
        revisionBaseId: revisionId,
      });
      setTimeout(() => setAutosaveStatus('saved'), 400);
      setTimeout(() => setAutosaveStatus('idle'), 2500);
    }, AUTOSAVE_INTERVAL);
    return () => clearTimeout(timer);
  }, [nodeId, content, selectedNodeType, contributionType, scholarlySummary, revisionId, hasUnsavedWork]);

  // ── Draft Restore Handlers ──
  const handleRestoreDraft = () => {
    if (restoredDraft) {
      setContent(restoredDraft.content || currentReport);
      setSelectedNodeType(restoredDraft.nodeType || initialNodeType);
      setContributionType(restoredDraft.contributionType || '');
      setScholarlySummary(restoredDraft.scholarlySummary || '');
    }
    setShowDraftRestore(false);
  };
  const handleDiscardDraft = () => {
    clearDraft(nodeId);
    setShowDraftRestore(false);
    setRestoredDraft(null);
  };

  const typeChanged = selectedNodeType !== initialNodeType;
  const currentTypeInfo = NODE_TYPES.find(nt => nt.value === selectedNodeType) || NODE_TYPES[0];

  return (
    <form action={formAction} className="edit-container">
      <div className="authoring-canvas">
        <input type="hidden" name="node_id" value={nodeId} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="node_type" value={selectedNodeType} />
        <input type="hidden" name="original_node_type" value={initialNodeType} />
        <input type="hidden" name="section_slug_map" value={JSON.stringify(sectionSlugMap)} />

        {/* Blocked save feedback — explicit user-facing message */}
        {actionResult?.error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.25)',
            padding: '14px 18px', borderRadius: '10px', marginBottom: '20px',
            display: 'flex', alignItems: 'flex-start', gap: '12px',
          }}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '1px' }}>⚠</span>
            <div>
              <strong style={{ color: '#ef4444', fontSize: '0.82rem', display: 'block', marginBottom: '4px' }}>
                Revision Not Created
              </strong>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {actionResult.error}
              </p>
            </div>
          </div>
        )}

        {showDraftRestore && restoredDraft && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)',
            padding: '12px 16px', borderRadius: '8px', marginBottom: '24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: '0.82rem', color: 'var(--text-secondary)'
          }}>
            <div>
              <span style={{ marginRight: '8px' }}>📋</span>
              Unfinished revision recovered from {new Date(restoredDraft.savedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={handleRestoreDraft} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>Restore Draft</button>
              <button type="button" onClick={handleDiscardDraft} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Dismiss</button>
            </div>
          </div>
        )}

        <div className="canvas-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="workbench-badge">Editor</span>
              <h1 className="drafting-title-static">{nodeTitle}</h1>
            </div>
            {/* Save Status */}
            <div
              aria-live="polite"
              style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {autosaveStatus === 'saving' && <><span className="signal-dot saving-dot" /> Saving locally...</>}
              {autosaveStatus === 'saved' && <><span className="signal-dot saved-dot" /> Draft saved</>}
              {autosaveStatus === 'idle' && hasUnsavedWork && <><span className="signal-dot idle-dot" /> Auto-saving active</>}
            </div>
          </div>

          <div className="editor-draft-signals">
            <div className="slug-meta">
              <span>URL Slug:</span>
              <span className="slug-badge">{slug}</span>
            </div>
            <div className="draft-scale-meta">
              <span>{content.length.toLocaleString()} characters</span>
              {hasUnsavedWork && <span>Unsaved changes</span>}
            </div>
          </div>

        </div>

        {/* ── Write / Preview Toggle ── */}
        <div className="editor-mode-toggle">
          <button
            type="button"
            className={`mode-btn ${viewMode === 'write' ? 'active' : ''}`}
            onClick={() => setViewMode('write')}
          >
            ✏️ Write
          </button>
          <button
            type="button"
            className={`mode-btn ${viewMode === 'preview' ? 'active' : ''}`}
            onClick={() => setViewMode('preview')}
          >
            👁 Preview
          </button>
        </div>

        <div className="drafting-area" style={{ position: 'relative' }}>
          {viewMode === 'write' ? (
            <>
              {/* ── Persistent Writing Helper ── */}
              <div className="writing-helper compact">
                <button
                  type="button"
                  className="helper-compact-toggle"
                  onClick={() => setHelperExpanded(!helperExpanded)}
                  aria-expanded={helperExpanded}
                >
                  <span className="helper-compact-label">Markup guide</span>
                  <span className={`helper-compact-chevron ${helperExpanded ? 'open' : ''}`}>▸</span>
                </button>
                {helperExpanded && (
                  <div className="helper-expanded-detail">
                    <p className="helper-philosophy-compact">
                      Connect cases, statutes, doctrines, and concepts as you write.
                    </p>
                    <div className="helper-detail-cols">
                      <div className="helper-detail-col">
                        <span className="helper-detail-title">Structure</span>
                        <code># Heading</code>
                        <code>## Sub-heading</code>
                        <code>&gt; Quoted text</code>
                      </div>
                      <div className="helper-detail-col">
                        <span className="helper-detail-title">Link knowledge</span>
                        <code>[[topic-slug]]</code>
                        <code>[[slug|Display Text]]</code>
                      </div>
                      <div className="helper-detail-col">
                        <span className="helper-detail-title">Emphasis</span>
                        <code>**Bold**</code>
                        <code>*Italic*</code>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <textarea
                ref={textareaRef}
                name="report_content"
                className="workbench-textarea"
                placeholder="Expand on this topic here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />

              {/* Authority Anchor Editor — floats relative to textarea */}
              <AuthorityAnchorEditor
                nodeId={nodeId}
                slug={slug}
                revisionId={revisionId}
                existingAnchors={existingAnchors}
                textareaRef={textareaRef}
              />
            </>
          ) : (
            <>
              <div className="preview-header-bar">
                <span className="preview-header-label">📄 Revision Preview</span>
                <span className="preview-header-hint">Headings, blockquotes, and formatting rendered below</span>
              </div>
              <div
                className="preview-pane rendered-markdown"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
              />
              {/* Hidden textarea to keep form data */}
              <textarea name="report_content" value={content} readOnly hidden required />
            </>
          )}
        </div>

        <div className="drafting-footer">
          <div className="commit-box structured-commit-box">
            <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <label className="commit-label" title="How is this node categorized?">Archive Classification</label>
              {/* Node Type — Compact card with change option */}
              <div className="edit-node-type-section" style={{ marginTop: '8px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 14px', borderRadius: '8px',
                  background: typeChanged ? 'rgba(245, 158, 11, 0.06)' : 'var(--bg-surface)',
                  border: `1px solid ${typeChanged ? 'rgba(245, 158, 11, 0.25)' : 'var(--border-subtle)'}`,
                }}>
                  <span style={{ fontSize: '1rem' }}>{currentTypeInfo.icon}</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {currentTypeInfo.label}
                  </span>
                  {typeChanged && (
                    <span style={{
                      fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase',
                      letterSpacing: '0.08em', color: '#f59e0b',
                      padding: '2px 6px', borderRadius: '4px',
                      background: 'rgba(245, 158, 11, 0.1)',
                    }}>
                      Changed
                    </span>
                  )}
                  {canChangeType ? (
                    <button
                      type="button"
                      onClick={() => setShowTypeSelector(!showTypeSelector)}
                      style={{
                        marginLeft: 'auto', padding: '4px 10px', borderRadius: '6px',
                        border: '1px solid var(--border-subtle)', background: 'transparent',
                        color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {showTypeSelector ? 'Close' : 'Change'}
                    </button>
                  ) : (
                    <span style={{
                      marginLeft: 'auto', fontSize: '0.62rem', color: 'var(--text-muted)',
                      fontStyle: 'italic',
                    }}>
                      L3+ to reclassify
                    </span>
                  )}
                </div>

                {showTypeSelector && (
                  <div style={{
                    marginTop: '8px', padding: '12px',
                    background: 'var(--bg-surface)', borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px',
                    }}>
                      {NODE_TYPES.map(nt => (
                        <button
                          key={nt.value}
                          type="button"
                          onClick={() => { setSelectedNodeType(nt.value); setShowTypeSelector(false); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px 10px', borderRadius: '6px',
                            border: selectedNodeType === nt.value
                              ? '2px solid var(--color-gold)'
                              : '1px solid var(--border-subtle)',
                            background: selectedNodeType === nt.value
                              ? 'var(--color-gold-soft)'
                              : 'var(--bg-surface)',
                            cursor: 'pointer', textAlign: 'left',
                            fontSize: '0.75rem', fontWeight: 600,
                            color: 'var(--text-primary)',
                          }}
                        >
                          <span>{nt.icon}</span>
                          <span>{nt.label}</span>
                        </button>
                      ))}
                    </div>
                    {typeChanged && (
                      <div style={{
                        marginTop: '10px', padding: '8px 12px', borderRadius: '8px',
                        background: 'rgba(245, 158, 11, 0.06)',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        fontSize: '0.72rem', color: '#f59e0b', lineHeight: 1.5,
                      }}>
                        ⚠ Changing classification restructures how this node participates in doctrinal relationships and discovery systems. Please note this in your editorial summary below.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <label className="commit-label" title="What scholarly improvement does this revision introduce?">Revision Intent</label>
            
            <div className="commit-grid" style={{ marginBottom: '12px' }}>
              <div>
                <label className="commit-sublabel">Intent</label>
                <select 
                  name="contribution_type" 
                  className="commit-input"
                  required
                  style={{ appearance: 'auto', background: 'rgba(0,0,0,0.2)' }}
                  value={contributionType}
                  onChange={(e) => setContributionType(e.target.value)}
                >
                  <option value="" disabled>Select Type...</option>
                  <option value="Clarification">Clarification</option>
                  <option value="Expansion">Expansion</option>
                  <option value="Citation Addition">Citation Addition</option>
                  <option value="Contradiction Resolution">Contradiction Resolution</option>
                  <option value="Structural Reorganization">Structural Reorganization</option>
                  <option value="Jurisdictional Update">Jurisdictional Update</option>
                  <option value="Case Law Addition">Case Law Addition</option>
                  <option value="Doctrinal Refinement">Doctrinal Refinement</option>
                  <option value="Authority Attribution">Authority Attribution</option>
                  {typeChanged && <option value="Node Type Reclassification">Node Type Reclassification</option>}
                </select>
              </div>
            </div>

            <label className="commit-sublabel">Editorial Summary</label>
            <textarea
              name="scholarly_summary"
              className="commit-input"
              placeholder={typeChanged
                ? `Explain why the classification is being changed from ${NODE_TYPES.find(nt => nt.value === initialNodeType)?.label} to ${currentTypeInfo.label}...`
                : "Summarize the doctrinal or structural change you are introducing..."}
              style={{ resize: 'vertical', minHeight: '60px' }}
              minLength={10}
              required
              value={scholarlySummary}
              onChange={(e) => setScholarlySummary(e.target.value)}
            />
          </div>

          <div className="drafting-actions">
            <button type="submit" className="submit-revision-btn" disabled={isPending}>
              {isPending ? 'Publishing...' : 'Record Revision'}
            </button>
            <Link href={`/topic/${slug}`} className="cancel-btn">Discard</Link>
          </div>
        </div>
      </div>

      <aside className="guidance-sidebar">
        {/* Structure Reference - Visible but muted */}
        <div className="sidebar-card gold-scaffold" style={{ opacity: expandedSections.structure ? 1 : 0.7, transition: 'opacity 0.2s' }}>
          <button type="button" className="sidebar-collapse-header" onClick={() => toggleSection('structure')} style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', padding: 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Structure Reference</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-gold)' }}>{expandedSections.structure ? '▾' : '▸'}</span>
          </button>
          {expandedSections.structure && (
            <ol className="structure-list" style={{ marginTop: '16px' }}>
              <li className="structure-item">
                <span className="item-num">01</span>
                <span className="item-text">
                  <span className="item-label">The Lead</span>
                  2 to 4 sentences defining the concept. The &quot;essential knowledge.&quot;
                </span>
              </li>
              <li className="structure-item">
                <span className="item-num">02</span>
                <span className="item-text">
                  <span className="item-label">Doctrine &amp; Authority</span>
                  Ground your claims. Cite landmark judgments, statutory text, and primary sources.
                </span>
              </li>
              <li className="structure-item">
                <span className="item-num">03</span>
                <span className="item-text">
                  <span className="item-label">Jurisprudence</span>
                  The evolution of the law. Legislative intent, exceptions, and academic commentary.
                </span>
              </li>
            </ol>
          )}
        </div>

        {/* Authority Anchoring Guidance - Contextual / Minimized */}
        <div className="sidebar-card" style={{ opacity: expandedSections.anchoring ? 1 : 0.7, transition: 'opacity 0.2s' }}>
          <button type="button" className="sidebar-collapse-header" onClick={() => toggleSection('anchoring')} style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', padding: 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Authority Anchoring</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{expandedSections.anchoring ? '▾' : '▸'}</span>
          </button>
          {expandedSections.anchoring && (
            <div style={{ marginTop: '12px' }}>
              <p>Select text in the editor, then click <strong>&ldquo;Attach Authority&rdquo;</strong> to anchor cases, statutes, or doctrines to specific claims.</p>
              <ul className="structure-list" style={{ opacity: 0.7, fontSize: '0.78rem', marginTop: '12px' }}>
                <li>• <strong>Select</strong> the text you want to attribute.</li>
                <li>• <strong>Choose</strong> the authority type (case, statute, doctrine...).</li>
                <li>• <strong>Name</strong> the authority or link to an existing archive node.</li>
              </ul>
            </div>
          )}
        </div>

        {/* Editing Guidelines - Collapsed by default */}
        <div className="sidebar-card" style={{ opacity: expandedSections.guidelines ? 1 : 0.7, transition: 'opacity 0.2s' }}>
          <button type="button" className="sidebar-collapse-header" onClick={() => toggleSection('guidelines')} style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', padding: 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Editing Guidelines</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{expandedSections.guidelines ? '▾' : '▸'}</span>
          </button>
          {expandedSections.guidelines && (
            <div style={{ marginTop: '12px' }}>
              <p>Every edit is a permanent contribution to your verifiable professional record.</p>
              <ul className="structure-list" style={{ opacity: 0.7, fontSize: '0.78rem', marginTop: '12px' }}>
                <li>• <strong>Verifiability:</strong> Ground claims in reliable sources.</li>
                <li>• <strong>Neutrality:</strong> Summarize established law without bias.</li>
                <li>• <strong>Clarity:</strong> Write to make the law accessible to all.</li>
              </ul>

              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                <Link
                  href={`/topic/${slug}/edges`}
                  style={{ color: 'var(--color-navy)', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  Manage Doctrinal Relationships
                </Link>
              </div>
            </div>
          )}
        </div>
      </aside>
    </form>
  );
}
