'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { computeWordDiff, DiffEntry } from '@/utils/diff-logic';
import { submitRecognition } from '@/app/actions/contributions';
import { flagRevision, clearRevisionFlag, getRevisionDetails } from '@/app/actions/revisions';
import { revertRevision, restoreToVersion } from '@/app/actions/revert';
import { ROLE_LABELS } from '@/app/actions/reputation-constants';
import ScholarStarModal from './ScholarStarModal';
import './spotlight.css';

// ============================================================================
// Semantic Impact Detection — Lightweight content analysis
// ============================================================================
const SECTION_PAT = /\b(?:Section|S\.|Sec\.)\s*\d+[A-Z]?/gi;
const ARTICLE_PAT = /\b(?:Article|Art\.)\s*\d+[A-Z]?/gi;
const ACT_PAT = /\b(?:Indian Penal Code|IPC|CrPC|CPC|Constitution of India|Companies Act|IT Act|SEBI Act|Competition Act|PMLA|NI Act|Arbitration Act|Consumer Protection Act|Motor Vehicles Act|Hindu Marriage Act|Transfer of Property Act|Indian Contract Act|Evidence Act|Limitation Act|Specific Relief Act|Code of Criminal Procedure|Code of Civil Procedure)\b/gi;
const CASE_PAT = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+v\.?\s+(?:State\s+of\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g;
const CITATION_PAT = /\b(?:AIR|SCC|SCR)\s+\d{4}/gi;

function detectReferences(text: string) {
  if (!text) return { sections: [], articles: [], acts: [], cases: [], citations: [] };
  return {
    sections: [...new Set((text.match(SECTION_PAT) || []).map(s => s.trim()))],
    articles: [...new Set((text.match(ARTICLE_PAT) || []).map(s => s.trim()))],
    acts: [...new Set((text.match(ACT_PAT) || []).map(s => s.trim()))],
    cases: [...new Set((text.match(CASE_PAT) || []).map(s => s.trim()))].slice(0, 5),
    citations: [...new Set((text.match(CITATION_PAT) || []).map(s => s.trim()))],
  };
}

function classifyChanges(diffs: DiffEntry[]) {
  const added = diffs.filter(([op]) => op === 'insert').map(([,t]) => t).join(' ');
  const removed = diffs.filter(([op]) => op === 'delete').map(([,t]) => t).join(' ');
  const addedWords = added.trim().split(/\s+/).filter(Boolean).length;
  const removedWords = removed.trim().split(/\s+/).filter(Boolean).length;
  
  const impacts: { label: string, severity: 'major' | 'medium' | 'minor' }[] = [];
  const addedRefs = detectReferences(added);
  const removedRefs = detectReferences(removed);
  
  if (addedRefs.sections.length > 0) impacts.push({ label: 'Added statutory references', severity: 'major' });
  if (addedRefs.cases.length > 0) impacts.push({ label: 'Added case law citations', severity: 'major' });
  if (addedRefs.articles.length > 0) impacts.push({ label: 'Added constitutional references', severity: 'major' });
  if (addedRefs.acts.length > 0) impacts.push({ label: 'Added legislative references', severity: 'major' });
  if (addedRefs.citations.length > 0) impacts.push({ label: 'Added reporter citations', severity: 'medium' });
  if (removedWords > 20 && addedWords > 20) impacts.push({ label: 'Substantial content revision', severity: 'major' });
  else if (addedWords > 50) impacts.push({ label: 'Major content addition', severity: 'major' });
  else if (removedWords > 50) impacts.push({ label: 'Significant content removal', severity: 'medium' });
  else if (addedWords > 10) impacts.push({ label: 'Content expansion', severity: 'medium' });
  if (addedWords > 0 && removedWords > 0 && addedWords < 20 && removedWords < 20) impacts.push({ label: 'Clarification edit', severity: 'minor' });
  
  if (impacts.length === 0) impacts.push({ label: 'Minor textual edit', severity: 'minor' });
  
  return { impacts, addedWords, removedWords, addedRefs };
}

// ============================================================================
// Component
// ============================================================================
interface ContributionReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  revision?: any;
  previousRevision?: any;
  revisionId?: string;
  authorName?: string;
  slug: string;
  allRevisionIds?: string[];
  currentUserRole?: string | null;
}

export default function ContributionReviewDrawer({
  isOpen, onClose,
  revision: initialRevision, previousRevision: initialPrevious,
  revisionId: initialRevId, authorName: initialAuthorName,
  slug, allRevisionIds, currentUserRole
}: ContributionReviewDrawerProps) {
  const [currentRevId, setCurrentRevId] = useState(initialRevId || initialRevision?.id);
  const [revision, setRevision] = useState(initialRevision);
  const [previousRevision, setPreviousRevision] = useState(initialPrevious);
  const [authorName, setAuthorName] = useState(initialAuthorName);
  const [diffs, setDiffs] = useState<DiffEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<'inline' | 'split'>('inline');
  const [selectedType, setSelectedType] = useState<'acknowledge' | 'insightful' | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showDiffEvidence, setShowDiffEvidence] = useState(false);
  const [showGovernance, setShowGovernance] = useState(false);

  // Management State
  const [mgmtAction, setMgmtAction] = useState<'flag' | 'revert' | 'restore' | null>(null);
  const [mgmtReason, setMgmtReason] = useState('');
  const [mgmtSuccess, setMgmtSuccess] = useState(false);
  const [isMgmtPending, startMgmtTransition] = useTransition();

  const isL3Plus = currentUserRole && ['recognized', 'senior_scholar', 'steward', 'governance_council'].includes(currentUserRole);
  const currentUserLevel = currentUserRole ? (ROLE_LABELS[currentUserRole]?.level || 1) : 1;

  // Semantic analysis
  const analysis = useMemo(() => classifyChanges(diffs), [diffs]);
  const newContentText = revision?.report_content || revision?.tier1_content || '';
  const allRefs = useMemo(() => detectReferences(newContentText), [newContentText]);
  const totalRefs = allRefs.sections.length + allRefs.articles.length + allRefs.acts.length + allRefs.cases.length + allRefs.citations.length;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (initialRevId) setCurrentRevId(initialRevId);
    else if (initialRevision?.id) setCurrentRevId(initialRevision.id);
  }, [initialRevId, initialRevision]);

  useEffect(() => {
    if (isOpen && currentRevId) {
      const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        setSuccess(false);
        setShowDiffEvidence(false);
        
        const res = await getRevisionDetails(currentRevId);
        if (res.error) { setError(res.error); setIsLoading(false); return; }
        const currentRev = res.revision;
        const prevRev = res.previous;
        if (!currentRev) { setError('Revision data unavailable'); setIsLoading(false); return; }
        
        setRevision(currentRev);
        setPreviousRevision(prevRev);
        const profileData = Array.isArray(currentRev.profiles) ? currentRev.profiles[0] : currentRev.profiles;
        setAuthorName(profileData?.username || 'Unknown');

        const oldText = prevRev?.report_content || prevRev?.tier1_content || '';
        const newText = currentRev?.report_content || currentRev?.tier1_content || '';
        setDiffs(computeWordDiff(oldText, newText));
        setIsLoading(false);
      };
      fetchData();
    }
  }, [isOpen, currentRevId]);

  const currentIndex = allRevisionIds ? allRevisionIds.indexOf(currentRevId || '') : -1;
  const goToNext = () => { if (allRevisionIds && currentIndex > 0) { setCurrentRevId(allRevisionIds[currentIndex - 1]); setSelectedType(null); setComment(''); } };
  const goToPrev = () => { if (allRevisionIds && currentIndex < allRevisionIds.length - 1) { setCurrentRevId(allRevisionIds[currentIndex + 1]); setSelectedType(null); setComment(''); } };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft') {
        if (allRevisionIds && currentIndex < allRevisionIds.length - 1) goToPrev();
      } else if (e.key === 'ArrowRight') {
        if (allRevisionIds && currentIndex > 0) goToNext();
      }
    };
    if (isOpen && !isLoading && !isPending && !isMgmtPending) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, currentIndex, allRevisionIds, isLoading, isPending, isMgmtPending]);

  // Structured Intent Parsing
  const commitMsg = revision?.commit_message || 'No contribution summary provided.';
  const typeMatch = commitMsg.match(/^\[(.*?)\]\s*(.*)/);
  const contributionType = typeMatch ? typeMatch[1] : null;
  const scholarlySummary = typeMatch ? typeMatch[2] : commitMsg;

  // Impact Snippets
  const impactSnippets = useMemo(() => {
    const snippets: string[] = [];
    const inserted = diffs.filter(d => d[0] === 'insert').map(d => d[1].trim()).filter(t => t.length > 5);
    const deleted = diffs.filter(d => d[0] === 'delete').map(d => d[1].trim()).filter(t => t.length > 5);
    if (inserted.length > 0) snippets.push(`Added: "...${inserted[0].substring(0, 50)}..."`);
    if (deleted.length > 0) snippets.push(`Removed: "...${deleted[0].substring(0, 50)}..."`);
    return snippets;
  }, [diffs]);

  const handleSubmit = () => {
    if (!selectedType) return;
    setError(null);
    startTransition(async () => {
      const res = await submitRecognition(revision.id, slug, selectedType, comment, true);
      if (res.error) { setError(res.error); }
      else { setSuccess(true); setTimeout(() => { onClose(); setSuccess(false); setSelectedType(null); setComment(''); }, 2000); }
    });
  };

  const handleManagementAction = () => {
    if (!mgmtAction || mgmtReason.trim().length < 10) return;
    setError(null);
    startMgmtTransition(async () => {
      let res: any;
      if (mgmtAction === 'flag') res = await flagRevision(revision.id, mgmtReason, slug);
      else if (mgmtAction === 'revert') res = await revertRevision(revision.id, mgmtReason, slug);
      else if (mgmtAction === 'restore') res = await restoreToVersion(revision.id, mgmtReason, slug);
      if (res?.error) { setError(res.error); }
      else { setMgmtSuccess(true); setTimeout(() => { onClose(); setMgmtSuccess(false); setMgmtAction(null); setMgmtReason(''); }, 1500); }
    });
  };

  const handleClearFlag = () => {
    setError(null);
    startMgmtTransition(async () => {
      const res = await clearRevisionFlag(revision.id, slug);
      if (res.error) { setError(res.error); }
      else { setMgmtSuccess(true); setTimeout(() => { onClose(); setMgmtSuccess(false); }, 1500); }
    });
  };

  if (!isOpen || !mounted) return null;

  const content = (
    <div className="drawer-overlay" onClick={(e) => e.target === e.currentTarget && onClose()} style={{ zIndex: 100000 }}>
      <div className={`drawer-content ${viewMode === 'split' ? 'split-mode' : ''}`}>
        {/* ── HEADER ── */}
        <header className="drawer-header" style={{ flexDirection: 'column', gap: '1rem', paddingBottom: '1rem' }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 className="drawer-title">Review Contribution</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                by <strong style={{ color: 'var(--color-gold)' }}>@{authorName || '...'}</strong>
              </p>
            </div>
            <button className="close-drawer" onClick={onClose}>×</button>
          </div>

          <div className="drawer-toolbar">
            <div className="nav-controls">
              <button className="nav-btn" onClick={goToPrev} disabled={currentIndex === -1 || (allRevisionIds && currentIndex === allRevisionIds.length - 1)} title="Older Revision (←)">←</button>
              <div className="toolbar-meta">
                <span className="nav-indicator">{allRevisionIds && currentIndex !== -1 ? `${currentIndex + 1} / ${allRevisionIds.length}` : '—'}</span>
                {contributionType && <span className="toolbar-type-chip">{contributionType}</span>}
                <span className="toolbar-date">{revision?.created_at ? new Date(revision.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</span>
              </div>
              <button className="nav-btn" onClick={goToNext} disabled={currentIndex <= 0} title="Newer Revision (→)">→</button>
            </div>
            <div className="view-toggle">
              <button className={`toggle-btn ${viewMode === 'inline' ? 'active' : ''}`} onClick={() => setViewMode('inline')}>Inline</button>
              <button className={`toggle-btn ${viewMode === 'split' ? 'active' : ''}`} onClick={() => setViewMode('split')}>Split</button>
            </div>
          </div>
        </header>

        {/* ── BODY ── */}
        <div className="drawer-body">
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px 0' }}>
              <div style={{ height: '100px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', animation: 'pulse 1.5s infinite' }} />
              <div style={{ height: '200px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', animation: 'pulse 1.5s infinite' }} />
            </div>
          ) : (
            <>
              {/* ═══════════════════════════════════════════
                  SECTION 1: CONTRIBUTION INTENT
                  ═══════════════════════════════════════════ */}
              <section className="review-section intent-section">
                <div className="section-label">
                  📋 Contribution Summary
                  {contributionType && (
                    <span className="contribution-type-badge">{contributionType}</span>
                  )}
                </div>
                <div className="intent-card">
                  <p className="intent-message">
                    {scholarlySummary}
                  </p>
                  <div className="intent-meta">
                    <span>{new Date(revision?.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span>•</span>
                    <span>{analysis.addedWords > 0 ? `+${analysis.addedWords}` : ''}{analysis.addedWords > 0 && analysis.removedWords > 0 ? ' / ' : ''}{analysis.removedWords > 0 ? `-${analysis.removedWords}` : ''} words</span>
                  </div>
                </div>
              </section>

              {/* ═══════════════════════════════════════════
                  SECTION 2: SCHOLARLY IMPACT
                  ═══════════════════════════════════════════ */}
              <section className="review-section impact-section">
                <div className="section-label">⚡ Scholarly Impact</div>
                <div className="impact-chips">
                  {analysis.impacts.map((impact, i) => (
                    <span key={i} className={`impact-chip severity-${impact.severity}`}>{impact.label}</span>
                  ))}
                </div>
                {totalRefs > 0 && (
                  <div className="detected-refs">
                    <div className="refs-label">Detected Legal References</div>
                    <div className="refs-chips">
                      {allRefs.sections.map((s, i) => <span key={`s${i}`} className="ref-chip section">§ {s}</span>)}
                      {allRefs.articles.map((a, i) => <span key={`a${i}`} className="ref-chip article">🏛 {a}</span>)}
                      {allRefs.acts.map((a, i) => <span key={`act${i}`} className="ref-chip act">📜 {a}</span>)}
                      {allRefs.citations.map((c, i) => <span key={`c${i}`} className="ref-chip citation">📎 {c}</span>)}
                      {allRefs.cases.map((c, i) => <span key={`case${i}`} className="ref-chip case">⚖️ {c}</span>)}
                    </div>
                  </div>
                )}
              </section>

              {/* ═══════════════════════════════════════════
                  SECTION 3: DIFF EVIDENCE (collapsible)
                  ═══════════════════════════════════════════ */}
              <section className="review-section diff-evidence-section">
                {!showDiffEvidence && impactSnippets.length > 0 && (
                  <div className="impact-snippets-preview">
                    {impactSnippets.map((snip, i) => (
                      <div key={i} className="snippet-item">› {snip}</div>
                    ))}
                  </div>
                )}
                <button type="button" className="section-collapse-toggle" onClick={() => setShowDiffEvidence(!showDiffEvidence)}>
                  <div className="section-label">🔍 Textual Evidence</div>
                  <span className={`section-chevron ${showDiffEvidence ? 'expanded' : ''}`}>
                    {showDiffEvidence ? 'Hide' : 'Show Diff'}
                  </span>
                </button>

                {showDiffEvidence && (
                  <div className="diff-evidence-body">
                    {viewMode === 'split' ? (
                      <div className="split-view-grid">
                        <div className="split-column">
                          <div className="column-label">ORIGINAL</div>
                          <div className="diff-preview-card split-card">
                            {diffs.map(([op, text], i) => (
                              op !== 'insert' && (
                                <span key={i} className={`diff-word ${op === 'delete' ? 'diff-minus' : 'diff-neutral'}`}>{text}</span>
                              )
                            ))}
                          </div>
                        </div>
                        <div className="split-column">
                          <div className="column-label">MODIFIED</div>
                          <div className="diff-preview-card split-card">
                            {diffs.map(([op, text], i) => (
                              op !== 'delete' && (
                                <span key={i} className={`diff-word ${op === 'insert' ? 'diff-plus' : 'diff-neutral'}`}>{text}</span>
                              )
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="diff-preview-card">
                        {diffs.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>No content changes detected.</p>
                        ) : (
                          diffs.map(([op, text], i) => (
                            <span key={i} className={`diff-word ${op === 'insert' ? 'diff-plus' : op === 'delete' ? 'diff-minus' : 'diff-neutral'}`}>{text}</span>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* ═══════════════════════════════════════════
                  SECTION 4: REVIEWER JUDGMENT
                  ═══════════════════════════════════════════ */}
              {!success ? (
                <section className="review-section judgment-section">
                  <div className="section-label">📝 Reviewer Judgment</div>
                  <div className="recognition-options-grid">
                    <button 
                      className={`option-card ${selectedType === 'acknowledge' ? 'selected' : ''}`}
                      onClick={() => setSelectedType('acknowledge')}
                    >
                      <span className="option-icon">👏</span>
                      <span className="option-label">Acknowledge</span>
                      <span className="option-desc">Solid contribution (+1 Rep).</span>
                    </button>
                    <button 
                      className={`option-card ${selectedType === 'insightful' ? 'selected' : ''} ${currentUserLevel < 2 ? 'locked' : ''}`}
                      onClick={() => setSelectedType('insightful')}
                    >
                      <span className="option-icon">💡</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <span className="option-label">Insightful</span>
                        {currentUserLevel < 2 && (
                          <span style={{ fontSize: '0.6rem', padding: '2px 6px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '4px', fontWeight: 800 }}>L2+ REQ</span>
                        )}
                      </div>
                      <span className="option-desc">Deepens legal clarity (+10 Rep).</span>
                    </button>
                  </div>

                  {selectedType === 'insightful' && currentUserLevel < 2 && (
                    <div className="level-warning">
                      <strong>Level 2 (Contributor) Required</strong><br/>
                      You must contribute edits before judging the legal insight of others.
                    </div>
                  )}

                  {selectedType && (currentUserLevel >= 2 || selectedType === 'acknowledge') && (
                    <div style={{ marginTop: '1.2rem' }}>
                      <label className="section-label" style={{ marginBottom: '8px', display: 'block', fontSize: '0.65rem' }}>
                        Professional Note (Visible in Discussion)
                      </label>
                      <textarea 
                        className="review-comment-field"
                        placeholder='e.g. "Excellent synthesis of the recent ruling. This adds needed clarity."'
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                      />
                    </div>
                  )}

                  {/* Scholar Star — Ceremonial, separated */}
                  {revision && (
                    <div className="scholar-star-section">
                      <div className="star-divider" />
                      <p className="star-question">Is this an exceptional, landmark-quality contribution?</p>
                      <ScholarStarModal 
                        recipientId={revision.author_id}
                        recipientUsername={authorName || 'contributor'}
                        sourceId={revision.id}
                        sourceType="revision"
                        currentUserRole={currentUserRole}
                      />
                    </div>
                  )}
                </section>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', animation: 'fadeIn 0.5s' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✨</div>
                  <h3 style={{ color: 'var(--color-gold)', marginBottom: '8px' }}>Recognition Submitted</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Your endorsement has been recorded.</p>
                </div>
              )}

              {/* ═══════════════════════════════════════════
                  SECTION 5: GOVERNANCE (collapsible, separate)
                  ═══════════════════════════════════════════ */}
              {!success && (
                <section className="review-section governance-section">
                  <button type="button" className="section-collapse-toggle governance-toggle" onClick={() => setShowGovernance(!showGovernance)}>
                    <div className="section-label governance-label">🛡️ Governance Actions</div>
                    <span className={`section-chevron ${showGovernance ? 'expanded' : ''}`}>
                      {showGovernance ? 'Hide' : 'Expand'}
                    </span>
                  </button>

                  {showGovernance && (
                    <div className="governance-body">
                      {revision?.is_flagged && (
                        <div className="flag-alert-box">
                          <div className="flag-alert-header">
                            <span>⚑ CURRENTLY FLAGGED</span>
                            {isL3Plus && (
                              <button onClick={handleClearFlag} disabled={isMgmtPending} className="clear-flag-btn">Clear Flag</button>
                            )}
                          </div>
                          <p className="flag-reason-text">Reason: {revision.flag_reason}</p>
                        </div>
                      )}

                      {!mgmtAction ? (
                        <div className="mgmt-button-grid">
                          <button className="mgmt-action-btn flag" onClick={() => setMgmtAction('flag')}>⚑ Flag Issue</button>
                          {isL3Plus && currentIndex === 0 && (
                            <button className="mgmt-action-btn revert" onClick={() => setMgmtAction('revert')}>↩ Undo Latest Edit</button>
                          )}
                          {isL3Plus && currentIndex !== 0 && (
                            <button className="mgmt-action-btn restore" onClick={() => setMgmtAction('restore')}>⏮ Restore to This Version</button>
                          )}
                        </div>
                      ) : (
                        <div className="mgmt-form">
                          <label className="mgmt-form-label">
                            {mgmtAction === 'flag' ? 'Reason for flagging:' : mgmtAction === 'revert' ? 'Reason for revert:' : 'Reason for restore:'}
                          </label>
                          <textarea className="mgmt-reason-field" placeholder="Please provide a brief justification (min 10 chars)..." value={mgmtReason} onChange={(e) => setMgmtReason(e.target.value)} />
                          <div className="mgmt-form-actions">
                            <button className={`mgmt-submit-btn ${mgmtAction}`} disabled={mgmtReason.trim().length < 10 || isMgmtPending} onClick={handleManagementAction}>
                              {isMgmtPending ? 'Processing...' : `Confirm ${mgmtAction.charAt(0).toUpperCase() + mgmtAction.slice(1)}`}
                            </button>
                            <button className="mgmt-cancel-btn" onClick={() => setMgmtAction(null)}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}
            </>
          )}

          {error && (
            <div style={{ padding: '12px', border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: '#ef4444', fontSize: '0.8rem', marginTop: '1rem' }}>
              {error}
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        {!success && !isLoading && (
          <footer className="review-footer">
            <button 
              className="submit-recognition-btn"
              disabled={!selectedType || (selectedType === 'insightful' && currentUserLevel < 2) || isPending}
              onClick={handleSubmit}
            >
              {isPending ? 'Processing...' : 'Confirm Recognition'}
            </button>
            <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
              By confirming, you award professional reputation and publicly acknowledge @{authorName}&apos;s scholarship on this topic.
            </p>
          </footer>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.3; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );

  return createPortal(content, document.body);
}
