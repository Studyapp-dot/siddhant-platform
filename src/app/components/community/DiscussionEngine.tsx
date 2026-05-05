'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  THREAD_TYPES, ROLE_LABELS, ANSWER_THREAD_TYPES, REFERENCE_TYPES,
  ThreadType, SortMode, FilterMode,
  type Author, type Message, type ThreadCloseHandler, type ReasoningSignal
} from './DiscussionTypes'
import { ScholarlyContent } from './ScholarlyContent'

/* ─── Icons ─── */
const Icons = {
  User: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  ),
  Message: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
  ),
  CheckCircle: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
  ),
  Lock: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
  ),
  Pen: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
  ),
  Endorse: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  ),
  Bookmark: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
  ),
  Quote: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/></svg>
  ),
}

/* ─── Thread Type Badge ─── */
function TypeBadge({ type }: { type: ThreadType }) {
  const t = THREAD_TYPES[type] || THREAD_TYPES.general;
  return (
    <span className="de-type-badge" style={{ color: t.color, background: t.bg, border: `1px solid ${t.border}` }}>
      {t.icon} {t.label}
    </span>
  );
}

/* ─── Thread Controls (Sort/Filter) ─── */
function ThreadControls({ sort, onSort, filter, onFilter, counts }: {
  sort: SortMode; onSort: (s: SortMode) => void;
  filter: FilterMode; onFilter: (f: FilterMode) => void;
  counts: { total: number; open: number; resolved: number };
}) {
  return (
    <div className="de-controls">
      <div className="de-controls-left">
        <span className="de-controls-label">Sort</span>
        {([['recent', 'Most Recent'], ['useful', 'Most Endorsed'], ['active', 'Active First']] as [SortMode, string][]).map(([key, label]) => (
          <button key={key} className={`de-ctrl-btn ${sort === key ? 'active' : ''}`} onClick={() => onSort(key)}>{label}</button>
        ))}
      </div>
      <div className="de-controls-right">
        <span className="de-controls-label">Filter</span>
        <button className={`de-ctrl-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => onFilter('all')}>All ({counts.total})</button>
        {(['question', 'interpretation', 'improvement', 'issue'] as ThreadType[]).map(t => (
          <button key={t} className={`de-ctrl-btn ${filter === t ? 'active' : ''}`} onClick={() => onFilter(t as FilterMode)}>
            {THREAD_TYPES[t].icon}
          </button>
        ))}
        <button className={`de-ctrl-btn ${filter === 'resolved' ? 'active' : ''}`} onClick={() => onFilter('resolved')}>
          Resolved ({counts.resolved})
        </button>
      </div>
    </div>
  );
}

/* ─── Endorsement Button ─── */
function EndorseButton({ messageId, count, voted, onToggle }: {
  messageId: string; count: number; voted: boolean;
  onToggle?: (id: string) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [localCount, setLocalCount] = useState(count);
  const [localVoted, setLocalVoted] = useState(voted);
  const lastToggleRef = React.useRef(0);

  const handle = async () => {
    if (!onToggle || loading) return;
    // Debounce: prevent rapid toggling (min 1.5s between actions)
    const now = Date.now();
    if (now - lastToggleRef.current < 1500) return;
    lastToggleRef.current = now;
    setLoading(true);
    try {
      await onToggle(messageId);
      setLocalVoted(!localVoted);
      setLocalCount(prev => localVoted ? prev - 1 : prev + 1);
    } finally { setLoading(false); }
  };

  return (
    <button className={`de-endorse-btn ${localVoted ? 'endorsed' : ''}`} onClick={handle} disabled={loading} title="Endorse this reasoning">
      <Icons.Endorse />
      <span className="de-endorse-label">Endorse</span>
      {localCount > 0 && <span className="de-endorse-count">{localCount}</span>}
    </button>
  );
}

/* ─── Reasoning Quality Signal ─── */
function computeReasoningSignal(message: Message, siblings: Message[]): ReasoningSignal {
  const count = message.vote_count || 0;
  if (count >= 3) {
    // Check for contested even if well_supported: ≥2 siblings with ≥2 endorsements each
    const strongSiblings = siblings.filter(s => s.id !== message.id && (s.vote_count || 0) >= 2);
    if (strongSiblings.length >= 1 && count < 5) return 'contested';
    return 'well_supported';
  }
  if (count >= 1) {
    // Contested: ≥2 siblings each have ≥2 endorsements
    const strongSiblings = siblings.filter(s => s.id !== message.id && (s.vote_count || 0) >= 2);
    if (strongSiblings.length >= 1 && count >= 2) return 'contested';
    return 'emerging';
  }
  return null;
}

const SIGNAL_LABELS: Record<string, { label: string; className: string }> = {
  well_supported: { label: 'Well Supported', className: 'de-signal-supported' },
  emerging: { label: 'Emerging', className: 'de-signal-emerging' },
  contested: { label: 'Contested', className: 'de-signal-contested' },
};

/* ─── Reference Block ─── */
function ReferenceBlock({ text, type }: { text: string; type?: string | null }) {
  const refInfo = type && REFERENCE_TYPES[type] ? REFERENCE_TYPES[type] : null;
  return (
    <div className="de-reference-block">
      <div className="de-reference-header">
        <Icons.Quote />
        <span>{refInfo ? `${refInfo.icon} ${refInfo.label}` : 'Reference'}</span>
      </div>
      <div className="de-reference-text">{text}</div>
    </div>
  );
}

/* ─── Follow Button ─── */
function FollowButton({ threadId, isFollowing, onToggle }: {
  threadId: string; isFollowing: boolean; onToggle?: (id: string) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [localFollowing, setLocalFollowing] = useState(isFollowing);

  const handle = async () => {
    if (!onToggle || loading) return;
    setLoading(true);
    try {
      await onToggle(threadId);
      setLocalFollowing(!localFollowing);
    } finally { setLoading(false); }
  };

  return (
    <button className={`de-follow-btn ${localFollowing ? 'following' : ''}`} onClick={handle} disabled={loading}>
      <Icons.Bookmark />
      <span>{localFollowing ? 'Following' : 'Follow'}</span>
    </button>
  );
}

/* ─── Statement Node (Individual Post) ─── */
export function StatementNode({ message, onReply, onEndorse, isRoot = false, isAnswer = false, level = 1, index = 1, prefix = '', threadClosed = false, siblingMessages = [], showReferenceInput = false, suppressChildren = false, isTopAnswer = false, answerMode = false }: {
  message: Message; onReply?: (content: string, parentId: string, threadType?: ThreadType, referenceText?: string, referenceType?: string) => Promise<void>;
  onEndorse?: (id: string) => Promise<void>;
  isRoot?: boolean; isAnswer?: boolean; level?: number; index?: number; prefix?: string; threadClosed?: boolean;
  siblingMessages?: Message[]; showReferenceInput?: boolean; suppressChildren?: boolean; isTopAnswer?: boolean; answerMode?: boolean;
}) {
  const [isReplying, setIsReplying] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(level >= 4);

  const hasReplies = message.replies && message.replies.length > 0;
  const sectionMark = prefix ? `${prefix}.${index}` : `${index}`;
  const roleLabel = ROLE_LABELS[message.author.role || ''] || 'Contributor';

  // Depth-based styling: after level 3, use compact mode
  const isDeep = level > 3;
  const depthClass = isDeep ? 'de-node-deep' : '';

  return (
    <div className={`de-node ${isRoot ? 'de-node-root' : isAnswer ? 'de-node-answer' : 'de-node-reply'} ${depthClass} ${isTopAnswer ? 'de-node-top-answer' : ''}`}>
      <div className={`de-statement ${isRoot ? 'de-statement-root' : isAnswer ? 'de-statement-answer' : ''} ${isTopAnswer ? 'de-statement-top-answer' : ''}`}>
        {/* Top Answer badge */}
        {isTopAnswer && <div className="de-top-answer-label">Top Answer</div>}
        {/* Answer scan anchor — minimal, not numbered */}
        {isAnswer && !isTopAnswer && <div className="de-answer-label">Answer</div>}

        {/* Author */}
        <div className="de-author">
          <div className="de-avatar">{message.author.name?.[0]?.toUpperCase() || '?'}</div>
          <div className="de-author-info">
            <Link href={`/profile/${message.author.name}`} className="de-author-name">{message.author.name}</Link>
            <div className="de-author-meta">
              <span className="de-role-badge">{roleLabel}</span>
              {message.author.reputation !== undefined && message.author.reputation > 0 && (
                <span className="de-rep-indicator">⟡ {message.author.reputation}</span>
              )}
            </div>
          </div>
          <span className="de-timestamp">
            {new Date(message.created_at).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        {/* Content — with [[wiki-link]] rendering (Phase 5) */}
        <div className="de-content"><ScholarlyContent content={message.content} /></div>

        {/* Reference citation */}
        {message.reference_text && (
          <ReferenceBlock text={message.reference_text} type={message.reference_type} />
        )}

        {/* Reasoning signal (answers only) */}
        {isAnswer && (() => {
          const signal = computeReasoningSignal(message, siblingMessages);
          if (!signal) return null;
          const info = SIGNAL_LABELS[signal];
          return <span className={`de-signal-badge ${info.className}`}>{info.label}</span>;
        })()}

        {/* Actions */}
        <div className="de-actions">
          <EndorseButton messageId={message.id} count={message.vote_count || 0} voted={message.user_voted || false} onToggle={onEndorse} />
          {!threadClosed && onReply && (
            <button className={`de-action-btn ${answerMode ? 'de-action-btn-primary' : ''}`} onClick={() => setIsReplying(!isReplying)}>
              <Icons.Message /> <span>{answerMode ? 'Answer' : 'Reply'}</span>
            </button>
          )}
          {hasReplies && !suppressChildren && (
            <button className="de-collapse-btn" onClick={() => setIsCollapsed(!isCollapsed)}>
              {isCollapsed ? `Show ${message.replies!.length} ${message.replies!.length === 1 ? 'reply' : 'replies'}` : 'Collapse'}
            </button>
          )}
        </div>

        {/* Inline reply form */}
        {isReplying && !threadClosed && (
          <div style={{ marginTop: '1.5rem' }}>
            <DiscussionForm
              placeholder={answerMode ? 'Present your analysis or position…' : `Respond to §${sectionMark}…`}
              mode={answerMode ? 'answer' : 'reply'}
              showReferenceField={showReferenceInput || answerMode}
              onSubmit={async (content, _type, refText, refType) => { await onReply?.(content, message.id, undefined, refText, refType); setIsReplying(false); }}
              onCancel={() => setIsReplying(false)}
            />
          </div>
        )}
      </div>

      {/* Nested replies — suppressed when parent handles rendering (answer-structured threads) */}
      {hasReplies && !isCollapsed && !suppressChildren && (
        <div className={`de-branch ${isDeep ? 'de-branch-compact' : ''}`}>
          {message.replies!.map((reply, idx) => (
            <StatementNode key={reply.id} message={reply} onReply={onReply} onEndorse={onEndorse}
              level={level + 1} index={idx + 1} prefix={sectionMark} threadClosed={threadClosed} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Discussion Form ─── */
export function DiscussionForm({ onSubmit, onCancel, placeholder, mode = 'new', onTypeSelect, selectedType, showReferenceField = false }: {
  onSubmit: (content: string, type?: ThreadType, referenceText?: string, referenceType?: string) => Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  mode?: 'new' | 'reply' | 'close' | 'answer';
  onTypeSelect?: (t: ThreadType) => void;
  selectedType?: ThreadType;
  showReferenceField?: boolean;
}) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localType, setLocalType] = useState<ThreadType | undefined>(selectedType);
  const [showRef, setShowRef] = useState(false);
  const [refText, setRefText] = useState('');
  const [refType, setRefType] = useState('');

  const showTypeSelector = mode === 'new';
  const canShowReference = showReferenceField || mode === 'new';
  const activeType = localType ? THREAD_TYPES[localType] : null;
  const activePlaceholder = placeholder || (activeType?.placeholder) || 'Select a discussion type to begin…';

  const handleSubmit = async () => {
    if (!content.trim()) return;
    if (showTypeSelector && !localType) return;
    // Reference validation: min 10 chars if provided
    const trimmedRef = refText.trim();
    if (trimmedRef && trimmedRef.length < 10) return; // silently block too-short refs
    setIsSubmitting(true);
    try {
      await onSubmit(content, localType, trimmedRef || undefined, (trimmedRef && refType) ? refType : undefined);
      setContent('');
      setLocalType(undefined);
      setRefText('');
      setRefType('');
      setShowRef(false);
    } finally { setIsSubmitting(false); }
  };

  const handleType = (t: ThreadType) => {
    setLocalType(t);
    onTypeSelect?.(t);
  };

  return (
    <div className="de-form">
      <div className="de-form-header">
        <div className="de-form-title">
          <Icons.Pen />
          {mode === 'new' ? 'Contribute' : mode === 'answer' ? 'Answer' : mode === 'reply' ? 'Reply' : 'Record Consensus'}
        </div>
      </div>

      {/* Discussion category — editorial, not ticketing */}
      {showTypeSelector && (
        <div className="de-type-selector">
          {(['question', 'interpretation', 'improvement', 'issue'] as ThreadType[]).map(t => {
            const info = THREAD_TYPES[t];
            return (
              <button key={t} className={`de-type-option ${localType === t ? 'selected' : ''}`}
                style={localType === t ? { borderColor: info.color, background: info.bg } : {}}
                onClick={() => handleType(t)}>
                <span className="de-type-option-icon">{info.icon}</span>
                <span className="de-type-option-label">{info.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <textarea className="de-textarea" placeholder={activePlaceholder} value={content}
        onChange={(e) => setContent(e.target.value)} disabled={isSubmitting || (showTypeSelector && !localType)} />

      {/* Reference field (collapsible, optional) */}
      {canShowReference && mode !== 'close' && (
        <div className="de-reference-input">
          {!showRef ? (
            <button className="de-reference-toggle" onClick={() => setShowRef(true)}>
              <Icons.Quote /> Add reference (optional)
            </button>
          ) : (
            <div className="de-reference-fields">
              <div className="de-reference-fields-row">
                <select className="de-reference-select" value={refType} onChange={e => setRefType(e.target.value)}>
                  <option value="">Type (optional)</option>
                  <option value="case">⚖️ Case</option>
                  <option value="section">§ Section</option>
                  <option value="article">📄 Article</option>
                  <option value="statute">📜 Statute</option>
                  <option value="commentary">📖 Commentary</option>
                </select>
                <button className="de-reference-toggle" onClick={() => { setShowRef(false); setRefText(''); setRefType(''); }}>
                  Cancel
                </button>
              </div>
              <input className="de-reference-input-field" type="text" placeholder="e.g., Maneka Gandhi v. Union of India (1978) AIR SC 597"
                value={refText} onChange={e => setRefText(e.target.value)} />
              {refText.trim().length > 0 && refText.trim().length < 10 && (
                <span className="de-reference-hint">Reference must be at least 10 characters</span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="de-form-footer">
        <div className="de-form-status">
          <div className={`de-status-dot ${content.trim() ? 'ready' : ''}`} />
          <span>{content.trim() ? 'Ready' : showTypeSelector && !localType ? 'Choose category' : 'Begin writing'}</span>
        </div>
        <div className="de-form-actions">
          {onCancel && <button className="de-btn-discard" onClick={onCancel} disabled={isSubmitting}>Discard</button>}
          <button className="de-btn-submit" onClick={handleSubmit}
            disabled={isSubmitting || !content.trim() || (showTypeSelector && !localType)}>
            {isSubmitting ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Consensus Outcome ─── */
export function ConsensusRecord({ record }: { record: { closed_by_name: string; closed_at: string; summary: string; cited_count?: number; impact_summary?: string | null } }) {
  const strengthLabel = (record.cited_count || 0) >= 3 ? 'Strong Consensus' : (record.cited_count || 0) >= 2 ? 'Moderate Consensus' : (record.cited_count || 0) >= 1 ? 'Weak Consensus' : null;
  const strengthClass = (record.cited_count || 0) >= 3 ? 'strong' : (record.cited_count || 0) >= 2 ? 'moderate' : 'weak';

  return (
    <div className="de-consensus">
      <div className="de-consensus-header">
        <Icons.CheckCircle />
        <span className="de-consensus-title">Consensus Outcome (Final)</span>
        {strengthLabel && <span className={`de-consensus-strength ${strengthClass}`}>{strengthLabel}</span>}
        <span className="de-consensus-badge">Resolved</span>
      </div>
      <div className="de-consensus-body">{record.summary}</div>
      {record.impact_summary && (
        <div className="de-consensus-impact">
          <span className="de-consensus-impact-label">What changed:</span>
          <span>{record.impact_summary}</span>
        </div>
      )}
      <div className="de-consensus-footer">
        <div className="de-consensus-meta">
          <Icons.User /> Verified by <strong>{record.closed_by_name}</strong>
        </div>
        <div className="de-consensus-meta">
          <span>•</span> {new Date(record.closed_at).toLocaleDateString('en-GB', { dateStyle: 'long' })}
        </div>
        <div className="de-consensus-lock">
          <Icons.Lock /> <span>Thread Closed</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Participant collector ─── */
function collectParticipants(msg: Message): { id: string; name: string }[] {
  const map = new Map<string, string>();
  const collect = (m: Message) => { map.set(m.author.id, m.author.name); m.replies?.forEach(collect); };
  collect(msg);
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
}

/* ─── Thread Close UI ─── */
function ThreadCloseUI({ threadRootId, threadCloseHandler, participants, currentUserId }: {
  threadRootId: string; threadCloseHandler: ThreadCloseHandler;
  participants: { id: string; name: string }[]; currentUserId?: string | null;
}) {
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cited, setCited] = useState<string[]>([]);
  const isParticipant = threadCloseHandler.isParticipant(participants.map(p => p.id));
  const others = participants.filter(p => p.id !== currentUserId);

  const [impactText, setImpactText] = useState('');

  const toggleUser = (id: string) => { setCited(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]); setError(null); };

  return (
    <div className="de-close-section">
      {/* Governance guidance — surfaced where it matters */}
      <div className="de-governance-notice">
        <Icons.Lock />
        <span>The person recording consensus must not have participated in the discussion.</span>
      </div>

      {!isClosing ? (
        <div style={{ textAlign: 'center' }}>
          <p className="de-close-hint">If this thread has reached agreement, summarize the conclusion to close it.</p>
          <button className="de-btn-close-trigger" onClick={() => setIsClosing(true)} disabled={isParticipant}>
            {isParticipant ? 'You participated — someone else must close' : 'Close & Summarize'}
          </button>
        </div>
      ) : (
        <div className="de-close-form">
          <span className="de-close-form-label">Recognize Key Participants</span>
          <p className="de-close-form-desc">Select users whose arguments contributed. Each receives <strong style={{ color: 'var(--color-gold)' }}>+5 Reputation</strong>.</p>
          <div className="de-citation-list">
            {others.map(p => (
              <label key={p.id} className="de-citation-item">
                <input type="checkbox" checked={cited.includes(p.id)} onChange={() => toggleUser(p.id)} />
                <span>@{p.name}</span>
              </label>
            ))}
            {others.length === 0 && <p className="de-muted">No other participants to cite.</p>}
          </div>
          {error && <div className="de-error">{error}</div>}

          {/* Impact summary (optional) */}
          <span className="de-close-form-label">What changed due to this discussion? (optional)</span>
          <textarea className="de-impact-field" placeholder="e.g., Section 3 analysis was updated to reflect the majority interpretation…"
            value={impactText} onChange={e => setImpactText(e.target.value)} />

          <span className="de-close-form-label">Consensus Summary</span>
          <DiscussionForm mode="close" placeholder="Record the final reasoning (min 50 characters)…"
            onSubmit={async (content) => {
              if (cited.length === 0 && others.length > 0) { setError('Please cite at least one participant.'); return; }
              if (content.length < 50) { setError('Summary must be at least 50 characters.'); return; }
              setError(null);
              await threadCloseHandler.onClose(threadRootId, content, cited, impactText.trim() || undefined);
              setIsClosing(false);
            }}
            onCancel={() => { setIsClosing(false); setError(null); setCited([]); setImpactText(''); }}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Thread Block ─── */
function ThreadBlock({ root, index, onReply, onEndorse, onFollow, threadCloseHandler, currentUserId, isTopEndorsed = false, isFollowing = false }: {
  root: Message; index: number;
  onReply?: (content: string, parentId: string, threadType?: ThreadType, referenceText?: string, referenceType?: string) => Promise<void>;
  onEndorse?: (id: string) => Promise<void>;
  onFollow?: (id: string) => Promise<void>;
  threadCloseHandler?: ThreadCloseHandler | null; currentUserId?: string | null;
  isTopEndorsed?: boolean; isFollowing?: boolean;
}) {
  const isClosed = root.status === 'closed';
  const threadType = root.thread_type || 'general';
  const threadPreview = root.content.length > 100 ? root.content.slice(0, 100) + '…' : root.content;
  const hasAnswerStructure = ANSWER_THREAD_TYPES.includes(threadType as ThreadType);

  const consensusRecord = isClosed && root.closing_summary ? {
    closed_by_name: root.closed_by_name || 'Senior Reviewer',
    closed_at: root.closed_at || '', summary: root.closing_summary,
    cited_count: root.cited_participants?.length || 0,
    impact_summary: root.impact_summary || null,
  } : null;
  const participants = collectParticipants(root);

  // For answer-structured threads: separate answers (first-level) from deeper replies
  const answers = hasAnswerStructure
    ? (root.replies || []).filter(r => r.response_type === 'answer' || (!r.parent_id || r.parent_id === root.id))
    : [];
  // Sort answers by endorsements (desc), then recency (desc)
  const sortedAnswers = [...answers].sort((a, b) => {
    const diff = (b.vote_count || 0) - (a.vote_count || 0);
    return diff !== 0 ? diff : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className={`de-thread ${isClosed ? 'de-thread-closed' : ''} ${isTopEndorsed ? 'de-thread-highlighted' : ''}`}>
      {/* Thread header — content-first identity */}
      <div className="de-thread-header">
        <div className="de-thread-identity">
          <TypeBadge type={threadType as ThreadType} />
          <span className="de-thread-preview">{threadPreview}</span>
        </div>
        <div className="de-thread-status-row">
          {onFollow && <FollowButton threadId={root.id} isFollowing={isFollowing} onToggle={onFollow} />}
          <span className={`de-thread-status ${isClosed ? 'resolved' : 'open'}`}>
            {isClosed ? 'Resolved' : 'Open'}
          </span>
          {isTopEndorsed && <span className="de-thread-highlight-badge">Most Endorsed</span>}
        </div>
      </div>



      {/* Consensus Outcome — elevated to TOP when resolved */}
      {consensusRecord && <ConsensusRecord record={consensusRecord} />}

      {/* Root statement — suppressChildren for answer-structured threads to prevent duplication */}
      <StatementNode key={root.id} message={root} onReply={onReply} onEndorse={onEndorse} isRoot index={index}
        threadClosed={isClosed} showReferenceInput={hasAnswerStructure}
        suppressChildren={hasAnswerStructure} answerMode={hasAnswerStructure} />

      {/* Answer-structured rendering for question/interpretation threads */}
      {hasAnswerStructure && sortedAnswers.length > 0 && (
        <div className="de-answers-section">
          <div className="de-answers-header">
            <span>Answers ({sortedAnswers.length})</span>
          </div>
          <div className="de-answers-list">
            {sortedAnswers.map((answer, idx) => {
              const isTop = idx === 0 && (answer.vote_count || 0) >= 2 && sortedAnswers.length > 1;
              return (
                <div key={answer.id} className={`de-answer-block ${isTop ? 'de-answer-block-top' : ''}`} tabIndex={0}>
                  <StatementNode message={answer} onReply={onReply} onEndorse={onEndorse}
                    isAnswer isTopAnswer={isTop} level={1} index={idx + 1} prefix="" threadClosed={isClosed}
                    siblingMessages={sortedAnswers} showReferenceInput={true} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Flat reply rendering for non-answer threads (improvement, issue, general) */}
      {!hasAnswerStructure && root.replies && root.replies.length > 0 && (
        <div className="de-branch">
          {root.replies.map((reply, idx) => (
            <StatementNode key={reply.id} message={reply} onReply={onReply} onEndorse={onEndorse}
              level={2} index={idx + 1} prefix={`${index}`} threadClosed={isClosed} />
          ))}
        </div>
      )}

      {/* Close UI */}
      {!isClosed && threadCloseHandler?.canClose && (
        <ThreadCloseUI threadRootId={root.id} threadCloseHandler={threadCloseHandler} participants={participants} currentUserId={currentUserId} />
      )}
    </div>
  );
}

/* ─── Empty State ─── */
function EmptyState({ onTypeSelect, onScrollToForm }: { onTypeSelect?: (t: ThreadType) => void; onScrollToForm?: () => void }) {
  return (
    <div className="de-empty">
      <div className="de-empty-icon">📜</div>
      <h3 className="de-empty-title">No discussions yet</h3>
      <p className="de-empty-desc">Be the first to contribute to the legal reasoning on this topic.</p>
      <button className="de-empty-cta" onClick={onScrollToForm}>
        Start a Discussion
      </button>
      <div className="de-empty-divider">
        <span>or choose a type</span>
      </div>
      <div className="de-empty-prompts">
        {(['question', 'interpretation', 'improvement', 'issue'] as ThreadType[]).map(t => {
          const info = THREAD_TYPES[t];
          return (
            <button key={t} className="de-empty-prompt" onClick={() => onTypeSelect?.(t)}
              style={{ borderColor: info.border, color: info.color }}>
              <span>{info.icon}</span> {info.placeholder}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Discussion Engine (Main Export) ─── */
export interface DiscussionEngineProps {
  messages: Message[];
  space: 'report' | 'user' | 'group';
  currentUser?: Author | null;
  onReply?: (content: string, parentId: string, threadType?: ThreadType, referenceText?: string, referenceType?: string) => Promise<void>;
  onEndorse?: (messageId: string) => Promise<void>;
  onFollow?: (threadId: string) => Promise<void>;
  threadCloseHandler?: ThreadCloseHandler | null;
  showBottomForm?: boolean;
  followedThreadIds?: Set<string>;
}

export function DiscussionEngine({ messages, space, onReply, onEndorse, onFollow, threadCloseHandler, showBottomForm = true, currentUser, followedThreadIds }: DiscussionEngineProps) {
  const [sort, setSort] = useState<SortMode>('active');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [formType, setFormType] = useState<ThreadType | undefined>(undefined);
  const [showTopForm, setShowTopForm] = useState(false);
  const topFormRef = React.useRef<HTMLDivElement>(null);

  // Performance guardrail: warn if message count exceeds threshold
  // TODO: migrate to server-side aggregation when this triggers in production
  if (messages.length > 250) {
    console.warn(`[DiscussionEngine] High message count (${messages.length}). Client-side sorting/signals may degrade. Consider server-side aggregation.`);
  }

  // Build tree
  const threadRoots = useMemo(() => {
    const map = new Map<string, Message>();
    const roots: Message[] = [];
    messages.forEach(m => map.set(m.id, { ...m, replies: [] }));
    messages.forEach(m => {
      if (m.parent_id && map.has(m.parent_id)) {
        map.get(m.parent_id)!.replies!.push(map.get(m.id)!);
      } else {
        roots.push(map.get(m.id)!);
      }
    });
    return roots;
  }, [messages]);

  // Count votes for a thread (root + all replies)
  const threadVoteCount = (root: Message): number => {
    let total = root.vote_count || 0;
    const countReplies = (m: Message) => { m.replies?.forEach(r => { total += r.vote_count || 0; countReplies(r); }); };
    countReplies(root);
    return total;
  };

  // Find top-endorsed thread ID for highlighting
  const topEndorsedId = useMemo(() => {
    if (threadRoots.length < 2) return null;
    let maxId: string | null = null;
    let maxVotes = 0;
    for (const root of threadRoots) {
      const votes = threadVoteCount(root);
      if (votes > maxVotes) { maxVotes = votes; maxId = root.id; }
    }
    return maxVotes >= 2 ? maxId : null; // Only highlight if >= 2 endorsements
  }, [threadRoots]);

  // Filter
  const filtered = useMemo(() => {
    return threadRoots.filter(r => {
      if (filter === 'all') return true;
      if (filter === 'resolved') return r.status === 'closed';
      return (r.thread_type || 'general') === filter;
    });
  }, [threadRoots, filter]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === 'useful') arr.sort((a, b) => threadVoteCount(b) - threadVoteCount(a));
    else if (sort === 'active') {
      arr.sort((a, b) => {
        if (a.status === 'closed' && b.status !== 'closed') return 1;
        if (a.status !== 'closed' && b.status === 'closed') return -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } else {
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return arr;
  }, [filtered, sort]);

  const counts = useMemo(() => ({
    total: threadRoots.length,
    open: threadRoots.filter(r => r.status !== 'closed').length,
    resolved: threadRoots.filter(r => r.status === 'closed').length,
  }), [threadRoots]);

  const handleNewThread = async (content: string, type?: ThreadType, refText?: string, refType?: string) => {
    await onReply?.(content, '', type, refText, refType);
    setShowTopForm(false);
  };

  // Show controls only in report space (not user discussion pages)
  const showControls = space === 'report' && threadRoots.length > 0;

  const openTopForm = () => {
    setShowTopForm(true);
    setTimeout(() => topFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
  };

  return (
    <div className="de-container">
      {showControls && (
        <ThreadControls sort={sort} onSort={setSort} filter={filter} onFilter={setFilter} counts={counts} />
      )}

      {/* Top-level discussion entry — immediately accessible */}
      {showBottomForm && (
        <div className="de-top-entry" ref={topFormRef}>
          {!showTopForm ? (
            <button className="de-start-btn" onClick={openTopForm}>
              <Icons.Pen /> <span>Contribute to this topic</span>
            </button>
          ) : (
            <div className="de-top-form">
              <DiscussionForm mode={space === 'report' ? 'new' : 'reply'} selectedType={formType}
                onSubmit={handleNewThread}
                onTypeSelect={(t) => setFormType(t)}
                onCancel={() => setShowTopForm(false)}
              />
            </div>
          )}
        </div>
      )}

      <div className="de-feed">
        {sorted.length > 0 ? (
          sorted.map((root, idx) => (
            <ThreadBlock key={root.id} root={root} index={idx + 1}
              onReply={onReply} onEndorse={onEndorse} onFollow={onFollow}
              threadCloseHandler={threadCloseHandler} currentUserId={currentUser?.id}
              isTopEndorsed={root.id === topEndorsedId}
              isFollowing={followedThreadIds?.has(root.id) || false} />
          ))
        ) : threadRoots.length === 0 && showBottomForm ? (
          <EmptyState
            onTypeSelect={(t) => { setFormType(t); openTopForm(); }}
            onScrollToForm={openTopForm}
          />
        ) : null}
      </div>

      {showBottomForm && (
        <div className="de-new-thread">
          <span className="de-new-thread-label">Start a New Discussion</span>
          <DiscussionForm mode={space === 'report' ? 'new' : 'reply'} selectedType={formType}
            onSubmit={handleNewThread}
            onTypeSelect={(t) => setFormType(t)}
          />
        </div>
      )}

      {/* Floating action button — visible when scrolled past top form */}
      {showBottomForm && !showTopForm && sorted.length > 2 && (
        <button className="de-fab" onClick={openTopForm} title="Start a Discussion">
          <Icons.Pen />
        </button>
      )}
    </div>
  );
}
