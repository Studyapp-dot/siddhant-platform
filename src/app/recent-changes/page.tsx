import React from 'react';
import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import './recent-changes.css';
import { toPublicRevisionText } from '@/utils/revision-presentation';

// Contribution type labels
const TYPE_LABELS: Record<string, string> = {
  citation_addition: 'Citation Addition',
  doctrinal_expansion: 'Doctrinal Expansion',
  conceptual_clarification: 'Conceptual Clarification',
  precedent_synthesis: 'Precedent Synthesis',
  contradiction_resolution: 'Contradiction Resolution',
  structural_reorganization: 'Structural Reorganization',
  historical_context: 'Historical Context',
  analytical_improvement: 'Analytical Improvement',
  terminology_standardization: 'Terminology Standardization',
  evidence_strengthening: 'Evidence Strengthening',
  mixed: 'Mixed Contribution',
};

// Institutional icons (no emojis)
const TYPE_ICONS: Record<string, string> = {
  revision: '✎',
  discussion: '◆',
  inline_tag: '▸',
  peer_review: '◎',
  recognition: '✦',
};

const SIG_ORDER: Record<string, number> = { foundational: 0, substantial: 1, meaningful: 2, minor: 3 };

export default async function RecentChangesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; mode?: string }>;
}) {
  const { filter, mode } = await searchParams;
  const supabase = await createClient();

  // ── 1. Query view with filters ──
  let query = supabase.from('recent_changes_view').select('*');
  if (filter === 'flagged') {
    query = query.eq('activity_type', 'revision').like('action_summary', '⚑ [flagged]%');
  } else if (filter === 'recognition') {
    query = query.eq('activity_type', 'recognition');
  } else if (filter && ['revision', 'discussion', 'inline_tag', 'peer_review'].includes(filter)) {
    query = query.eq('activity_type', filter);
  }

  const { data: rawChanges, error } = await query
    .order('created_at', { ascending: false })
    .limit(100);

  // ── 2. Fetch semantics for revision entries ──
  const revisionIds = (rawChanges || [])
    .filter((c: any) => c.activity_type === 'revision')
    .map((c: any) => c.activity_id);

  let semanticsMap: Record<string, any> = {};
  if (revisionIds.length > 0) {
    const { data: semData } = await supabase
      .from('revision_semantics')
      .select('revision_id, contribution_thesis, contribution_type, significance, concepts_introduced')
      .in('revision_id', revisionIds);
    for (const s of semData || []) {
      semanticsMap[s.revision_id] = {
        ...s,
        contribution_thesis: toPublicRevisionText(s.contribution_thesis),
        concepts_introduced: (s.concepts_introduced || []).map((concept: string) => toPublicRevisionText(concept)).filter(Boolean),
      };
    }
  }

  // ── 3. Enrich & filter ──
  let changes = (rawChanges || []).map((c: any) => ({
    ...c,
    semantics: c.activity_type === 'revision' ? semanticsMap[c.activity_id] || null : null,
  }));

  const isMajorMode = mode === 'major';
  if (isMajorMode) {
    changes = changes.filter((c: any) => {
      const sig = c.semantics?.significance;
      return sig === 'foundational' || sig === 'substantial';
    });
  }

  // ── 4. Temporal grouping ──
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const epochs: { label: string; entries: any[] }[] = [
    { label: 'Today', entries: [] },
    { label: 'Yesterday', entries: [] },
    { label: 'This Week', entries: [] },
    { label: 'Earlier', entries: [] },
  ];

  for (const c of changes) {
    const d = new Date(c.created_at);
    if (d >= todayStart) epochs[0].entries.push(c);
    else if (d >= yesterdayStart) epochs[1].entries.push(c);
    else if (d >= weekStart) epochs[2].entries.push(c);
    else epochs[3].entries.push(c);
  }

  // ── 5. Helpers ──
  function getSignificance(c: any): string {
    return c.semantics?.significance || 'meaningful';
  }

  function processEpoch(entries: any[]) {
    const sorted = [...entries].sort((a, b) =>
      (SIG_ORDER[getSignificance(a)] ?? 2) - (SIG_ORDER[getSignificance(b)] ?? 2)
    );
    const major = sorted.filter(e =>
      e.activity_type !== 'revision' || getSignificance(e) !== 'minor'
    );
    const minor = sorted.filter(e =>
      e.activity_type === 'revision' && getSignificance(e) === 'minor'
    );
    return { major, minor };
  }

  function cleanSummary(c: any): string {
    let s = c.action_summary || '';
    s = s.replace(/^↩ reverted: /, '').replace(/^✗ \[reverted\] /, '');
    s = s.replace(/^⚑ \[flagged\] /, '').replace(/^committed edit: /, '');
    return toPublicRevisionText(s);
  }

  function isRevert(c: any) { return c.action_summary?.startsWith('↩ reverted:'); }
  function isReverted(c: any) { return c.action_summary?.startsWith('✗ [reverted]'); }
  function isFlagged(c: any) { return c.action_summary?.startsWith('⚑ [flagged]'); }

  function fmtTime(d: string) {
    return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function getIcon(c: any): string {
    if (isRevert(c)) return '↩';
    if (isReverted(c)) return '✗';
    if (isFlagged(c)) return '⚑';
    return TYPE_ICONS[c.activity_type] || '·';
  }

  function targetUrl(c: any): string {
    const base = `/topic/${c.node_slug}`;
    if (c.activity_type === 'discussion') return base + '/discussion';
    if (c.activity_type === 'revision') return base + '/history';
    return base;
  }

  // Active filter label
  const filterLabels: Record<string, string> = {
    revision: 'Revisions', discussion: 'Discussions', inline_tag: 'Editorial Annotations',
    peer_review: 'Peer Reviews', flagged: 'Flagged', recognition: 'Recognition',
  };

  const hasEntries = changes.length > 0;

  return (
    <div className="chronicle-layout premium-layout">
      {/* ── Sidebar ── */}
      <aside className="chronicle-sidebar">
        <div className="sidebar-section glass-panel">
          <h3>Filter Chronicle</h3>
          <ul>
            <li><Link href="/recent-changes" className={!filter ? 'active' : ''}>
              <span className="filter-icon" style={{ background: 'var(--text-muted)' }} /> All Activity
            </Link></li>
            <li><Link href="/recent-changes?filter=revision" className={filter === 'revision' ? 'active' : ''}>
              <span className="filter-icon" style={{ background: 'var(--primary)' }} /> Revisions
            </Link></li>
            <li><Link href="/recent-changes?filter=discussion" className={filter === 'discussion' ? 'active' : ''}>
              <span className="filter-icon" style={{ background: '#8b5cf6' }} /> Discussions
            </Link></li>
            <li><Link href="/recent-changes?filter=inline_tag" className={filter === 'inline_tag' ? 'active' : ''}>
              <span className="filter-icon" style={{ background: '#f59e0b' }} /> Editorial Annotations
            </Link></li>
            <li><Link href="/recent-changes?filter=peer_review" className={filter === 'peer_review' ? 'active' : ''}>
              <span className="filter-icon" style={{ background: '#22c55e' }} /> Peer Reviews
            </Link></li>
            <li><Link href="/recent-changes?filter=flagged" className={filter === 'flagged' ? 'active' : ''}>
              <span className="filter-icon" style={{ background: 'var(--color-gold)' }} /> Flagged Activity
            </Link></li>
            <li><Link href="/recent-changes?filter=recognition" className={filter === 'recognition' ? 'active' : ''}>
              <span className="filter-icon" style={{ background: '#10b981' }} /> Recognition
            </Link></li>
          </ul>
        </div>

        <div className="sidebar-section glass-panel">
          <h3>Navigation</h3>
          <ul>
            <li><Link href="/dashboard">Scholar's Desk</Link></li>
            <li><Link href="/nodes">Knowledge Archive</Link></li>
            <li><Link href="/groups">Scholarly Communities</Link></li>
          </ul>
        </div>
      </aside>

      {/* ── Main Chronicle ── */}
      <main className="chronicle-content">
        <header className="chronicle-header">
          <h1 className="chronicle-title">Scholarly Chronicle</h1>
          <p className="chronicle-subtitle">
            The institutional record of legal knowledge evolution. Transparent, chronological, and peer-verified.
          </p>
          <div className="mode-toggle">
            <Link href={`/recent-changes${filter ? `?filter=${filter}` : ''}`}
              className={!isMajorMode ? 'active' : ''}>All Activity</Link>
            <Link href={`/recent-changes?mode=major${filter ? `&filter=${filter}` : ''}`}
              className={isMajorMode ? 'active' : ''}>Major Developments</Link>
          </div>
        </header>

        {error ? (
          <div className="glass-panel chronicle-empty">
            <p style={{ color: '#ef4444', marginBottom: '16px', fontSize: '1.1rem', fontWeight: 700 }}>Unable to Load the Chronicle</p>
            <p>The activity view could not be retrieved. Please ensure the infrastructure migrations are up to date.</p>
          </div>
        ) : !hasEntries ? (
          <div className="chronicle-empty">
            {isMajorMode
              ? 'No major developments found in the current period.'
              : 'No records found for the current filter.'}
          </div>
        ) : (
          <div className="chronicle-spine">
            {epochs.map((epoch, ei) => {
              if (epoch.entries.length === 0) return null;
              const { major, minor } = processEpoch(epoch.entries);

              return (
                <section key={ei} className="chronicle-epoch">
                  <h2 className="chronicle-epoch-label">{epoch.label}</h2>
                  <div className="chronicle-epoch-body">
                    {/* Major entries */}
                    {major.map((c: any) => {
                      const sig = getSignificance(c);
                      const isFoundational = sig === 'foundational';
                      const isSubstantial = sig === 'substantial';
                      const thesis = c.semantics?.contribution_thesis;
                      const contType = c.semantics?.contribution_type
                        ? TYPE_LABELS[c.semantics.contribution_type] || c.semantics.contribution_type
                        : null;
                      const concepts = (c.semantics?.concepts_introduced || []).slice(0, 2);
                      const isRev = c.activity_type === 'revision';

                      const cardClass = [
                        'entry-card',
                        isFoundational ? 'foundational' : '',
                        isSubstantial ? 'substantial' : '',
                        isReverted(c) ? 'is-reverted' : '',
                        isRevert(c) ? 'is-revert' : '',
                      ].filter(Boolean).join(' ');

                      return (
                        <div key={`${c.activity_type}-${c.activity_id}`} className={cardClass}>
                          {/* Header row: icon + sig badge */}
                          <div className="entry-header">
                            <div className="entry-header-left">
                              <span className="entry-icon">{getIcon(c)}</span>
                              {isFoundational && <span className="entry-sig-badge foundational">✦ High Significance</span>}
                              {isSubstantial && <span className="entry-sig-badge substantial">Major Revision</span>}
                              {isRevert(c) && <span className="entry-gov-badge gov-revert">↩ Revert</span>}
                              {isReverted(c) && <span className="entry-gov-badge gov-reverted">✗ Reverted</span>}
                              {isFlagged(c) && <span className="entry-gov-badge gov-flagged">⚑ Flagged</span>}
                            </div>
                          </div>

                          {/* Topic title — PRIMARY element */}
                          <Link href={targetUrl(c)} className="entry-topic">
                            {c.node_title}
                          </Link>

                          {/* Thesis (semantic) or summary */}
                          {thesis ? (
                            <div className="entry-thesis">{thesis}</div>
                          ) : (
                            <div className="entry-summary">{cleanSummary(c)}</div>
                          )}

                          {/* Chips: type + concepts */}
                          {(contType || concepts.length > 0) && (
                            <div className="entry-chips">
                              {contType && <span className="entry-chip type-chip">{contType}</span>}
                              {concepts.map((concept: string, ci: number) => (
                                <span key={ci} className="entry-chip">{concept}</span>
                              ))}
                            </div>
                          )}

                          {/* Meta: author + time */}
                          <div className="entry-meta">
                            <Link href={`/profile/${c.author_username}`} className="entry-author">
                              {c.author_username}
                            </Link>
                            <span className="entry-dot" />
                            <span className="entry-time">{fmtDate(c.created_at)} · {fmtTime(c.created_at)}</span>
                          </div>

                          {/* Actions */}
                          {isRev && (
                            <div className="entry-actions">
                              <Link href={`/topic/${c.node_slug}/compare?rev=${c.activity_id}`} className="entry-action-link">
                                Compare →
                              </Link>
                              <Link href={`/topic/${c.node_slug}/history`} className="entry-action-link">
                                History
                              </Link>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Minor compression */}
                    {minor.length > 0 && (
                      <details className="minor-group">
                        <summary>
                          {minor.length} minor editorial revision{minor.length > 1 ? 's' : ''}
                        </summary>
                        <div className="minor-group-body">
                          {minor.map((c: any) => (
                            <div key={`minor-${c.activity_id}`} className="minor-entry">
                              <span className="entry-icon">✎</span>
                              <Link href={`/topic/${c.node_slug}/history`} className="minor-entry-topic">
                                {c.node_title}
                              </Link>
                              <span className="minor-entry-summary">{cleanSummary(c)}</span>
                              <span className="minor-entry-time">{fmtTime(c.created_at)}</span>
                              <Link href={`/topic/${c.node_slug}/compare?rev=${c.activity_id}`} className="entry-action-link">
                                Compare
                              </Link>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
