'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createNode } from './actions';
import DraftAuthorityEditor from '@/app/components/DraftAuthorityEditor';
import type { PendingAuthorityAnchor } from '@/app/components/DraftAuthorityEditor';
import './new-topic.css';

// Suspense wrapper required by Next.js for useSearchParams
export default function NewTopicPageWrapper() {
  return (
    <Suspense fallback={
      <div className="new-topic-layout">
        <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
          Loading editor...
        </div>
      </div>
    }>
      <NewTopicPage />
    </Suspense>
  );
}

// ============================================================================
// NODE TYPE ONTOLOGY — With scholarly explanations and examples
// ============================================================================
const NODE_TYPES = [
  { value: 'topic',     label: 'Topic',         icon: '📝', 
    hint: 'A general knowledge subject spanning multiple doctrines or laws.',
    example: 'e.g., Competition Law, Fundamental Rights' },
  { value: 'statute',   label: 'Statute / Act',  icon: '📜', 
    hint: 'An Act of Parliament or State Legislature.',
    example: 'e.g., Indian Penal Code, 1860' },
  { value: 'chapter',   label: 'Chapter / Part',  icon: '📖', 
    hint: 'A structural division within a statute.',
    example: 'e.g., Chapter XVI — Of Offences Affecting the Human Body' },
  { value: 'section',   label: 'Section',         icon: '§',  
    hint: 'A single provision within a statute.',
    example: 'e.g., Section 302 IPC, Section 498A' },
  { value: 'constitutional_provision', label: 'Constitutional Provision', icon: '🏛', 
    hint: 'An Article or Schedule of the Constitution.',
    example: 'e.g., Article 21, Seventh Schedule' },
  { value: 'judgment',  label: 'Judgment / Case', icon: '⚖️', 
    hint: 'A court decision with ratio decidendi.',
    example: 'e.g., Kesavananda Bharati v. State of Kerala' },
  { value: 'doctrine',  label: 'Doctrine',        icon: '💡', 
    hint: 'An established legal principle interpreted through courts.',
    example: 'e.g., Doctrine of Basic Structure, Res Judicata' },
  { value: 'concept',   label: 'Concept',         icon: '🧠', 
    hint: 'A broader legal idea or intellectual framework.',
    example: 'e.g., Mens Rea, Natural Justice, Due Process' },
];

// ============================================================================
// LIVE SCHOLARLY INTELLIGENCE — Pattern detection
// ============================================================================
const CITATION_PATTERNS = [
  /\b(?:AIR|SCC|SCR|Cr\.?\s*LJ|All\s*ER|AC)\s*\d{4}/gi,                    // Reporter citations
  /\(\d{4}\)\s*\d+\s*(?:SCC|SCR|Bom\s*CR|All\s*LJ)/gi,                     // Bracketed citations
  /\b\d{4}\s+(?:AIR|SCC|SCR)\s+\d+/gi,                                      // Year-first citations
];
const SECTION_PATTERN = /\b(?:Section|S\.|Sec\.)\s*\d+[A-Z]?/gi;
const ARTICLE_PATTERN = /\b(?:Article|Art\.)\s*\d+[A-Z]?/gi;
const ACT_PATTERN = /\b(?:Indian Penal Code|IPC|CrPC|Cr\.P\.C\.|CPC|C\.P\.C\.|Constitution of India|Companies Act|IT Act|SEBI Act|Competition Act|PMLA|NI Act|Arbitration Act|Consumer Protection Act|Motor Vehicles Act|Hindu Marriage Act|Transfer of Property Act|Indian Contract Act|Evidence Act|Limitation Act|Specific Relief Act|Negotiable Instruments Act|Code of Criminal Procedure|Code of Civil Procedure)\b/gi;
const CASE_NAME_PATTERN = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+v\.?\s+(?:State\s+of\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g;

function detectScholarlySignals(text: string) {
  if (!text || text.length < 10) return { citations: [], sections: [], articles: [], acts: [], cases: [] };
  
  const citations: string[] = [];
  CITATION_PATTERNS.forEach(pat => {
    const matches = text.match(pat);
    if (matches) citations.push(...matches);
  });
  
  const sections = text.match(SECTION_PATTERN) || [];
  const articles = text.match(ARTICLE_PATTERN) || [];
  const acts = text.match(ACT_PATTERN) || [];
  const cases = text.match(CASE_NAME_PATTERN) || [];
  
  return {
    citations: [...new Set(citations)],
    sections: [...new Set(sections.map(s => s.trim()))],
    articles: [...new Set(articles.map(a => a.trim()))],
    acts: [...new Set(acts.map(a => a.trim()))],
    cases: [...new Set(cases.map(c => c.trim()))].slice(0, 8),
  };
}

// ============================================================================
// PREVIEW RENDERER — Uses shared markdown pipeline
// ============================================================================
import { renderMarkdown } from '@/app/utils/markdownRenderer';


// ============================================================================
// AUTOSAVE — localStorage draft persistence
// ============================================================================
const DRAFT_KEY = 'siddhant_new_article_draft';
const AUTOSAVE_INTERVAL = 3000;

interface DraftData {
  title: string;
  content: string;
  nodeType: string;
  commitMessage: string;
  savedAt: string;
}

function saveDraft(data: DraftData) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch {}
}

function loadDraft(): DraftData | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
function NewTopicPage() {
  const searchParams = useSearchParams();
  const errorFromUrl = searchParams.get('error');

  // Core form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [nodeType, setNodeType] = useState('topic');
  const [commitMessage, setCommitMessage] = useState('Initial article creation');
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // UI state
  const [viewMode, setViewMode] = useState<'write' | 'preview'>('write');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    structure: false, howItWorks: false, ethics: false,
  });
  const [nodeTypeExpanded, setNodeTypeExpanded] = useState(true);
  const [showDraftRestore, setShowDraftRestore] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState<DraftData | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(errorFromUrl ? decodeURIComponent(errorFromUrl) : null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Authority anchoring — collected locally during drafting, saved after node creation
  const [pendingAnchors, setPendingAnchors] = useState<PendingAuthorityAnchor[]>([]);

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const hasUnsavedWork = title.length > 0 || content.length > 0;

  // Live scholarly intelligence
  const signals = useMemo(() => detectScholarlySignals(content), [content]);
  const totalDetections = signals.citations.length + signals.sections.length + signals.articles.length + signals.acts.length + signals.cases.length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  // ── Draft Restore on Mount ──
  useEffect(() => {
    const draft = loadDraft();
    if (draft && (draft.title || draft.content)) {
      setRestoredDraft(draft);
      setShowDraftRestore(true);
    }
  }, []);

  // ── Autosave ──
  useEffect(() => {
    if (!hasUnsavedWork) return;
    const timer = setTimeout(() => {
      setAutosaveStatus('saving');
      saveDraft({ title, content, nodeType, commitMessage, savedAt: new Date().toISOString() });
      setTimeout(() => setAutosaveStatus('saved'), 400);
      setTimeout(() => setAutosaveStatus('idle'), 2500);
    }, AUTOSAVE_INTERVAL);
    return () => clearTimeout(timer);
  }, [title, content, nodeType, commitMessage, hasUnsavedWork]);

  // ── Unsaved Changes Warning ──
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedWork) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedWork]);

  // ── Sidebar toggle ──
  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── Draft restore handlers ──
  const handleRestoreDraft = () => {
    if (restoredDraft) {
      setTitle(restoredDraft.title || '');
      setContent(restoredDraft.content || '');
      setNodeType(restoredDraft.nodeType || 'topic');
      setCommitMessage(restoredDraft.commitMessage || 'Initial article creation');
    }
    setShowDraftRestore(false);
  };
  const handleDiscardDraft = () => {
    clearDraft();
    setShowDraftRestore(false);
    setRestoredDraft(null);
  };

  // ── Form submission wrapper ──
  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    clearDraft();
    await createNode(formData);
  };

  return (
    <div className="new-topic-layout">

      {/* ── DRAFT RESTORE MODAL ── */}
      {showDraftRestore && restoredDraft && (
        <div className="draft-restore-overlay">
          <div className="draft-restore-modal">
            <div className="draft-restore-icon">📋</div>
            <h3>Unsaved Draft Found</h3>
            <p>
              You have an unfinished article from{' '}
              <strong>{new Date(restoredDraft.savedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong>
            </p>
            {restoredDraft.title && (
              <div className="draft-preview-snippet">
                <span className="draft-preview-label">Title:</span> {restoredDraft.title}
              </div>
            )}
            <div className="draft-restore-actions">
              <button className="draft-restore-btn" onClick={handleRestoreDraft}>Restore Draft</button>
              <button className="draft-discard-btn" onClick={handleDiscardDraft}>Start Fresh</button>
            </div>
          </div>
        </div>
      )}

      <form action={handleSubmit} className="new-topic-container">
        
        {/* ── ERROR BANNER ── */}
        {errorMessage && (
          <div className="error-banner">
            <div className="error-banner-content">
              <span className="error-banner-icon">⚠</span>
              <div>
                <strong>Publication could not be completed</strong>
                <p>{errorMessage}</p>
              </div>
            </div>
            <button className="error-banner-close" onClick={() => setErrorMessage(null)} type="button">×</button>
          </div>
        )}

        {/* ── MAIN AUTHORING CANVAS ── */}
        <div className="authoring-canvas">
          <div className="canvas-header">
            <input 
              name="title"
              className="drafting-title-input"
              placeholder="Article Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
            
            <div className="slug-meta">
              <span>URL Slug:</span>
              <span className="slug-badge">{slug || 'auto-generated-slug'}</span>
              <input type="hidden" name="slug" value={slug} />
            </div>

            {/* ── Confidence Signals Bar ── */}
            <div className="confidence-bar">
              {autosaveStatus === 'saving' && (
                <span className="confidence-signal saving">
                  <span className="signal-dot saving-dot" /> Saving locally...
                </span>
              )}
              {autosaveStatus === 'saved' && (
                <span className="confidence-signal saved">
                  <span className="signal-dot saved-dot" /> Draft saved
                </span>
              )}
              {autosaveStatus === 'idle' && hasUnsavedWork && (
                <span className="confidence-signal idle">
                  <span className="signal-dot idle-dot" /> Auto-saving active
                </span>
              )}
              <span className="confidence-signal">
                ✨ Live extraction ready
              </span>
              {wordCount > 0 && (
                <span className="confidence-signal">
                  {wordCount} {wordCount === 1 ? 'word' : 'words'}
                </span>
              )}
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

          {/* ── Content Area ── */}
          <div className="drafting-area">
            {viewMode === 'write' ? (
              <>
              <textarea 
                ref={contentRef}
                name="report_content"
                className="report-textarea"
                placeholder={`Begin your article here...

Structure your article naturally using:
  # Main Heading
  ## Sub-heading
  > Quoted statutory or judicial text
  **Bold** for emphasis, *italic* for terms

Include case names, section numbers, and statutory text.
The platform will extract key facts into a Quick Reference card.`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />

              {/* Authority Anchor Editor — appears on text selection */}
              <DraftAuthorityEditor
                textareaRef={contentRef}
                pendingAnchors={pendingAnchors}
                onAnchorsChange={setPendingAnchors}
              />

              {/* Serialized pending anchors — saved after node creation */}
              <input
                type="hidden"
                name="pending_authority_anchors"
                value={JSON.stringify(pendingAnchors.map(a => ({
                  anchor_text: a.anchor_text,
                  context_before: a.context_before,
                  context_after: a.context_after,
                  paragraph_index: a.paragraph_index,
                  authority_type: a.authority_type,
                  authority_title: a.authority_title,
                  authority_citation: a.authority_citation,
                  authority_url: a.authority_url,
                  authority_node_id: a.authority_node_id,
                })))}
              />
              </>
            ) : (
              <>
                <div className="preview-header-bar">
                <span className="preview-header-label">📄 Article Preview</span>
                  <span className="preview-header-hint">Headings, blockquotes, and references are rendered below</span>
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

          {/* ── Live Intelligence Bar ── */}
          {totalDetections > 0 && (
            <div className="intelligence-bar">
              <div className="intel-header">
                <span className="intel-icon">🔍</span>
                <span className="intel-label">Scholarly Intelligence</span>
                <span className="intel-count">{totalDetections} detected</span>
              </div>
              <div className="intel-chips">
                {signals.sections.map((s, i) => (
                  <span key={`s-${i}`} className="intel-chip section-chip">§ {s}</span>
                ))}
                {signals.articles.map((a, i) => (
                  <span key={`a-${i}`} className="intel-chip article-chip">🏛 {a}</span>
                ))}
                {signals.citations.map((c, i) => (
                  <span key={`c-${i}`} className="intel-chip citation-chip">📎 {c}</span>
                ))}
                {signals.acts.map((a, i) => (
                  <span key={`act-${i}`} className="intel-chip act-chip">📜 {a}</span>
                ))}
                {signals.cases.slice(0, 4).map((c, i) => (
                  <span key={`case-${i}`} className="intel-chip case-chip">⚖️ {c}</span>
                ))}
              </div>
            </div>
          )}

          {/* ── Footer ── */}
          <div className="drafting-footer">
            <div className="commit-box">
              <label className="commit-label">Contribution Summary</label>
              <input 
                name="commit_message"
                className="commit-input-author"
                placeholder="What does this article contribute to Siddhant?"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                required
              />
            </div>

            <div className="drafting-actions">
              <button type="submit" className="publish-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Publishing...' : 'Publish to Archive'}
              </button>
              <Link href="/nodes" className="cancel-btn">Discard</Link>
            </div>
          </div>

          {/* Post-publish notice */}
          <div className="publish-notice">
            This contribution becomes part of Siddhant&apos;s permanent scholarly record.
            It will appear in the archive immediately and undergo AI metadata extraction.
          </div>
        </div>

        {/* ── SIDEBAR GUIDANCE & SETTINGS ── */}
        <aside className="guidance-sidebar">
          
          {/* Node Type Selector — Compact identity card when collapsed */}
          <div className="sidebar-card drafting-settings-card">
            {(() => {
              const selected = NODE_TYPES.find(nt => nt.value === nodeType)!;
              
              if (!nodeTypeExpanded) {
                // ── Compact Identity Card ──
                return (
                  <>
                    <div className="node-type-identity-card">
                      <div className="identity-card-left">
                        <span className="identity-card-icon">{selected.icon}</span>
                        <div>
                          <span className="identity-card-type">{selected.label}</span>
                          <span className="identity-card-hint">{selected.hint}</span>
                        </div>
                      </div>
                      <button type="button" className="identity-change-btn" onClick={() => setNodeTypeExpanded(true)}>
                        Change
                      </button>
                    </div>
                    <input type="hidden" name="node_type" value={nodeType} />
                  </>
                );
              }

              // ── Full Grid (expanded) ──
              return (
                <>
                  <label className="node-type-label-sidebar">What are you drafting?</label>
                  <div className="node-type-grid-sidebar">
                    {NODE_TYPES.map(nt => (
                      <label 
                        key={nt.value} 
                        className={`node-type-option-sidebar ${nodeType === nt.value ? 'selected' : ''}`}
                        title={nt.hint}
                      >
                        <input 
                          type="radio" 
                          name="node_type" 
                          value={nt.value}
                          checked={nodeType === nt.value}
                          onChange={() => { setNodeType(nt.value); setNodeTypeExpanded(false); }}
                        />
                        <span className="node-type-icon-sidebar">{nt.icon}</span>
                        <span className="node-type-name-sidebar">{nt.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="node-type-explanation">
                    <p className="node-type-hint-text">{selected.hint}</p>
                    <p className="node-type-example-text">{selected.example}</p>
                  </div>
                </>
              );
            })()}

            <div className="intelligent-indicator-sidebar">
              <span>✨</span> Live Indexing Active
            </div>
          </div>
          
          {/* ── Collapsible: Structure Reference ── */}
          <div className="sidebar-card gold-scaffold">
            <button type="button" className="sidebar-collapse-header" onClick={() => toggleSection('structure')}>
              <h3>Structure Reference</h3>
              <span className={`collapse-chevron ${expandedSections.structure ? 'expanded' : ''}`}>▸</span>
            </button>
            {expandedSections.structure && (
              <div className="sidebar-collapse-body">
                <p>An Article should flow from a clear summary to a deep dive:</p>
                <ol className="structure-list">
                  <li className="structure-item">
                    <span className="item-num">01</span>
                    <span className="item-text">
                      <span className="item-label">The Lead</span>
                      2–4 sentences defining the concept. The &quot;essential knowledge.&quot;
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
              </div>
            )}
          </div>

          {/* ── Authority Anchoring Cue ── */}
          <div className="sidebar-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ fontSize: '0.9rem', marginTop: '1px', opacity: 0.7 }}>◦</span>
              <p style={{ margin: 0, fontSize: '0.78rem', lineHeight: 1.6, color: 'var(--text-secondary)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
                Ground important legal claims with authorities.
                <span style={{ display: 'block', marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'normal', fontFamily: 'var(--font-sans)' }}>
                  Select text in the editor to attach cases, statutes, or doctrines.
                </span>
              </p>
            </div>
          </div>

          {/* ── Collapsible: The Living Archive ── */}
          <div className="sidebar-card">
            <button type="button" className="sidebar-collapse-header" onClick={() => toggleSection('howItWorks')}>
              <h3>The Living Archive</h3>
              <span className={`collapse-chevron ${expandedSections.howItWorks ? 'expanded' : ''}`}>▸</span>
            </button>
            {expandedSections.howItWorks && (
              <div className="sidebar-collapse-body">
                <p style={{fontSize: '0.78rem', opacity: 0.8, lineHeight: 1.6}}>
                  Focus entirely on clear legal synthesis. When you publish:
                </p>
                <ul className="structure-list" style={{opacity: 0.7, fontSize: '0.78rem'}}>
                  <li>• <strong>Extraction:</strong> Key citations and facts are indexed automatically.</li>
                  <li>• <strong>Structure:</strong> A Quick Reference card is generated to aid readers.</li>
                  <li>• <strong>Collaboration:</strong> Peers will link, review, and build upon your article.</li>
                </ul>
              </div>
            )}
          </div>

          {/* ── Collapsible: Publishing Ethics ── */}
          <div className="sidebar-card">
            <button type="button" className="sidebar-collapse-header" onClick={() => toggleSection('ethics')}>
              <h3>Publishing Ethics</h3>
              <span className={`collapse-chevron ${expandedSections.ethics ? 'expanded' : ''}`}>▸</span>
            </button>
            {expandedSections.ethics && (
              <div className="sidebar-collapse-body">
                <p>Every contribution builds your permanent, verifiable professional record.</p>
                <ul className="structure-list" style={{opacity: 0.7, fontSize: '0.78rem'}}>
                  <li>• <strong>Verifiability:</strong> Ground claims in reliable sources.</li>
                  <li>• <strong>Neutrality:</strong> Summarize established law without bias.</li>
                  <li>• <strong>Clarity:</strong> Write to make the law accessible to all.</li>
                </ul>
              </div>
            )}
          </div>

        </aside>

      </form>
    </div>
  );
}
