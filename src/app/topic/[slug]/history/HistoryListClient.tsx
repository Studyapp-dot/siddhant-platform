'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import ContributionReviewDrawer from '@/app/components/ContributionReviewDrawer';

// ===== Types =====
interface RevisionSemantics {
  contribution_thesis?: string | null;
  contribution_type?: string | null;
  contribution_scope?: string | null;
  significance?: string | null;
  claims_added?: string[] | null;
  concepts_introduced?: string[] | null;
  evidence_quality?: string | null;
}

interface HistoryListClientProps {
  revs: any[];
  slug: string;
  user: any;
  voteCounts: Record<string, number>;
  userVotes: string[];
  endorsementCounts: Record<string, number>;
  userEndorsements: string[];
  currentUserRole: string | null;
  sizeDeltas: Record<string, number | null>;
  roleBadges: Record<string, { label: string; color: string; short: string }>;
}

// ===== Contribution type label mapping =====
const CONTRIBUTION_TYPE_LABELS: Record<string, string> = {
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

// ===== Significance heuristic fallback =====
function inferSignificance(rev: any, delta: number | null): string {
  if (rev.is_revert) return 'meaningful';
  const absDelta = Math.abs(delta || 0);
  if (absDelta > 800) return 'substantial';
  if (absDelta > 200) return 'meaningful';
  return 'minor';
}

// ===== Helpers =====
function getSemantics(rev: any): RevisionSemantics | null {
  const sem = Array.isArray(rev.revision_semantics)
    ? rev.revision_semantics[0]
    : rev.revision_semantics;
  return sem || null;
}

function getSignificance(rev: any, delta: number | null): string {
  const sem = getSemantics(rev);
  if (sem?.significance) return sem.significance;
  return inferSignificance(rev, delta);
}

// ===== Epoch computation =====
interface Epoch {
  key: string;
  label: string;
  revs: any[];
  majorCount: number;
}

function computeEpochs(revs: any[], sizeDeltas: Record<string, number | null>): Epoch[] {
  const map = new Map<string, any[]>();

  for (const rev of revs) {
    const d = new Date(rev.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(rev);
  }

  const epochs: Epoch[] = [];
  for (const [key, epochRevs] of map) {
    const [y, m] = key.split('-');
    const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const majorCount = epochRevs.filter(r => {
      const sig = getSignificance(r, sizeDeltas[r.id]);
      return sig === 'foundational' || sig === 'substantial';
    }).length;
    epochs.push({ key, label, revs: epochRevs, majorCount });
  }

  return epochs;
}

// ===== Filter type =====
type FilterMode = 'all' | 'major' | 'foundational';

// ===== Minor group detection =====
type RevGroup = {
  type: 'single';
  rev: any;
} | {
  type: 'minor-group';
  revs: any[];
};

function groupRevisions(revs: any[], sizeDeltas: Record<string, number | null>): RevGroup[] {
  const groups: RevGroup[] = [];
  let minorBuffer: any[] = [];

  const flushMinor = () => {
    if (minorBuffer.length >= 2) {
      groups.push({ type: 'minor-group', revs: [...minorBuffer] });
    } else {
      for (const r of minorBuffer) {
        groups.push({ type: 'single', rev: r });
      }
    }
    minorBuffer = [];
  };

  for (const rev of revs) {
    const sig = getSignificance(rev, sizeDeltas[rev.id]);
    if (sig === 'minor' && !rev.is_revert && !rev.is_reverted && !rev.is_flagged) {
      minorBuffer.push(rev);
    } else {
      flushMinor();
      groups.push({ type: 'single', rev });
    }
  }
  flushMinor();

  return groups;
}


export default function HistoryListClient({
  revs,
  slug,
  user,
  voteCounts,
  userVotes,
  endorsementCounts,
  userEndorsements,
  currentUserRole,
  sizeDeltas,
  roleBadges
}: HistoryListClientProps) {
  const [selectedRevId, setSelectedRevId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [expandedMinorGroups, setExpandedMinorGroups] = useState<Set<string>>(new Set());
  const [collapsedEpochs, setCollapsedEpochs] = useState<Set<string>>(new Set());
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);

  // Only one epoch needed? Skip epoch grouping
  const epochs = useMemo(() => computeEpochs(revs, sizeDeltas), [revs, sizeDeltas]);
  const singleEpoch = epochs.length <= 1;

  // Filter logic
  const filterRevs = (epochRevs: any[]) => {
    if (filter === 'all') return epochRevs;
    return epochRevs.filter(r => {
      const sig = getSignificance(r, sizeDeltas[r.id]);
      if (filter === 'major') return sig === 'foundational' || sig === 'substantial';
      if (filter === 'foundational') return sig === 'foundational';
      return true;
    });
  };

  // Significance counts for filter bar
  const sigCounts = useMemo(() => {
    const c = { foundational: 0, substantial: 0, major: 0 };
    for (const r of revs) {
      const sig = getSignificance(r, sizeDeltas[r.id]);
      if (sig === 'foundational') { c.foundational++; c.major++; }
      if (sig === 'substantial') { c.substantial++; c.major++; }
    }
    return c;
  }, [revs, sizeDeltas]);

  // Toggle epoch collapse
  const toggleEpoch = (key: string) => {
    setCollapsedEpochs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Toggle minor group expand
  const toggleMinorGroup = (groupKey: string) => {
    setExpandedMinorGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  // Compare toggle
  const toggleCompareSelection = (id: string) => {
    setCompareSelection(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  // Render a single revision card
  const renderRevisionCard = (rev: any, index: number) => {
    const sem = getSemantics(rev);
    const sig = getSignificance(rev, sizeDeltas[rev.id]);
    const profileData = Array.isArray(rev.profiles) ? rev.profiles[0] : rev.profiles;
    const authorUsername = profileData?.username || 'Unknown';
    const authorName = profileData?.full_display_name || authorUsername;
    const authorRole = profileData?.role || 'contributor';
    const authorRep = profileData?.reputation_score || 0;
    const badge = roleBadges[authorRole] || roleBadges.contributor;
    const date = new Date(rev.created_at);
    const dateFormatted = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeFormatted = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const shortId = rev.id.substring(0, 8);
    const delta = sizeDeltas[rev.id];
    const isFirst = index === revs.length - 1;
    const isOwnEdit = user?.id === rev.author_id;
    const isRevert = rev.is_revert === true;
    const isReverted = rev.is_reverted === true;
    const isFlagged = rev.is_flagged === true;

    // Thesis: prefer semantic thesis, fallback to commit message
    const thesis = sem?.contribution_thesis || null;
    const commitMsg = rev.commit_message || '';

    // Contribution type label
    const typeLabel = sem?.contribution_type
      ? CONTRIBUTION_TYPE_LABELS[sem.contribution_type] || sem.contribution_type
      : null;

    // Concepts (limit to 2 max)
    const concepts = (sem?.concepts_introduced || []).slice(0, 2);

    // Card classes
    const cardClasses = [
      'revision-card',
      `sig-${sig}`,
      isReverted ? 'is-reverted' : '',
      isRevert ? 'is-revert' : '',
    ].filter(Boolean).join(' ');

    // Social counts
    const voteCount = voteCounts[rev.id] || 0;
    const endorseCount = endorsementCounts[rev.id] || 0;

    return (
      <div key={rev.id} className={cardClasses}>
        {/* Compare mode checkbox */}
        {compareMode && (
          <div className="compare-checkbox">
            <input
              type="checkbox"
              checked={compareSelection.includes(rev.id)}
              onChange={() => toggleCompareSelection(rev.id)}
              title="Select for comparison"
            />
          </div>
        )}

        {/* Card header: timestamp, ID, status badges */}
        <div className="rev-card-header">
          <div className="rev-card-header-left">
            <span className="timestamp">{dateFormatted} · {timeFormatted}</span>
            <span className="rev-id-badge" title={`Full ID: ${rev.id}`}>#{shortId}</span>
            {isRevert && <span className="status-badge revert">↩ Revert</span>}
            {isReverted && <span className="status-badge reverted">✗ Reverted</span>}
            {isFlagged && <span className="status-badge flagged">⚑ Flagged</span>}
          </div>
          <div className="rev-card-header-right">
            {/* Size delta */}
            {delta !== null && (
              <span className={`size-delta-badge ${isFirst ? 'size-created' : delta > 0 ? 'size-add' : delta < 0 ? 'size-del' : 'size-zero'}`}>
                {isFirst ? '+' : delta > 0 ? '+' : ''}{delta.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Significance badge for foundational/substantial */}
        {sig === 'foundational' && (
          <div className="foundational-badge">✦ High Significance</div>
        )}
        {sig === 'substantial' && (
          <span className="substantial-badge">Major Revision</span>
        )}

        {/* Thesis or commit message */}
        {sig !== 'minor' ? (
          <>
            {thesis ? (
              <div className="rev-thesis">{thesis}</div>
            ) : (
              <div className="rev-commit">{commitMsg}</div>
            )}
            {/* Show commit msg as subtitle if thesis exists and they differ */}
            {thesis && commitMsg && thesis !== commitMsg && (
              <div style={{
                fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic',
                fontFamily: 'var(--font-serif)', marginBottom: '4px', lineHeight: 1.4
              }}>
                {commitMsg}
              </div>
            )}
          </>
        ) : (
          <div className="rev-commit">{commitMsg}</div>
        )}

        {/* Semantic chips — max 2, only for non-minor */}
        {sig !== 'minor' && (typeLabel || concepts.length > 0) && (
          <div className="rev-semantic-chips">
            {typeLabel && (
              <span className="semantic-chip chip-type">{typeLabel}</span>
            )}
            {concepts.map((c, i) => (
              <span key={i} className="semantic-chip">{c}</span>
            ))}
          </div>
        )}

        {/* Author line */}
        <div className="rev-author-line">
          <div className="author-avatar-sm">{authorName.charAt(0).toUpperCase()}</div>
          <Link href={`/profile/${authorUsername}`} className="author-name-link">{authorName}</Link>
          <span className="role-badge-sm" style={{
            color: badge.color,
            background: `${badge.color}12`,
            borderColor: `${badge.color}25`
          }}>
            {badge.short}
          </span>
          {authorRep > 0 && <span className="rep-count-sm">{authorRep}</span>}
          {/* Social counts inline */}
          {(voteCount > 0 || endorseCount > 0) && (
            <div className="social-counts-sm">
              {voteCount > 0 && <span>👏 {voteCount}</span>}
              {endorseCount > 0 && <span>💡 {endorseCount}</span>}
            </div>
          )}
        </div>

        {/* Card footer — compare CTAs + actions (only for non-minor) */}
        {sig !== 'minor' && (
          <div className="rev-card-footer">
            <div className="rev-compare-actions">
              {!isFirst && (
                <Link
                  href={`/topic/${slug}/compare?rev=${rev.id}`}
                  className="compare-cta"
                >
                  ← Compare to previous
                </Link>
              )}
              {index > 0 && (
                <Link
                  href={`/topic/${slug}/compare?oldRev=${rev.id}&newRev=${revs[0].id}`}
                  className="compare-cta"
                >
                  Compare to current
                </Link>
              )}
            </div>
            <div className="rev-action-btns">
              <Link href={`/topic/${slug}?revision=${rev.id}`} className="compare-cta">View State</Link>
              {user && !isOwnEdit && !isRevert && !isReverted && (
                <button
                  type="button"
                  onClick={() => setSelectedRevId(rev.id)}
                  className="review-entry-btn"
                >
                  ⚖️ {isFlagged ? 'Review Flag' : 'Review'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* For minor cards, show minimal actions on hover */}
        {sig === 'minor' && (
          <div className="rev-card-footer" style={{ borderTop: 'none', marginTop: '6px', paddingTop: 0 }}>
            <div className="rev-compare-actions">
              {!isFirst && (
                <Link href={`/topic/${slug}/compare?rev=${rev.id}`} className="compare-cta">
                  ← Compare
                </Link>
              )}
            </div>
            <div className="rev-action-btns">
              <Link href={`/topic/${slug}?revision=${rev.id}`} className="compare-cta">View</Link>
              {user && !isOwnEdit && !isRevert && !isReverted && (
                <button type="button" onClick={() => setSelectedRevId(rev.id)} className="review-entry-btn">
                  Review
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render a minor group (collapsible set of minor revisions)
  const renderMinorGroup = (group: { type: 'minor-group'; revs: any[] }, groupIndex: number) => {
    const groupKey = `minor-${groupIndex}`;
    const isExpanded = expandedMinorGroups.has(groupKey);
    const contributorNames = Array.from(new Set(group.revs.map((rev: any) => {
      const profileData = Array.isArray(rev.profiles) ? rev.profiles[0] : rev.profiles;
      return profileData?.full_display_name || profileData?.username || 'Unknown';
    }))).slice(0, 3);
    const totalDelta = group.revs.reduce((sum, rev) => sum + Math.abs(sizeDeltas[rev.id] || 0), 0);
    const socialTotal = group.revs.reduce(
      (sum, rev) => sum + (voteCounts[rev.id] || 0) + (endorsementCounts[rev.id] || 0),
      0
    );

    return (
      <div key={groupKey}>
        <button
          type="button"
          className="minor-group-toggle"
          onClick={() => toggleMinorGroup(groupKey)}
          aria-expanded={isExpanded}
        >
          <span className="minor-group-label">
            {group.revs.length} minor revision{group.revs.length > 1 ? 's' : ''}
            <span className="minor-group-credit">
              {contributorNames.join(', ')}
              {group.revs.length > contributorNames.length ? ` +${group.revs.length - contributorNames.length}` : ''}
            </span>
            <span className="minor-group-impact">
              {totalDelta.toLocaleString()} chars reviewed
              {socialTotal > 0 ? ` | ${socialTotal} recognition signal${socialTotal !== 1 ? 's' : ''}` : ''}
            </span>
          </span>
          <span className={`minor-group-chevron ${isExpanded ? 'expanded' : ''}`}>▸</span>
        </button>
        {isExpanded && (
          <div className="revisions-list" style={{ marginLeft: '4px' }}>
            {group.revs.map((rev, i) => renderRevisionCard(rev, revs.indexOf(rev)))}
          </div>
        )}
      </div>
    );
  };

  // Render one epoch's worth of revisions
  const renderEpochContent = (epochRevs: any[], epochIndex: number) => {
    const filtered = filterRevs(epochRevs);
    if (filtered.length === 0 && filter !== 'all') {
      return (
        <div style={{ padding: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          No matching revisions in this period.
        </div>
      );
    }
    const groups = filter === 'all' ? groupRevisions(filtered, sizeDeltas) : filtered.map(r => ({ type: 'single' as const, rev: r }));

    return (
      <div className="revisions-list">
        {groups.map((group, gi) => {
          if (group.type === 'minor-group') {
            return renderMinorGroup(group as { type: 'minor-group'; revs: any[] }, epochIndex * 1000 + gi);
          }
          return renderRevisionCard(group.rev, revs.indexOf(group.rev));
        })}
      </div>
    );
  };

  return (
    <>
      {/* Filter Bar */}
      {revs.length > 3 && (
        <div className="history-filter-bar">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All<span className="filter-count">{revs.length}</span>
          </button>
          {sigCounts.major > 0 && (
            <button
              className={`filter-btn ${filter === 'major' ? 'active' : ''}`}
              onClick={() => setFilter('major')}
            >
              Major<span className="filter-count">{sigCounts.major}</span>
            </button>
          )}
          {sigCounts.foundational > 0 && (
            <button
              className={`filter-btn ${filter === 'foundational' ? 'active' : ''}`}
              onClick={() => setFilter('foundational')}
            >
              Foundational<span className="filter-count">{sigCounts.foundational}</span>
            </button>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Compare mode toggle */}
          <button
            className={`compare-mode-toggle ${compareMode ? 'active' : ''}`}
            onClick={() => { setCompareMode(!compareMode); setCompareSelection([]); }}
          >
            {compareMode ? 'Exit Compare' : 'Custom Compare'}
          </button>
        </div>
      )}

      {/* Compare mode bar */}
      {compareMode && compareSelection.length > 0 && (
        <div className="compare-mode-bar">
          <span className="compare-mode-label">
            {compareSelection.length}/2 selected
          </span>
          <div className="compare-mode-actions">
            {compareSelection.length === 2 && (
              <Link
                href={`/topic/${slug}/compare?oldRev=${compareSelection[0]}&newRev=${compareSelection[1]}`}
                className="compare-mode-toggle active"
                style={{ textDecoration: 'none' }}
              >
                Compare Selected →
              </Link>
            )}
            <button
              className="compare-mode-toggle"
              onClick={() => setCompareSelection([])}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="history-timeline">
        {singleEpoch ? (
          // No epoch grouping needed — render flat
          renderEpochContent(epochs[0]?.revs || revs, 0)
        ) : (
          // Epoch-grouped timeline
          epochs.map((epoch, ei) => {
            const isCollapsed = collapsedEpochs.has(epoch.key);
            return (
              <div key={epoch.key} className="epoch-section" id={`epoch-${epoch.key}`}>
                <button
                  type="button"
                  className="epoch-header"
                  onClick={() => toggleEpoch(epoch.key)}
                  aria-expanded={!isCollapsed}
                >
                  <span className="epoch-title">{epoch.label}</span>
                  <span className="epoch-meta">
                    <span>{epoch.revs.length} revision{epoch.revs.length > 1 ? 's' : ''}</span>
                    {epoch.majorCount > 0 && (
                      <>
                        <span className="epoch-meta-dot" />
                        <span>{epoch.majorCount} major</span>
                      </>
                    )}
                  </span>
                  <span className={`epoch-chevron ${isCollapsed ? 'collapsed' : ''}`}>▾</span>
                </button>
                <div className={`epoch-body ${isCollapsed ? 'collapsed' : 'expanded'}`}>
                  {renderEpochContent(epoch.revs, ei)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Contribution Review Drawer */}
      {selectedRevId && (
        <ContributionReviewDrawer
          isOpen={!!selectedRevId}
          onClose={() => setSelectedRevId(null)}
          revisionId={selectedRevId}
          slug={slug}
          allRevisionIds={revs.map(r => r.id)}
          currentUserRole={currentUserRole}
        />
      )}
    </>
  );
}
