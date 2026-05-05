'use client';

import React, { useState, useTransition } from 'react';

interface Tag {
  id: string;
  tier: number;
  tag_type: string;
  context_quote: string | null;
  created_at: string;
  profiles?: { username: string } | null;
}

interface FlagIssuePanelProps {
  nodeId: string;
  slug: string;
  existingTags: Tag[];
  isLoggedIn: boolean;
  userRole?: string | null;
}

// Level 3+ can resolve flags (Recognized Contributor and above)
const CAN_RESOLVE = ['recognized', 'senior_scholar', 'steward', 'governance_council'];

const TAG_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  citation_needed: { label: 'Citation Needed',   color: '#c5a059', icon: '📎' },
  outdated:        { label: 'May Be Outdated',    color: '#d97706', icon: '⏰' },
  unclear:         { label: 'Unclear Explanation', color: '#2563eb', icon: '❓' },
  disputed:        { label: 'Legally Disputed',    color: '#dc2626', icon: '⚠' },
};

export default function FlagIssuePanel({ nodeId, slug, existingTags, isLoggedIn, userRole }: FlagIssuePanelProps) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('citation_needed');
  const [quote, setQuote] = useState('');
  const [success, setSuccess] = useState(false);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const canResolve = !!userRole && CAN_RESOLVE.includes(userRole);
  const visibleTags = existingTags.filter(t => !resolvedIds.has(t.id));

  const handleResolve = (tagId: string) => {
    startTransition(async () => {
      const res = await fetch('/api/resolve-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id: tagId }),
      });
      if (res.ok) {
        setResolvedIds(prev => new Set([...prev, tagId]));
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const fd = new FormData();
      fd.append('node_id', nodeId);
      fd.append('slug', slug);
      fd.append('tier', '1'); // Default to 1 since tiers are deprecated
      fd.append('tag_type', selectedType);
      if (quote) fd.append('context_quote', quote);

      await fetch('/api/inline-tags', { method: 'POST', body: fd });
      setSuccess(true);
      setOpen(false);
      setQuote('');
      setTimeout(() => window.location.reload(), 800);
    });
  };

  return (
    <div className="flag-panel-scholarly">
      {/* Existing Flags */}
      {visibleTags.length > 0 && (
        <div className="flag-existing">
          <h3 className="flag-section-title">
            Open Flags ({visibleTags.length})
          </h3>
          <div className="flag-tag-list">
            {visibleTags.map(tag => {
              const meta = TAG_LABELS[tag.tag_type];
              return (
                <div key={tag.id} className="flag-tag-card">
                  <span className="flag-tag-icon">{meta?.icon}</span>
                  <div className="flag-tag-body">
                    <span className="flag-tag-type" style={{ color: meta?.color }}>
                      {meta?.label}
                    </span>
                    <span className="flag-tag-meta">
                      by <a href={`/profile/${tag.profiles?.username ?? 'unknown'}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>@{tag.profiles?.username ?? 'unknown'}</a> · {new Date(tag.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                    {tag.context_quote && (
                      <p className="flag-tag-quote">"{tag.context_quote}"</p>
                    )}
                  </div>
                  {canResolve && (
                    <button
                      onClick={() => handleResolve(tag.id)}
                      disabled={isPending}
                      className="flag-resolve-btn"
                    >
                      ✓ Resolve
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Flag Issue Button + Form */}
      {isLoggedIn && (
        <div className="flag-action-area">
          {success && (
            <p className="flag-success">✓ Flag submitted. Thank you for helping improve this article.</p>
          )}
          {!open ? (
            <button onClick={() => setOpen(true)} className="flag-trigger-btn">
              ⚑ Flag an Issue in This Report
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="flag-form-scholarly">
              <h4 className="flag-form-title">Flag an Issue</h4>
              <div className="flag-form-row">
                <div className="flag-form-group">
                  <label className="flag-form-label">Issue Type</label>
                  <select
                    value={selectedType}
                    onChange={e => setSelectedType(e.target.value)}
                    className="flag-form-select"
                  >
                    {Object.entries(TAG_LABELS).map(([v, m]) => (
                      <option key={v} value={v}>{m.icon} {m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flag-form-group" style={{ marginTop: '12px' }}>
                <label className="flag-form-label">
                  Quoted Passage (optional)
                </label>
                <textarea
                  value={quote}
                  onChange={e => setQuote(e.target.value)}
                  placeholder='Paste the specific sentence that needs attention...'
                  rows={2}
                  maxLength={300}
                  className="flag-form-textarea"
                />
              </div>
              <div className="flag-form-actions">
                <button type="submit" disabled={isPending} className="flag-submit-btn">
                  {isPending ? 'Submitting…' : 'Submit Flag'}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="flag-cancel-btn">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <style>{`
        .flag-panel-scholarly {
          margin-top: 32px;
          padding: 24px 28px;
          border-radius: var(--radius-md, 12px);
          border: 1px solid var(--border-subtle);
          background: var(--bg-surface);
        }
        .flag-section-title {
          font-family: var(--font-sans);
          font-size: 0.7rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--color-gold, #c5a059);
          margin-bottom: 16px;
        }
        .flag-tag-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 20px;
        }
        .flag-tag-card {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          padding: 14px 18px;
          border-radius: 10px;
          background: var(--bg-panel);
          border: 1px solid var(--border-subtle);
        }
        .flag-tag-icon { font-size: 1.1rem; flex-shrink: 0; margin-top: 2px; }
        .flag-tag-body { flex: 1; }
        .flag-tag-type { font-weight: 700; font-size: 0.88rem; }
        .flag-tag-meta {
          display: block;
          font-size: 0.75rem;
          color: var(--text-muted, #64748b);
          margin-top: 2px;
        }
        .flag-tag-quote {
          margin-top: 8px;
          font-style: italic;
          color: var(--text-muted, #64748b);
          font-size: 0.82rem;
          border-left: 2px solid var(--color-gold, #c5a059);
          padding-left: 10px;
          font-family: var(--font-serif);
        }
        .flag-resolve-btn {
          background: transparent;
          border: 1px solid rgba(52,211,153,0.4);
          color: #059669;
          border-radius: 6px;
          padding: 5px 12px;
          cursor: pointer;
          font-size: 0.75rem;
          font-family: var(--font-sans);
          font-weight: 600;
          flex-shrink: 0;
          transition: all 0.15s ease;
        }
        .flag-resolve-btn:hover {
          background: rgba(52,211,153,0.1);
        }
        .flag-action-area {
          margin-top: ${visibleTags.length > 0 ? '16px' : '0'};
          padding-top: ${visibleTags.length > 0 ? '16px' : '0'};
          border-top: ${visibleTags.length > 0 ? '1px solid var(--border-subtle)' : 'none'};
        }
        .flag-success {
          color: #059669;
          font-size: 0.85rem;
          margin-bottom: 12px;
          font-weight: 600;
        }
        .flag-trigger-btn {
          background: transparent;
          border: 1px solid var(--border-subtle);
          color: var(--text-muted, #64748b);
          border-radius: 8px;
          padding: 10px 18px;
          cursor: pointer;
          font-size: 0.82rem;
          font-family: var(--font-sans);
          font-weight: 600;
          transition: all 0.15s ease;
        }
        .flag-trigger-btn:hover {
          border-color: var(--color-gold, #c5a059);
          color: var(--color-gold, #c5a059);
        }
        .flag-form-scholarly {
          padding: 20px;
          border-radius: 10px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-panel);
        }
        .flag-form-title {
          font-family: var(--font-sans);
          font-size: 0.7rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-primary);
          margin-bottom: 16px;
        }
        .flag-form-row {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }
        .flag-form-group { flex: 1; min-width: 200px; }
        .flag-form-label {
          display: block;
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--text-secondary);
          margin-bottom: 6px;
          font-family: var(--font-sans);
        }
        .flag-form-select {
          width: 100%;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 10px 14px;
          color: var(--text-primary);
          font-family: var(--font-sans);
          font-size: 0.88rem;
          cursor: pointer;
        }
        .flag-form-textarea {
          width: 100%;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 10px 14px;
          color: var(--text-primary);
          font-family: var(--font-serif);
          font-size: 0.88rem;
          resize: vertical;
        }
        .flag-form-select:focus, .flag-form-textarea:focus {
          outline: none;
          border-color: var(--color-gold, #c5a059);
        }
        .flag-form-actions {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }
        .flag-submit-btn {
          background: var(--color-gold, #c5a059);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-family: var(--font-sans);
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .flag-submit-btn:hover { opacity: 0.9; }
        .flag-cancel-btn {
          background: transparent;
          border: 1px solid var(--border-subtle);
          color: var(--text-muted);
          border-radius: 8px;
          padding: 10px 20px;
          font-family: var(--font-sans);
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
